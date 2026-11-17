import { pool } from '../config/database.js';

/**
 * SubscriptionExpiryWorker
 * 
 * Periodically sweeps PostgreSQL for expired user subscriptions (including 7-day trials).
 * Automatically marks expired subscriptions as 'expired', and transitions the user's status 
 * to 'suspended' with suspension_reason='trial_expired' so that portal paywall enforcement 
 * takes effect.
 */
export class SubscriptionExpiryWorker {
  static intervalId = null;

  static async runSweep() {
    if (!pool) return;
    try {
      // 1. Transition active subscriptions whose expiry timestamp has passed
      const expiredSubs = await pool.query(`
        UPDATE user_subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
        RETURNING user_id, plan_id, billing_interval, expires_at
      `);

      if (expiredSubs.rows.length > 0) {
        const userIds = expiredSubs.rows.map((r) => r.user_id);
        console.log(`[SubscriptionExpiryWorker] Expired ${expiredSubs.rows.length} subscriptions for users:`, userIds);

        // 2. Suspend users with trial_expired flag
        await pool.query(`
          UPDATE users
          SET status = 'suspended',
              store_settings = jsonb_set(
                COALESCE(store_settings, '{}'::jsonb),
                '{suspension_reason}',
                '"trial_expired"'::jsonb
              ),
              updated_at = NOW()
          WHERE id = ANY($1::int[])
            AND role IN ('print_provider', 'designer', 'admin')
        `, [userIds]);
      }
    } catch (err) {
      console.error('[SubscriptionExpiryWorker] Error running sweep:', err.message);
    }
  }

  /**
   * Starts recurring background sweep.
   * Default interval: 10 minutes (600,000 ms).
   */
  static start(intervalMs = 10 * 60 * 1000) {
    if (this.intervalId) return;
    console.log('[SubscriptionExpiryWorker] Starting background subscription expiry worker...');
    this.runSweep().catch(() => {});
    this.intervalId = setInterval(() => {
      this.runSweep().catch(() => {});
    }, intervalMs);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

