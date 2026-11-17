import { pool } from '../config/database.js';

/**
 * subscription.model.js
 * 
 * Direct database access layer for SaaS Subscription Plans,
 * User Subscriptions, Invoices, and Payment Attempts.
 */
export const SubscriptionModel = {
  /**
   * Fetches all subscription plans (active and optionally inactive).
   */
  async getAllPlans(includeInactive = false) {
    const query = `
      SELECT p.*,
             COUNT(s.id) FILTER (WHERE s.status = 'active') AS active_subscribers_count
      FROM subscription_plans p
      LEFT JOIN user_subscriptions s ON s.plan_id = p.id
      ${includeInactive ? '' : 'WHERE p.is_active = TRUE'}
      GROUP BY p.id
      ORDER BY p.display_order ASC, p.id ASC;
    `;
    const res = await pool.query(query);
    return res.rows.map(r => ({
      ...r,
      price_paise: Number(r.price_paise),
      active_subscribers_count: Number(r.active_subscribers_count || 0)
    }));
  },

  /**
   * Fetches plans applicable to a user role (e.g. 'all' + 'designer').
   */
  async getPlansForRole(role) {
    const query = `
      SELECT *
      FROM subscription_plans
      WHERE is_active = TRUE
        AND (target_role = 'all' OR target_role = $1)
      ORDER BY display_order ASC, id ASC;
    `;
    const res = await pool.query(query, [role]);
    return res.rows.map(r => ({ ...r, price_paise: Number(r.price_paise) }));
  },

  /**
   * Finds a plan by ID.
   */
  async getPlanById(id) {
    const query = `SELECT * FROM subscription_plans WHERE id = $1 LIMIT 1;`;
    const res = await pool.query(query, [id]);
    return res.rows[0] ? { ...res.rows[0], price_paise: Number(res.rows[0].price_paise) } : null;
  },

  /**
   * Finds a plan by its unique code.
   */
  async getPlanByCode(planCode) {
    const query = `SELECT * FROM subscription_plans WHERE plan_code = $1 LIMIT 1;`;
    const res = await pool.query(query, [planCode]);
    return res.rows[0] ? { ...res.rows[0], price_paise: Number(res.rows[0].price_paise) } : null;
  },

  /**
   * Creates a new subscription plan (Portal Admin).
   */
  async createPlan({
    planCode,
    name,
    targetRole = 'all',
    tier = 'pro',
    billingInterval = 'monthly',
    pricePaise = 0,
    features = [],
    limits = {},
    isActive = true,
    isPopular = false,
    displayOrder = 1
  }) {
    const query = `
      INSERT INTO subscription_plans (
        plan_code, name, target_role, tier, billing_interval,
        price_paise, features, limits, is_active, is_popular, display_order,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(query, [
      planCode,
      name,
      targetRole,
      tier,
      billingInterval,
      pricePaise,
      JSON.stringify(features),
      JSON.stringify(limits),
      isActive,
      isPopular,
      displayOrder
    ]);
    return { ...res.rows[0], price_paise: Number(res.rows[0].price_paise) };
  },

  /**
   * Updates an existing subscription plan.
   */
  async updatePlan(id, fields) {
    const updates = [];
    const values = [];
    let i = 1;

    if (fields.name !== undefined) { updates.push(`name = $${i++}`); values.push(fields.name); }
    if (fields.price_paise !== undefined) { updates.push(`price_paise = $${i++}`); values.push(fields.price_paise); }
    if (fields.features !== undefined) { updates.push(`features = $${i++}`); values.push(JSON.stringify(fields.features)); }
    if (fields.limits !== undefined) { updates.push(`limits = $${i++}`); values.push(JSON.stringify(fields.limits)); }
    if (fields.is_active !== undefined) { updates.push(`is_active = $${i++}`); values.push(fields.is_active); }
    if (fields.is_popular !== undefined) { updates.push(`is_popular = $${i++}`); values.push(fields.is_popular); }
    if (fields.display_order !== undefined) { updates.push(`display_order = $${i++}`); values.push(fields.display_order); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE subscription_plans
      SET ${updates.join(', ')}
      WHERE id = $${i}
      RETURNING *;
    `;
    const res = await pool.query(query, values);
    return res.rows[0] ? { ...res.rows[0], price_paise: Number(res.rows[0].price_paise) } : null;
  },

  /**
   * Soft-deactivates a plan without destructive deletion.
   */
  async deactivatePlan(id) {
    const query = `
      UPDATE subscription_plans
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  },

  /**
   * Gets the currently active subscription for a user.
   */
  async getActiveSubscriptionForUser(userId) {
    const query = `
      SELECT s.*, p.name as plan_name, p.plan_code, p.tier as plan_tier, p.target_role
      FROM user_subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.id DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows[0] ? { ...res.rows[0], price_paise: Number(res.rows[0].price_paise) } : null;
  },

  /**
   * Gets subscription history for a user.
   */
  async getUserSubscriptionHistory(userId) {
    const query = `
      SELECT s.*, p.name as plan_name, p.plan_code, p.tier as plan_tier
      FROM user_subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.user_id = $1
      ORDER BY s.id DESC;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows.map(r => ({ ...r, price_paise: Number(r.price_paise) }));
  },

  /**
   * Creates an invoice in 'pending' status with period dates.
   */
  async createInvoice({ userSubscriptionId, userId, amountPaise, periodStart, periodEnd }) {
    const invNumber = `SUB-INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const query = `
      INSERT INTO subscription_invoices (
        user_subscription_id, user_id, invoice_number, amount_paise,
        currency, period_start, period_end, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'INR', $5, $6, 'pending', NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(query, [
      userSubscriptionId,
      userId,
      invNumber,
      amountPaise,
      periodStart,
      periodEnd
    ]);
    return { ...res.rows[0], amount_paise: Number(res.rows[0].amount_paise) };
  },

  /**
   * Records a subscription payment attempt.
   */
  async createPaymentAttempt({
    userId,
    subscriptionId,
    invoiceId,
    planId,
    idempotencyKey,
    receipt,
    amountPaise,
    razorpayOrderId = null,
    status = 'creating'
  }) {
    const query = `
      INSERT INTO subscription_payment_attempts (
        user_id, subscription_id, invoice_id, plan_id,
        idempotency_key, receipt, amount_paise, currency,
        razorpay_order_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR', $8, $9, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(query, [
      userId,
      subscriptionId,
      invoiceId,
      planId,
      idempotencyKey,
      receipt,
      amountPaise,
      razorpayOrderId,
      status
    ]);
    return { ...res.rows[0], amount_paise: Number(res.rows[0].amount_paise) };
  },

  /**
   * Updates a payment attempt with Razorpay order/payment details.
   */
  async updatePaymentAttempt(id, { razorpayOrderId, razorpayPaymentId, status, rawResponse, failureReason }) {
    const updates = [];
    const values = [];
    let i = 1;

    if (razorpayOrderId !== undefined) { updates.push(`razorpay_order_id = $${i++}`); values.push(razorpayOrderId); }
    if (razorpayPaymentId !== undefined) { updates.push(`razorpay_payment_id = $${i++}`); values.push(razorpayPaymentId); }
    if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
    if (rawResponse !== undefined) { updates.push(`raw_response = $${i++}`); values.push(JSON.stringify(rawResponse)); }
    if (failureReason !== undefined) { updates.push(`failure_reason = $${i++}`); values.push(failureReason); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE subscription_payment_attempts
      SET ${updates.join(', ')}
      WHERE id = $${i}
      RETURNING *;
    `;
    const res = await pool.query(query, values);
    return res.rows[0] ? { ...res.rows[0], amount_paise: Number(res.rows[0].amount_paise) } : null;
  },

  /**
   * Fetches all subscribers with plan details for Portal Admin.
   */
  async getAllSubscribers() {
    const query = `
      SELECT u.id as user_id, u.name, u.email, u.role, u.status as user_status,
             s.id as subscription_id, COALESCE(s.status, 'active') as subscription_status,
             s.price_paise, s.billing_interval, s.starts_at, s.expires_at,
             s.grant_type, s.grant_reason,
             pl.name as plan_name, pl.plan_code, pl.tier as plan_tier, pl.id as plan_id
      FROM users u
      LEFT JOIN LATERAL (
        SELECT sub.id, sub.status, sub.price_paise, sub.billing_interval, sub.starts_at, sub.expires_at,
               sub.grant_type, sub.grant_reason, sub.plan_id
        FROM user_subscriptions sub
        WHERE sub.user_id = u.id
        ORDER BY sub.id DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN subscription_plans pl ON pl.id = s.plan_id
      WHERE u.role IN ('print_provider', 'designer')
      ORDER BY u.id ASC;
    `;
    const res = await pool.query(query);
    return res.rows.map(r => ({
      ...r,
      price_paise: Number(r.price_paise || 0)
    }));
  },

  /**
   * Calculates subscription KPI stats for Portal Admin Dashboard.
   * Excludes free starter and complimentary admin grants from MRR.
   */
  async getSubscriberStats() {
    const query = `
      SELECT 
        COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'active' AND p.price_paise > 0 AND s.grant_type != 'complimentary') AS active_paid_subscribers,
        COALESCE(SUM(p.price_paise) FILTER (WHERE s.status = 'active' AND p.price_paise > 0 AND s.grant_type != 'complimentary'), 0) AS mrr_paise,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'print_provider') AS total_providers,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'designer') AS total_designers,
        COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'active' AND u.role = 'print_provider' AND p.tier != 'none') AS active_paid_providers,
        COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'active' AND u.role = 'designer' AND p.tier != 'none') AS active_paid_designers
      FROM users u
      LEFT JOIN user_subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      WHERE u.role IN ('print_provider', 'designer');
    `;
    const res = await pool.query(query);
    const row = res.rows[0];
    return {
      activePaidSubscribers: Number(row.active_paid_subscribers || 0),
      mrrPaise: Number(row.mrr_paise || 0),
      mrrRupees: Number(row.mrr_paise || 0) / 100,
      totalProviders: Number(row.total_providers || 0),
      totalDesigners: Number(row.total_designers || 0),
      activePaidProviders: Number(row.active_paid_providers || 0),
      activePaidDesigners: Number(row.active_paid_designers || 0)
    };
  },

  /**
   * Fetches all subscription invoices joined with user, plan, and payment attempt details.
   */
  async getAllInvoices({ search = '', status = '', role = '', limit = 50, offset = 0 } = {}) {
    const whereClauses = [];
    const values = [];
    let i = 1;

    if (status && status !== 'all') {
      whereClauses.push(`i.status = $${i++}`);
      values.push(status);
    }

    if (role && role !== 'all') {
      whereClauses.push(`u.role = $${i++}`);
      values.push(role);
    }

    if (search && search.trim()) {
      whereClauses.push(`(
        u.name ILIKE $${i} OR
        u.email ILIKE $${i} OR
        i.invoice_number ILIKE $${i} OR
        pa.razorpay_payment_id ILIKE $${i} OR
        p.name ILIKE $${i}
      )`);
      values.push(`%${search.trim()}%`);
      i++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        i.id,
        i.invoice_number,
        i.amount_paise,
        i.currency,
        i.period_start,
        i.period_end,
        i.status,
        i.created_at,
        i.updated_at,
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        p.id AS plan_id,
        p.name AS plan_name,
        p.plan_code,
        p.tier AS plan_tier,
        COALESCE(s.billing_interval, p.billing_interval, 'monthly') AS billing_interval,
        s.starts_at AS subscription_starts_at,
        s.expires_at AS subscription_expires_at,
        pa.razorpay_order_id,
        pa.razorpay_payment_id,
        pa.status AS payment_status,
        pa.updated_at AS paid_at
      FROM subscription_invoices i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN user_subscriptions s ON s.id = i.user_subscription_id
      LEFT JOIN subscription_plans p ON p.id = COALESCE(s.plan_id, (
        SELECT plan_id FROM subscription_payment_attempts WHERE invoice_id = i.id LIMIT 1
      ))
      LEFT JOIN subscription_payment_attempts pa ON pa.invoice_id = i.id
      ${whereStr}
      ORDER BY i.id DESC
      LIMIT $${i++} OFFSET $${i++};
    `;
    values.push(limit, offset);

    const countQuery = `
      SELECT COUNT(DISTINCT i.id) as total_count
      FROM subscription_invoices i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN user_subscriptions s ON s.id = i.user_subscription_id
      LEFT JOIN subscription_plans p ON p.id = COALESCE(s.plan_id, (
        SELECT plan_id FROM subscription_payment_attempts WHERE invoice_id = i.id LIMIT 1
      ))
      LEFT JOIN subscription_payment_attempts pa ON pa.invoice_id = i.id
      ${whereStr};
    `;

    const [rowsRes, countRes] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, values.length - 2))
    ]);

    return {
      invoices: rowsRes.rows.map(r => ({
        ...r,
        amount_paise: Number(r.amount_paise || 0),
        amount_rupees: Number(r.amount_paise || 0) / 100
      })),
      totalCount: Number(countRes.rows[0]?.total_count || 0)
    };
  },

  /**
   * Fetches unified revenue metrics combining SaaS subscriptions and retail order commissions.
   */
  async getUnifiedRevenueStats() {
    const subRes = await pool.query(`
      SELECT 
        COALESCE(SUM(amount_paise), 0) as total_subscription_paise,
        COUNT(id) as total_paid_invoices
      FROM subscription_invoices
      WHERE status = 'paid'
    `);
    const totalSubPaise = Number(subRes.rows[0]?.total_subscription_paise || 0);

    const orderRes = await pool.query(`
      SELECT 
        COALESCE(SUM(platform_fee_cents), 0) as total_retail_commission_cents,
        COUNT(id) as total_orders
      FROM orders
      WHERE payment_status = 'paid' OR status IN ('paid', 'shipped', 'delivered', 'processing', 'in_production')
    `);
    const totalOrderCents = Number(orderRes.rows[0]?.total_retail_commission_cents || 0);

    const stats = await this.getSubscriberStats();

    return {
      subscription_revenue_paise: totalSubPaise,
      subscription_revenue_rupees: totalSubPaise / 100,
      retail_commission_cents: totalOrderCents,
      retail_commission_rupees: totalOrderCents / 100,
      total_platform_revenue_rupees: (totalSubPaise + totalOrderCents) / 100,
      total_paid_invoices: Number(subRes.rows[0]?.total_paid_invoices || 0),
      total_retail_orders: Number(orderRes.rows[0]?.total_orders || 0),
      ...stats
    };
  }
};

