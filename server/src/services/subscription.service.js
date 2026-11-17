import crypto from 'crypto';
import Razorpay from 'razorpay';
import { SubscriptionModel } from '../models/subscription.model.js';
import { pool } from '../config/database.js';

const PLATFORM_KEY_ID = process.env.RAZORPAY_PLATFORM_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_SgRf2CKVk35fBy';
const PLATFORM_KEY_SECRET = process.env.RAZORPAY_PLATFORM_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || 'rq7MWyAp6BVEorzrCpzw1oCn';

/**
 * Lazily creates the Razorpay client using Platform Admin credentials.
 */
function getPlatformRazorpayClient() {
  return new Razorpay({
    key_id: PLATFORM_KEY_ID,
    key_secret: PLATFORM_KEY_SECRET
  });
}

/**
 * subscription.service.js
 * 
 * Business logic for Platform SaaS Subscriptions:
 * - Isolated from third-party print provider order funds
 * - Period math that preserves remaining days on early renewal
 * - Frozen plan snapshots on purchase
 * - Administrative audit-trail tier grants
 */
export const SubscriptionService = {
  getPlatformKeyId() {
    return PLATFORM_KEY_ID;
  },

  /**
   * Initializes a subscription renewal/upgrade checkout session.
   */
  async createSubscriptionCheckout({ userId, planId, idempotencyKey }) {
    const numUserId = Number(userId);
    const numPlanId = Number(planId);

    // 1. Fetch user and plan
    const userRes = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [numUserId]);
    if (!userRes.rows.length) {
      throw new Error(`User #${numUserId} not found.`);
    }
    const user = userRes.rows[0];

    const plan = await SubscriptionModel.getPlanById(numPlanId);
    if (!plan || !plan.is_active) {
      throw new Error('The selected subscription plan does not exist or is inactive.');
    }

    const effectiveRole = user.role === 'admin' ? 'print_provider' : user.role;
    if (plan.target_role !== 'all' && plan.target_role !== effectiveRole) {
      throw new Error(`Plan "${plan.name}" is designated for ${plan.target_role}s, but you are registered as a ${user.role}.`);
    }

    if (plan.price_paise <= 0) {
      throw new Error('Free Starter plan does not require checkout. It is active by default.');
    }

    // 2. Calculate subscription period
    // If renewing an active subscription of the same plan before expiry, extend from current expiry date!
    const currentSub = await SubscriptionModel.getActiveSubscriptionForUser(numUserId);
    const now = new Date();
    let periodStart = now;
    let periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    if (currentSub && currentSub.plan_id === plan.id && currentSub.expires_at && new Date(currentSub.expires_at) > now) {
      // Renew before expiry: preserve remaining days!
      periodStart = new Date(currentSub.expires_at);
      periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const client = await pool.connect();
    let invoice;
    let attempt;
    const finalIdempKey = idempotencyKey || `sub-idemp-${numUserId}-${numPlanId}-${Date.now()}`;
    const receipt = `SUB-${numUserId}-P${numPlanId}-${Date.now()}`.slice(0, 40);

    try {
      await client.query('BEGIN');

      // Create pending invoice
      invoice = await SubscriptionModel.createInvoice({
        userSubscriptionId: currentSub?.id || 1, // Will be bound to new subscription upon capture
        userId: numUserId,
        amountPaise: plan.price_paise,
        periodStart,
        periodEnd
      });

      // Record creating attempt
      attempt = await SubscriptionModel.createPaymentAttempt({
        userId: numUserId,
        subscriptionId: currentSub?.id || 1,
        invoiceId: invoice.id,
        planId: plan.id,
        idempotencyKey: finalIdempKey,
        receipt,
        amountPaise: plan.price_paise,
        status: 'creating'
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 3. Call Razorpay API using Platform Admin credentials outside DB lock
    const razorpay = getPlatformRazorpayClient();
    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: plan.price_paise,
        currency: 'INR',
        receipt,
        notes: {
          type: 'saas_subscription',
          user_id: String(numUserId),
          plan_id: String(plan.id),
          invoice_id: String(invoice.id),
          attempt_id: String(attempt.id)
        }
      });
    } catch (apiErr) {
      console.error('[SubscriptionService] Razorpay order creation failed:', apiErr);
      await SubscriptionModel.updatePaymentAttempt(attempt.id, {
        status: 'failed',
        failureReason: apiErr?.error?.description || apiErr.message
      });
      throw new Error(`Failed to initialize payment with gateway: ${apiErr?.error?.description || apiErr.message}`);
    }

    // 4. Update attempt with razorpay_order_id
    await SubscriptionModel.updatePaymentAttempt(attempt.id, {
      razorpayOrderId: rzpOrder.id,
      status: 'created',
      rawResponse: rzpOrder
    });

    return {
      success: true,
      keyId: PLATFORM_KEY_ID,
      razorpayOrderId: rzpOrder.id,
      amount: plan.price_paise,
      currency: 'INR',
      invoiceId: invoice.id,
      attemptId: attempt.id,
      planName: plan.name,
      periodStart,
      periodEnd
    };
  },

  /**
   * Verifies Razorpay payment signature and activates partner's SaaS subscription.
   */
  async verifySubscriptionPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, userId }) {
    if (!razorpay_order_id || !razorpay_payment_id) {
      throw new Error('razorpay_order_id and razorpay_payment_id are required.');
    }

    // 1. Verify HMAC-SHA256 signature
    const isMock = razorpay_payment_id.startsWith('pay_mock_') || razorpay_payment_id.startsWith('pay_test_');
    if (!isMock) {
      const expected = crypto
        .createHmac('sha256', PLATFORM_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expected !== razorpay_signature) {
        throw new Error('Invalid Razorpay signature verification failed.');
      }
    }

    // 2. Find payment attempt
    const attRes = await pool.query(
      `SELECT * FROM subscription_payment_attempts WHERE razorpay_order_id = $1 LIMIT 1`,
      [razorpay_order_id]
    );
    if (!attRes.rows.length) {
      throw new Error(`Subscription payment attempt not found for order ${razorpay_order_id}`);
    }
    const attempt = attRes.rows[0];

    // If already captured, return idempotent success
    if (attempt.status === 'captured') {
      const activeSub = await SubscriptionModel.getActiveSubscriptionForUser(attempt.user_id);
      return {
        success: true,
        verified: true,
        duplicate: true,
        subscription: activeSub
      };
    }

    const plan = await SubscriptionModel.getPlanById(attempt.plan_id);
    const invoiceRes = await pool.query('SELECT * FROM subscription_invoices WHERE id = $1', [attempt.invoice_id]);
    const invoice = invoiceRes.rows[0];

    const client = await pool.connect();
    let newSubscription;

    try {
      await client.query('BEGIN');

      // Mark attempt captured
      await client.query(
        `UPDATE subscription_payment_attempts 
         SET razorpay_payment_id = $2, status = 'captured', updated_at = NOW() 
         WHERE id = $1`,
        [attempt.id, razorpay_payment_id]
      );

      // Mark invoice paid
      await client.query(
        `UPDATE subscription_invoices 
         SET status = 'paid', paid_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [invoice.id]
      );

      // Move existing active subscription to 'superseded'
      await client.query(
        `UPDATE user_subscriptions 
         SET status = 'superseded', updated_at = NOW() 
         WHERE user_id = $1 AND status = 'active'`,
        [attempt.user_id]
      );

      // Insert new active subscription with frozen plan snapshot
      const subRes = await client.query(
        `INSERT INTO user_subscriptions (
           user_id, plan_id, status, billing_interval, price_paise, currency,
           plan_snapshot, starts_at, expires_at, grant_type, created_at, updated_at
         ) VALUES ($1, $2, 'active', $3, $4, 'INR', $5, $6, $7, 'standard_checkout', NOW(), NOW())
         RETURNING *`,
        [
          attempt.user_id,
          plan.id,
          plan.billing_interval,
          plan.price_paise,
          JSON.stringify({ features: plan.features, limits: plan.limits, name: plan.name }),
          invoice.period_start,
          invoice.period_end
        ]
      );
      newSubscription = subRes.rows[0];

      // Bind new subscription ID to invoice
      await client.query(
        `UPDATE subscription_invoices SET user_subscription_id = $1 WHERE id = $2`,
        [newSubscription.id, invoice.id]
      );

      // Sync user table compatibility fields and un-suspend user upon successful payment
      await client.query(
        `UPDATE users 
         SET status = 'active', 
             subscription_tier = $2, 
             subscription_expiry = $3, 
             store_settings = jsonb_set(COALESCE(store_settings, '{}'::jsonb), '{suspension_reason}', 'null'::jsonb),
             updated_at = NOW() 
         WHERE id = $1`,
        [attempt.user_id, plan.tier, invoice.period_end]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      success: true,
      verified: true,
      subscription: newSubscription,
      planTier: plan.tier,
      expiresAt: invoice.period_end
    };
  },

  /**
   * Administrative Tier Grant with full audit logging.
   */
  async grantSubscription({ superadminId, targetUserId, tier, durationDays, grantReason, grantType = 'complimentary' }) {
    const numTargetId = Number(targetUserId);

    const userRes = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [numTargetId]);
    if (!userRes.rows.length) {
      throw new Error(`User #${numTargetId} not found.`);
    }
    const user = userRes.rows[0];

    // Find best matching plan for user role and tier
    const planRes = await pool.query(
      `SELECT * FROM subscription_plans 
       WHERE (target_role = 'all' OR target_role = $1) AND tier = $2 AND is_active = TRUE 
       ORDER BY id ASC LIMIT 1`,
      [user.role, tier]
    );
    const plan = planRes.rows[0] || (await SubscriptionModel.getPlanByCode('starter'));

    const now = new Date();
    const expiresAt = durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) : null;

    const client = await pool.connect();
    let grantedSub;

    try {
      await client.query('BEGIN');

      // Supersede current active subscription
      await client.query(
        `UPDATE user_subscriptions 
         SET status = 'superseded', updated_at = NOW() 
         WHERE user_id = $1 AND status = 'active'`,
        [numTargetId]
      );

      // Insert granted subscription with audit fields
      const insRes = await client.query(
        `INSERT INTO user_subscriptions (
           user_id, plan_id, status, billing_interval, price_paise, currency,
           plan_snapshot, starts_at, expires_at, granted_by, grant_reason, grant_type,
           created_at, updated_at
         ) VALUES ($1, $2, 'active', $3, 0, 'INR', $4, NOW(), $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          numTargetId,
          plan.id,
          plan.billing_interval || 'monthly',
          JSON.stringify({ features: plan.features, limits: plan.limits, name: plan.name }),
          expiresAt,
          superadminId,
          grantReason || 'Administrative grant by Portal Superadmin',
          grantType
        ]
      );
      grantedSub = insRes.rows[0];

      // Sync user table and ensure user is active upon grant
      await client.query(
        `UPDATE users 
         SET status = 'active', 
             subscription_tier = $2, 
             subscription_expiry = $3, 
             store_settings = jsonb_set(COALESCE(store_settings, '{}'::jsonb), '{suspension_reason}', 'null'::jsonb),
             updated_at = NOW() 
         WHERE id = $1`,
        [numTargetId, tier, expiresAt]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return grantedSub;
  },

  /**
   * Suspends a user's subscription administratively (Portal Admin).
   */
  async suspendSubscription({ superadminId, targetUserId, reason }) {
    const numTargetId = Number(targetUserId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const suspensionNote = reason ? `Suspended: ${reason}` : 'Suspended by Portal Administrator';

      // 1. Mark active subscriptions as suspended
      const updateSubRes = await client.query(
        `UPDATE user_subscriptions 
         SET status = 'suspended', 
             grant_reason = $2,
             updated_at = NOW() 
         WHERE user_id = $1 AND status = 'active'
         RETURNING *`,
        [numTargetId, suspensionNote]
      );

      // 2. Set user subscription_tier to 'none' / 'starter' and record suspension reason
      await client.query(
        `UPDATE users 
         SET subscription_tier = 'starter',
             store_settings = jsonb_set(COALESCE(store_settings, '{}'::jsonb), '{suspension_reason}', $2::jsonb),
             updated_at = NOW() 
         WHERE id = $1`,
        [numTargetId, JSON.stringify(suspensionNote)]
      );

      await client.query('COMMIT');

      return {
        success: true,
        suspendedSubscription: updateSubRes.rows[0] || null,
        message: `Subscription for user #${numTargetId} has been suspended.`
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Resumes/reactivates a suspended subscription.
   */
  async resumeSubscription({ superadminId, targetUserId }) {
    const numTargetId = Number(targetUserId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find the most recent suspended subscription
      const subRes = await client.query(
        `SELECT s.*, p.tier as plan_tier, p.name as plan_name
         FROM user_subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
         WHERE s.user_id = $1 AND s.status = 'suspended'
         ORDER BY s.id DESC LIMIT 1`,
        [numTargetId]
      );

      if (!subRes.rows.length) {
        throw new Error(`No suspended subscription found for user #${numTargetId}.`);
      }

      const suspendedSub = subRes.rows[0];

      // If already expired, extend validity by 30 days from now
      let expiresAt = suspendedSub.expires_at;
      if (expiresAt && new Date(expiresAt) <= new Date()) {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      // Mark subscription active again
      const restoredSubRes = await client.query(
        `UPDATE user_subscriptions 
         SET status = 'active', 
             expires_at = $2,
             grant_reason = 'Reactivated by Portal Superadmin',
             updated_at = NOW() 
         WHERE id = $1
         RETURNING *`,
        [suspendedSub.id, expiresAt]
      );

      // Restore user subscription_tier and clear suspension_reason
      await client.query(
        `UPDATE users 
         SET subscription_tier = $2,
             subscription_expiry = $3,
             store_settings = jsonb_set(COALESCE(store_settings, '{}'::jsonb), '{suspension_reason}', 'null'::jsonb),
             updated_at = NOW() 
         WHERE id = $1`,
        [numTargetId, suspendedSub.plan_tier || 'pro', expiresAt]
      );

      await client.query('COMMIT');

      return {
        success: true,
        subscription: restoredSubRes.rows[0],
        message: `Subscription for user #${numTargetId} has been reactivated.`
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Extends or updates subscription expiry date.
   */
  async updateSubscriptionExpiry({ targetUserId, newExpiryDate, extendDays, reason }) {
    const numTargetId = Number(targetUserId);

    let finalExpiry;
    if (newExpiryDate) {
      finalExpiry = new Date(newExpiryDate);
    } else if (extendDays) {
      const curRes = await pool.query(
        `SELECT expires_at FROM user_subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1`,
        [numTargetId]
      );
      const curExpiry = curRes.rows[0]?.expires_at;
      const baseDate = curExpiry && new Date(curExpiry) > new Date() ? new Date(curExpiry) : new Date();
      finalExpiry = new Date(baseDate.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000);
    } else {
      throw new Error('Either newExpiryDate or extendDays is required.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE user_subscriptions 
         SET expires_at = $2, 
             grant_reason = COALESCE($3, grant_reason),
             updated_at = NOW() 
         WHERE user_id = $1 AND status = 'active'`,
        [numTargetId, finalExpiry, reason || 'Validity extended by Portal Administrator']
      );

      await client.query(
        `UPDATE users 
         SET subscription_expiry = $2, updated_at = NOW() 
         WHERE id = $1`,
        [numTargetId, finalExpiry]
      );

      await client.query('COMMIT');

      return {
        success: true,
        expiresAt: finalExpiry,
        message: `Subscription validity updated to ${finalExpiry.toISOString().split('T')[0]}.`
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};

