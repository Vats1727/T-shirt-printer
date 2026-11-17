import Razorpay from 'razorpay';
import { ProviderGatewayModel } from '../models/providerGateway.model.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';

const PLATFORM_IN_HOUSE_ID = Number(process.env.PLATFORM_IN_HOUSE_ID || 1);
const DEFAULT_ENV_MODE = process.env.APP_PAYMENT_ENV || 'test';

/**
 * providerGateway.service.js
 * 
 * Secure Merchant of Record gateway resolution service.
 * Enforces strict per-provider credential isolation with AES-256-GCM decryption
 * and ZERO fallback to platform credentials for third-party providers.
 */
export const ProviderGatewayService = {
  /**
   * Resolves and decrypts the active Razorpay API credentials for a given provider.
   * 
   * @param {number|string} providerId - Provider user ID
   * @param {string} [envMode] - 'test' or 'live'
   * @returns {Promise<{
   *   gatewayAccountId: number,
   *   credentialId: number,
   *   keyId: string,
   *   keySecret: string,
   *   environmentMode: string,
   *   webhookUrlSlug: string,
   *   isPlatformInHouse: boolean
   * }>}
   */
  async getProviderCredentials(providerId, envMode = DEFAULT_ENV_MODE) {
    const numProviderId = Number(providerId);

    // 1. Fetch provider gateway account
    const account = await ProviderGatewayModel.findAccountByProvider(numProviderId, 'razorpay', envMode);

    if (!account) {
      // Rule: ZERO fallback to platform credentials for third-party providers
      if (numProviderId !== PLATFORM_IN_HOUSE_ID) {
        throw new Error(
          `PAYMENT_GATEWAY_UNCONFIGURED: Provider #${numProviderId} has not configured their Razorpay ${envMode} account. Orders cannot be processed without provider gateway setup.`
        );
      }

      // Legacy fallback ONLY permitted for genuine platform in-house orders
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Platform in-house Razorpay credentials are not configured in environment.');
      }

      return {
        gatewayAccountId: null,
        credentialId: null,
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
        environmentMode: envMode,
        webhookUrlSlug: 'platform-inhouse',
        isPlatformInHouse: true
      };
    }

    if (account.status !== 'active' && account.status !== 'testing') {
      throw new Error(
        `PAYMENT_GATEWAY_SUSPENDED: Provider #${numProviderId}'s gateway account is currently ${account.status}.`
      );
    }

    // 2. Fetch active credential
    const cred = await ProviderGatewayModel.findActiveCredential(account.id);
    if (!cred) {
      throw new Error(
        `PAYMENT_CREDENTIALS_MISSING: Active gateway credentials not found for provider #${numProviderId} (Account #${account.id}).`
      );
    }

    // 3. Decrypt key_secret
    let keySecret;
    try {
      keySecret = decryptSecret(
        cred.key_secret_encrypted,
        cred.key_secret_iv,
        cred.key_secret_auth_tag,
        cred.encryption_key_version
      );
    } catch (decryptErr) {
      console.error(`[ProviderGatewayService] Decryption failed for credential #${cred.id}:`, decryptErr.message);
      throw new Error('Failed to decrypt gateway credentials due to security authentication failure.');
    }

    return {
      gatewayAccountId: account.id,
      credentialId: cred.id,
      keyId: cred.key_id,
      keySecret,
      environmentMode: account.environment_mode,
      webhookUrlSlug: account.webhook_url_slug,
      isPlatformInHouse: numProviderId === PLATFORM_IN_HOUSE_ID
    };
  },

  /**
   * Instantiates a Razorpay SDK client instance initialized with the provider's active credentials.
   * 
   * @param {number|string} providerId - Provider user ID
   * @param {string} [envMode] - 'test' or 'live'
   * @returns {Promise<{
   *   razorpay: Razorpay,
   *   gatewayAccountId: number,
   *   credentialId: number,
   *   keyId: string
   * }>}
   */
  async getRazorpayClientForProvider(providerId, envMode = DEFAULT_ENV_MODE) {
    const creds = await this.getProviderCredentials(providerId, envMode);
    const razorpay = new Razorpay({
      key_id: creds.keyId,
      key_secret: creds.keySecret
    });

    return {
      razorpay,
      gatewayAccountId: creds.gatewayAccountId,
      credentialId: creds.credentialId,
      keyId: creds.keyId,
      webhookUrlSlug: creds.webhookUrlSlug,
      isPlatformInHouse: creds.isPlatformInHouse
    };
  },

  /**
   * Resolves valid (active and rotating) decrypted webhook secrets for a given webhook slug.
   * 
   * @param {string} webhookUrlSlug
   * @returns {Promise<{
   *   gatewayAccount: Object,
   *   secrets: Array<{ id: number, secret: string, status: string, versionNumber: number }>
   * }>}
   */
  async getDecryptedWebhookSecrets(webhookUrlSlug) {
    const account = await ProviderGatewayModel.findAccountByWebhookSlug(webhookUrlSlug);
    if (!account) {
      return null;
    }

    const rawSecrets = await ProviderGatewayModel.findValidWebhookSecrets(account.id);
    const decryptedSecrets = [];

    for (const raw of rawSecrets) {
      try {
        const secret = decryptSecret(
          raw.webhook_secret_encrypted,
          raw.webhook_secret_iv,
          raw.webhook_secret_auth_tag,
          raw.encryption_key_version
        );
        decryptedSecrets.push({
          id: raw.id,
          secret,
          status: raw.status,
          versionNumber: raw.version_number
        });
      } catch (err) {
        console.warn(`[ProviderGatewayService] Failed to decrypt webhook secret #${raw.id}:`, err.message);
      }
    }

    return {
      gatewayAccount: account,
      secrets: decryptedSecrets
    };
  },

  /**
   * Pings Razorpay with provider credentials to verify live API connectivity.
   */
  async testProviderPing(providerId, envMode = DEFAULT_ENV_MODE) {
    const { razorpay, gatewayAccountId } = await this.getRazorpayClientForProvider(providerId, envMode);
    try {
      const orders = await razorpay.orders.all({ count: 1 });
      if (gatewayAccountId) {
        await ProviderGatewayModel.updatePingStatus(gatewayAccountId, true);
      }
      return { success: true, count: orders?.items?.length ?? 0 };
    } catch (err) {
      const errMsg = err?.error?.description || err.message || 'Razorpay ping failed';
      if (gatewayAccountId) {
        await ProviderGatewayModel.updatePingStatus(gatewayAccountId, false, errMsg);
      }
      return { success: false, error: errMsg };
    }
  }
};

