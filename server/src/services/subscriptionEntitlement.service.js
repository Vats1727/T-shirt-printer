import { pool } from '../config/database.js';
import { SubscriptionModel } from '../models/subscription.model.js';

const STARTER_LIMITS = {
  max_products: 10,
  max_designs: 10,
  canvas_export: 'standard',
  priority_routing: false
};

/**
 * subscriptionEntitlement.service.js
 * 
 * Enforces SaaS plan quotas and feature entitlements on backend operations:
 * - Product blank listing limits
 * - Design upload quotas
 * - Canvas export quality checks
 * - Background expiry and graceful downgrade to Starter
 */
export const SubscriptionEntitlementService = {
  /**
   * Resolves the effective limits and entitlements for a user.
   */
  async getUserEntitlements(userId) {
    const sub = await SubscriptionModel.getActiveSubscriptionForUser(userId);
    if (!sub || (sub.expires_at && new Date(sub.expires_at) <= new Date())) {
      return {
        tier: 'none',
        planName: 'Starter Partner (Free)',
        status: sub ? 'expired' : 'active',
        limits: STARTER_LIMITS,
        expiresAt: null
      };
    }

    const limits = sub.plan_snapshot?.limits || STARTER_LIMITS;
    return {
      tier: sub.plan_tier || 'none',
      planName: sub.plan_name,
      status: sub.status,
      limits,
      expiresAt: sub.expires_at
    };
  },

  /**
   * Enforces product listing quota before creating a product.
   */
  async assertCanCreateProduct(userId) {
    const { limits, tier, planName } = await this.getUserEntitlements(userId);
    const maxProducts = limits.max_products ?? 10;

    // -1 represents unlimited
    if (maxProducts === -1) return true;

    const countRes = await pool.query(
      `SELECT COUNT(*) as count 
       FROM products_full 
       WHERE owner_id = $1 AND COALESCE(is_deleted, false) = false`,
      [userId]
    );
    const currentCount = Number(countRes.rows[0].count);

    if (currentCount >= maxProducts) {
      const err = new Error(
        `Subscription quota reached: Your plan "${planName}" allows up to ${maxProducts} garment listings (currently ${currentCount}). Please upgrade to add more.`
      );
      err.statusCode = 403;
      err.code = 'SUBSCRIPTION_LIMIT_REACHED';
      throw err;
    }
    return true;
  },

  /**
   * Enforces design upload quota for designers.
   */
  async assertCanUploadDesign(userId) {
    const { limits, tier, planName } = await this.getUserEntitlements(userId);
    const maxDesigns = limits.max_designs ?? 10;

    if (maxDesigns === -1) return true;

    const countRes = await pool.query(
      `SELECT COUNT(*) as count 
       FROM designs 
       WHERE owner_id = $1`,
      [userId]
    );
    const currentCount = Number(countRes.rows[0].count);

    if (currentCount >= maxDesigns) {
      const err = new Error(
        `Design quota reached: Your plan "${planName}" allows up to ${maxDesigns} designs (currently ${currentCount}). Please upgrade to Pro Designer to upload unlimited designs.`
      );
      err.statusCode = 403;
      err.code = 'SUBSCRIPTION_LIMIT_REACHED';
      throw err;
    }
    return true;
  },

  /**
   * Background sweep that transitions overdue subscriptions to expired and restores Starter defaults.
   */
  async expireOverdueSubscriptions() {
    if (!pool) return 0;
    const client = await pool.connect();
    let expiredCount = 0;

    try {
      await client.query('BEGIN');

      // 1. Find overdue active subscriptions
      const overdueRes = await client.query(
        `SELECT id, user_id 
         FROM user_subscriptions 
         WHERE status = 'active' 
           AND expires_at IS NOT NULL 
           AND expires_at <= NOW() 
         FOR UPDATE`
      );

      for (const row of overdueRes.rows) {
        // Mark subscription expired
        await client.query(
          `UPDATE user_subscriptions 
           SET status = 'expired', updated_at = NOW() 
           WHERE id = $1`,
          [row.id]
        );

        // Reset user compatibility columns
        await client.query(
          `UPDATE users 
           SET subscription_tier = 'none', subscription_expiry = NULL, updated_at = NOW() 
           WHERE id = $1`,
          [row.user_id]
        );

        // Ensure active Starter plan exists
        const starterPlanRes = await client.query(`SELECT * FROM subscription_plans WHERE plan_code = 'starter' LIMIT 1`);
        const starterPlan = starterPlanRes.rows[0];

        if (starterPlan) {
          await client.query(
            `INSERT INTO user_subscriptions (
               user_id, plan_id, status, billing_interval, price_paise, currency,
               plan_snapshot, starts_at, expires_at, grant_type, grant_reason, created_at, updated_at
             ) VALUES ($1, $2, 'active', 'lifetime', 0, 'INR', $3, NOW(), NULL, 'system_default', 'Downgrade to Starter after plan expiry', NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            [row.user_id, starterPlan.id, JSON.stringify({ limits: STARTER_LIMITS })]
          );
        }

        expiredCount++;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[SubscriptionEntitlement] Expiry check error:', err.message);
    } finally {
      client.release();
    }

    return expiredCount;
  }
};

