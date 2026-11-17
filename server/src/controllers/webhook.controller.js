import crypto from 'crypto';
import { ProviderGatewayService } from '../services/providerGateway.service.js';
import { pool } from '../config/database.js';
import { WebhookWorkerService } from '../services/webhookWorker.service.js';

/**
 * webhook.controller.js
 * 
 * High-durability Ingest-Persist-Acknowledge Webhook Controller.
 * Verifies HMAC signatures against account's active and rotating secrets.
 * Acknowledges Razorpay with HTTP 200 within 500ms target.
 */
export async function handleRazorpayWebhook(req, res) {
  const startTime = Date.now();
  const { providerSlug } = req.params;

  if (!providerSlug) {
    return res.status(400).json({ error: 'Provider slug parameter is required' });
  }

  // 1. Resolve Provider Gateway Account & Decrypted Secrets
  const accountData = await ProviderGatewayService.getDecryptedWebhookSecrets(providerSlug);
  if (!accountData || !accountData.gatewayAccount) {
    return res.status(404).json({ error: `Provider gateway account not found for slug "${providerSlug}"` });
  }

  const { gatewayAccount, secrets } = accountData;
  if (!secrets || secrets.length === 0) {
    return res.status(400).json({ error: `No active or rotating webhook secrets configured for account #${gatewayAccount.id}` });
  }

  // 2. Validate HMAC Signature
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  const rawBuffer = req.rawBody || Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body), 'utf8');

  let matchedSecretId = null;
  for (const s of secrets) {
    const expected = crypto.createHmac('sha256', s.secret).update(rawBuffer).digest('hex');
    if (expected === signature) {
      matchedSecretId = s.id;
      break;
    }
  }

  if (!matchedSecretId) {
    return res.status(401).json({ error: 'Webhook signature verification failed' });
  }

  // 3. Extract Reliable Event ID
  const body = (typeof req.body === 'object' && req.body !== null) ? req.body : JSON.parse(rawBuffer.toString('utf8'));
  const eventName = body.event || 'unknown';

  let eventId = req.headers['x-razorpay-event-id'] || body.id || body.event_id;
  if (!eventId) {
    const paymentId = body.payload?.payment?.entity?.id || 'nopay';
    eventId = crypto
      .createHash('sha256')
      .update(`${gatewayAccount.id}:${eventName}:${paymentId}:${body.created_at || Date.now()}`)
      .digest('hex');
  }

  // 4. Ingest-Persist: Insert into webhook_events
  try {
    const insertRes = await pool.query(
      `INSERT INTO webhook_events (
         gateway_account_id, event_id, webhook_secret_id, provider_id, gateway,
         event_name, payload, processing_status
       ) VALUES ($1, $2, $3, $4, 'razorpay', $5, $6, 'received')
       ON CONFLICT (gateway_account_id, event_id) DO NOTHING
       RETURNING id`,
      [
        gatewayAccount.id,
        eventId,
        matchedSecretId,
        gatewayAccount.provider_id,
        eventName,
        JSON.stringify(body)
      ]
    );

    const insertedId = insertRes.rows[0]?.id || null;

    // 5. HTTP Acknowledge within 500ms
    res.status(200).json({ received: true, eventId, duplicate: !insertedId });

    // 6. Asynchronously trigger worker processing in background
    if (insertedId) {
      setImmediate(() => {
        WebhookWorkerService.processPendingBatch().catch(err => {
          console.error('[WebhookIngest] Background batch processing error:', err.message);
        });
      });
    }
  } catch (dbErr) {
    console.error('[WebhookIngest] Failed to persist webhook event:', dbErr);
    return res.status(500).json({ error: 'Internal storage error during webhook persistence' });
  }
}

export default {
  handleRazorpayWebhook
};

