import crypto from 'crypto';
import { pool } from '../config/database.js';

/**
 * providerGateway.model.js
 * 
 * Direct database access layer for Provider Gateway Accounts,
 * Encrypted Credentials, and Versioned Webhook Secrets.
 */

export const ProviderGatewayModel = {
  /**
   * Finds a provider's gateway account by provider ID and environment mode.
   */
  async findAccountByProvider(providerId, gatewayName = 'razorpay', envMode = 'test') {
    const query = `
      SELECT *
      FROM provider_gateway_accounts
      WHERE provider_id = $1 
        AND gateway_name = $2 
        AND environment_mode = $3
      LIMIT 1;
    `;
    const res = await pool.query(query, [providerId, gatewayName, envMode]);
    return res.rows[0] || null;
  },

  /**
   * Finds a provider gateway account by its unique webhook URL slug.
   */
  async findAccountByWebhookSlug(webhookUrlSlug) {
    const query = `
      SELECT *
      FROM provider_gateway_accounts
      WHERE webhook_url_slug = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [webhookUrlSlug]);
    return res.rows[0] || null;
  },

  /**
   * Finds a gateway account by ID.
   */
  async findAccountById(id) {
    const query = `
      SELECT *
      FROM provider_gateway_accounts
      WHERE id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  },

  /**
   * Ensures an unconfigured gateway account row exists for a provider.
   */
  async ensureAccountExists({ providerId, gatewayName = 'razorpay', environmentMode = 'test' }) {
    const existing = await this.findAccountByProvider(providerId, gatewayName, environmentMode);
    if (existing) return existing;

    const slug = `prov_${providerId}_${crypto.randomBytes(6).toString('hex')}`;
    const query = `
      INSERT INTO provider_gateway_accounts (
        provider_id, gateway_name, environment_mode, webhook_url_slug,
        status, business_verified
      ) VALUES ($1, $2, $3, $4, 'unconfigured', false)
      ON CONFLICT (provider_id, gateway_name, environment_mode)
      DO NOTHING
      RETURNING *;
    `;
    const res = await pool.query(query, [providerId, gatewayName, environmentMode, slug]);
    if (res.rows[0]) return res.rows[0];
    return this.findAccountByProvider(providerId, gatewayName, environmentMode);
  },

  /**
   * Updates gateway account status (e.g. 'unconfigured', 'active', 'suspended').
   */
  async updateAccountStatus(gatewayAccountId, status) {
    const query = `
      UPDATE provider_gateway_accounts
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = await pool.query(query, [gatewayAccountId, status]);
    return res.rows[0] || null;
  },

  /**
   * Finds the currently active gateway credentials for a gateway account.
   */
  async findActiveCredential(gatewayAccountId) {
    const query = `
      SELECT *
      FROM provider_gateway_credentials
      WHERE gateway_account_id = $1 
        AND status = 'active'
      LIMIT 1;
    `;
    const res = await pool.query(query, [gatewayAccountId]);
    return res.rows[0] || null;
  },

  /**
   * Finds all valid webhook secrets for a gateway account (active + rotating within grace window).
   */
  async findValidWebhookSecrets(gatewayAccountId) {
    const query = `
      SELECT *
      FROM provider_webhook_secrets
      WHERE gateway_account_id = $1 
        AND (
          status = 'active' 
          OR (status = 'rotating' AND (expires_at IS NULL OR expires_at > NOW()))
        )
      ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, version_number DESC;
    `;
    const res = await pool.query(query, [gatewayAccountId]);
    return res.rows;
  },

  /**
   * Upserts a provider gateway account.
   */
  async upsertGatewayAccount({
    providerId,
    gatewayName = 'razorpay',
    environmentMode = 'test',
    webhookUrlSlug,
    status = 'active',
    businessVerified = true,
    verifiedGstin = null,
    verifiedLegalName = null
  }) {
    const query = `
      INSERT INTO provider_gateway_accounts (
        provider_id, gateway_name, environment_mode, webhook_url_slug,
        status, business_verified, verified_gstin, verified_legal_name,
        custody_terms_accepted_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (provider_id, gateway_name, environment_mode)
      DO UPDATE SET
        webhook_url_slug = EXCLUDED.webhook_url_slug,
        status = EXCLUDED.status,
        business_verified = EXCLUDED.business_verified,
        verified_gstin = EXCLUDED.verified_gstin,
        verified_legal_name = EXCLUDED.verified_legal_name,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(query, [
      providerId,
      gatewayName,
      environmentMode,
      webhookUrlSlug,
      status,
      businessVerified,
      verifiedGstin,
      verifiedLegalName
    ]);
    return res.rows[0];
  },

  /**
   * Inserts an active gateway credential, retiring any previous active credential for this account.
   */
  async setActiveCredential({
    gatewayAccountId,
    keyId,
    keySecretEncrypted,
    keySecretIv,
    keySecretAuthTag,
    encryptionKeyVersion = 'v1'
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Determine next version number
      const verRes = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver 
         FROM provider_gateway_credentials 
         WHERE gateway_account_id = $1;`,
        [gatewayAccountId]
      );
      const nextVersion = verRes.rows[0].next_ver;

      // 2. Retire previous active credential
      await client.query(
        `UPDATE provider_gateway_credentials 
         SET status = 'retired', retired_at = NOW() 
         WHERE gateway_account_id = $1 AND status = 'active';`,
        [gatewayAccountId]
      );

      // 3. Insert new active credential
      const insRes = await client.query(
        `INSERT INTO provider_gateway_credentials (
           gateway_account_id, version_number, key_id, 
           key_secret_encrypted, key_secret_iv, key_secret_auth_tag, 
           encryption_key_version, status, activated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
         RETURNING *;`,
        [
          gatewayAccountId,
          nextVersion,
          keyId,
          keySecretEncrypted,
          keySecretIv,
          keySecretAuthTag,
          encryptionKeyVersion
        ]
      );

      await client.query('COMMIT');
      return insRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Sets an active webhook secret atomically with 48-hour rotation grace period.
   */
  async setActiveWebhookSecret({
    gatewayAccountId,
    webhookSecretEncrypted,
    webhookSecretIv,
    webhookSecretAuthTag,
    encryptionKeyVersion = 'v1'
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Determine next version number
      const verRes = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver 
         FROM provider_webhook_secrets 
         WHERE gateway_account_id = $1;`,
        [gatewayAccountId]
      );
      const nextVersion = verRes.rows[0].next_ver;

      // 2. Move existing active secret to 'rotating' with 48h expiry
      await client.query(
        `UPDATE provider_webhook_secrets 
         SET status = 'rotating', expires_at = NOW() + INTERVAL '48 hours' 
         WHERE gateway_account_id = $1 AND status = 'active';`,
        [gatewayAccountId]
      );

      // 3. Insert new active webhook secret
      const insRes = await client.query(
        `INSERT INTO provider_webhook_secrets (
           gateway_account_id, version_number, 
           webhook_secret_encrypted, webhook_secret_iv, webhook_secret_auth_tag, 
           encryption_key_version, status, activated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
         RETURNING *;`,
        [
          gatewayAccountId,
          nextVersion,
          webhookSecretEncrypted,
          webhookSecretIv,
          webhookSecretAuthTag,
          encryptionKeyVersion
        ]
      );

      await client.query('COMMIT');
      return insRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Record test ping status on provider gateway account.
   */
  async updatePingStatus(gatewayAccountId, success, errorMessage = null) {
    const query = `
      UPDATE provider_gateway_accounts
      SET last_test_ping_at = NOW(),
          last_test_ping_status = $2,
          last_error_message = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = await pool.query(query, [
      gatewayAccountId,
      success ? 'success' : 'failed',
      errorMessage
    ]);
    return res.rows[0];
  }
};

