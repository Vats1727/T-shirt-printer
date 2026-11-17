import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ProviderGatewayModel } from '../models/providerGateway.model.js';
import { ProviderGatewayService } from '../services/providerGateway.service.js';
import { encryptSecret } from '../utils/crypto.js';

function maskKey(keyId) {
  if (!keyId || typeof keyId !== 'string') return null;
  if (keyId.length <= 12) return '••••' + keyId.slice(-4);
  const prefix = keyId.slice(0, 9); // e.g. "rzp_test_"
  const suffix = keyId.slice(-6);  // e.g. "SWqgbt"
  return `${prefix}••••${suffix}`;
}

export const ProviderGatewayController = {
  /**
   * Retrieves the payment gateway configuration status for the authenticated provider.
   * Portal admins can pass ?providerId= to view a specific provider's status.
   */
  async getGatewayStatus(req, res, next) {
    try {
      const userRole = req.user?.role;
      let providerId = req.user?.id || req.user?.sub;

      if (userRole === 'portal_admin' && req.query.providerId) {
        providerId = Number(req.query.providerId);
      }

      if (!providerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const envMode = req.query.envMode || process.env.APP_PAYMENT_ENV || 'test';

      // 1. Ensure or find account
      let account = await ProviderGatewayModel.findAccountByProvider(providerId, 'razorpay', envMode);
      if (!account) {
        account = await ProviderGatewayModel.ensureAccountExists({
          providerId,
          gatewayName: 'razorpay',
          environmentMode: envMode
        });
      }

      // 2. Fetch active credentials (masked)
      const activeCred = account ? await ProviderGatewayModel.findActiveCredential(account.id) : null;
      const validWhSecrets = account ? await ProviderGatewayModel.findValidWebhookSecrets(account.id) : [];

      const host = req.get('host');
      const protocol = req.protocol || 'http';
      const webhookUrl = `${protocol}://${host}/api/webhooks/razorpay/providers/${account.webhook_url_slug}`;

      return res.json({
        success: true,
        gateway: {
          accountId: account.id,
          providerId: Number(providerId),
          status: account.status,
          isConfigured: account.status === 'active' && Boolean(activeCred),
          environmentMode: account.environment_mode,
          webhookUrlSlug: account.webhook_url_slug,
          webhookUrl,
          hasWebhookSecret: validWhSecrets.length > 0,
          keyIdMasked: activeCred ? maskKey(activeCred.key_id) : null,
          keyId: activeCred ? activeCred.key_id : null,
          lastTestPingAt: account.last_test_ping_at,
          lastTestPingStatus: account.last_test_ping_status,
          lastErrorMessage: account.last_error_message,
          businessVerified: account.business_verified
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Configures and validates a provider's Razorpay credentials with live API ping handshake.
   */
  async configureGateway(req, res, next) {
    try {
      const userRole = req.user?.role;
      let providerId = req.user?.id || req.user?.sub;

      if (userRole === 'portal_admin' && req.body.providerId) {
        providerId = Number(req.body.providerId);
      }

      if (!providerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const {
        keyId,
        keySecret,
        webhookSecret,
        environmentMode = process.env.APP_PAYMENT_ENV || 'test'
      } = req.body;

      // 1. Basic validation
      if (!keyId || typeof keyId !== 'string' || !keyId.trim()) {
        return res.status(400).json({ success: false, message: 'Razorpay Key ID is required.' });
      }
      if (!keySecret || typeof keySecret !== 'string' || !keySecret.trim()) {
        return res.status(400).json({ success: false, message: 'Razorpay Key Secret is required.' });
      }

      const cleanKeyId = keyId.trim();
      const cleanKeySecret = keySecret.trim();

      if (environmentMode === 'test' && !cleanKeyId.startsWith('rzp_test_')) {
        return res.status(400).json({
          success: false,
          message: "Invalid Key ID format. In Test Mode, Razorpay Key ID must start with 'rzp_test_'."
        });
      }
      if (environmentMode === 'live' && !cleanKeyId.startsWith('rzp_live_')) {
        return res.status(400).json({
          success: false,
          message: "Invalid Key ID format. In Live Mode, Razorpay Key ID must start with 'rzp_live_'."
        });
      }

      // 2. LIVE HANDSHAKE PING: Verify credentials against Razorpay API before saving!
      try {
        const testClient = new Razorpay({
          key_id: cleanKeyId,
          key_secret: cleanKeySecret
        });
        await testClient.orders.all({ count: 1 });
      } catch (authErr) {
        const description = authErr?.error?.description || authErr?.message || 'Authentication failed';
        console.warn(`[GatewayConfig] Razorpay authentication handshake failed for provider #${providerId}:`, description);
        return res.status(400).json({
          success: false,
          message: `Razorpay connection failed: ${description}. Please double-check your Key ID and Key Secret from the Razorpay Dashboard.`
        });
      }

      // 3. Ensure account exists in DB
      let account = await ProviderGatewayModel.findAccountByProvider(providerId, 'razorpay', environmentMode);
      if (!account) {
        account = await ProviderGatewayModel.ensureAccountExists({
          providerId,
          gatewayName: 'razorpay',
          environmentMode
        });
      }

      // 4. Encrypt keySecret with AES-256-GCM and store active credential
      const encKey = encryptSecret(cleanKeySecret);
      const savedCred = await ProviderGatewayModel.setActiveCredential({
        gatewayAccountId: account.id,
        keyId: cleanKeyId,
        keySecretEncrypted: encKey.encrypted,
        keySecretIv: encKey.iv,
        keySecretAuthTag: encKey.authTag,
        encryptionKeyVersion: encKey.keyVersion
      });

      // 5. Store / Generate Webhook Secret
      let activeWebhookSecret = webhookSecret ? webhookSecret.trim() : null;
      if (!activeWebhookSecret) {
        // Auto-generate secure 32-character hex secret for webhook verification
        activeWebhookSecret = `whsec_prov_${crypto.randomBytes(12).toString('hex')}`;
      }

      const encWh = encryptSecret(activeWebhookSecret);
      await ProviderGatewayModel.setActiveWebhookSecret({
        gatewayAccountId: account.id,
        webhookSecretEncrypted: encWh.encrypted,
        webhookSecretIv: encWh.iv,
        webhookSecretAuthTag: encWh.authTag,
        encryptionKeyVersion: encWh.keyVersion
      });

      // 6. Update account status to active and record successful ping
      await ProviderGatewayModel.updateAccountStatus(account.id, 'active');
      await ProviderGatewayModel.updatePingStatus(account.id, true);

      const host = req.get('host');
      const protocol = req.protocol || 'http';
      const webhookUrl = `${protocol}://${host}/api/webhooks/razorpay/providers/${account.webhook_url_slug}`;

      return res.json({
        success: true,
        message: 'Razorpay payment gateway configured and verified successfully!',
        gateway: {
          accountId: account.id,
          status: 'active',
          isConfigured: true,
          environmentMode,
          keyIdMasked: maskKey(cleanKeyId),
          webhookUrl,
          webhookSecret: activeWebhookSecret,
          lastTestPingStatus: 'success',
          lastTestPingAt: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Performs an on-demand live ping using stored credentials.
   */
  async testGatewayPing(req, res, next) {
    try {
      const userRole = req.user?.role;
      let providerId = req.user?.id || req.user?.sub;

      if (userRole === 'portal_admin' && req.query.providerId) {
        providerId = Number(req.query.providerId);
      }

      if (!providerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const envMode = req.query.envMode || process.env.APP_PAYMENT_ENV || 'test';
      const result = await ProviderGatewayService.testProviderPing(providerId, envMode);

      return res.json({
        success: result.success,
        message: result.success
          ? 'Razorpay gateway is active and connected successfully!'
          : `Connection error: ${result.error}`,
        error: result.error || null,
        recentOrdersCount: result.count ?? 0
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Resets or disconnects a provider gateway account back to 'unconfigured'.
   */
  async disconnectGateway(req, res, next) {
    try {
      const userRole = req.user?.role;
      let providerId = req.user?.id || req.user?.sub;

      if (userRole === 'portal_admin' && req.body.providerId) {
        providerId = Number(req.body.providerId);
      }

      const envMode = req.body.envMode || process.env.APP_PAYMENT_ENV || 'test';
      const account = await ProviderGatewayModel.findAccountByProvider(providerId, 'razorpay', envMode);

      if (!account) {
        return res.status(404).json({ success: false, message: 'Gateway account not found.' });
      }

      await ProviderGatewayModel.updateAccountStatus(account.id, 'unconfigured');

      return res.json({
        success: true,
        message: 'Payment gateway disconnected successfully. Gateway status set to unconfigured.',
        status: 'unconfigured'
      });
    } catch (err) {
      next(err);
    }
  }
};

