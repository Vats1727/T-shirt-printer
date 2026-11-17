import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { SubscriptionModel } from '../models/subscription.model.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { SubscriptionEntitlementService } from '../services/subscriptionEntitlement.service.js';
import { pool } from '../config/database.js';

const PLATFORM_WEBHOOK_SECRET = process.env.RAZORPAY_PLATFORM_WEBHOOK_SECRET || 'platform_whsec_test_sub_2026';

/**
 * subscription.controller.js
 * 
 * Endpoints for:
 * 1. Partner plan viewing & Razorpay checkout
 * 2. Portal Admin plan management, subscriber ledger & tier grants
 * 3. Isolated Platform Webhook Ingress
 */

// -----------------------------------------------------------------------------
// Partner Endpoints
// -----------------------------------------------------------------------------

export async function getPlans(req, res, next) {
  try {
    let role = req.user?.role || req.query?.role;
    if (!role || role === 'all') {
      const auth = req.headers.authorization;
      if (auth) {
        try {
          const [, token] = auth.split(' ');
          const decoded = jwt.decode(token);
          if (decoded?.role) role = decoded.role;
        } catch {}
      }
    }
    if (!role || role === 'all') {
      role = 'print_provider';
    }
    const effectiveRole = role === 'admin' ? 'print_provider' : role;
    const plans = await SubscriptionModel.getPlansForRole(effectiveRole);
    return res.json({ success: true, plans, role: effectiveRole });
  } catch (err) {
    next(err);
  }
}

export async function getMySubscription(req, res, next) {
  try {
    const userId = req.user.id || req.user.sub;
    const activeSub = await SubscriptionModel.getActiveSubscriptionForUser(userId);
    const entitlements = await SubscriptionEntitlementService.getUserEntitlements(userId);
    const history = await SubscriptionModel.getUserSubscriptionHistory(userId);

    return res.json({
      success: true,
      subscription: activeSub,
      entitlements,
      history
    });
  } catch (err) {
    next(err);
  }
}

export async function checkoutOrder(req, res, next) {
  try {
    const userId = req.user.id || req.user.sub;
    const { planId, idempotencyKey } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required' });
    }

    const session = await SubscriptionService.createSubscriptionCheckout({
      userId,
      planId,
      idempotencyKey
    });

    return res.json(session);
  } catch (err) {
    if (err.message && (err.message.includes('not found') || err.message.includes('designated for'))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const userId = req.user.id || req.user.sub;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const result = await SubscriptionService.verifySubscriptionPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// -----------------------------------------------------------------------------
// Portal Admin Endpoints
// -----------------------------------------------------------------------------

export async function portalGetPlans(req, res, next) {
  try {
    const plans = await SubscriptionModel.getAllPlans(true);
    return res.json({ success: true, plans });
  } catch (err) {
    next(err);
  }
}

export async function portalCreatePlan(req, res, next) {
  try {
    const {
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
    } = req.body;

    if (!planCode || !name) {
      return res.status(400).json({ success: false, message: 'planCode and name are required' });
    }

    const plan = await SubscriptionModel.createPlan({
      planCode,
      name,
      targetRole,
      tier,
      billingInterval,
      pricePaise,
      features,
      limits,
      isActive,
      isPopular,
      displayOrder
    });

    return res.status(201).json({ success: true, plan });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: `Plan with code "${req.body.planCode}" already exists.` });
    }
    next(err);
  }
}

export async function portalUpdatePlan(req, res, next) {
  try {
    const id = Number(req.params.id);
    const updated = await SubscriptionModel.updatePlan(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: `Plan #${id} not found` });
    }
    return res.json({ success: true, plan: updated });
  } catch (err) {
    next(err);
  }
}

export async function portalDeactivatePlan(req, res, next) {
  try {
    const id = Number(req.params.id);
    const deactivated = await SubscriptionModel.deactivatePlan(id);
    if (!deactivated) {
      return res.status(404).json({ success: false, message: `Plan #${id} not found` });
    }
    return res.json({ success: true, message: `Plan #${id} deactivated successfully`, plan: deactivated });
  } catch (err) {
    next(err);
  }
}

export async function portalGetSubscribers(req, res, next) {
  try {
    const subscribers = await SubscriptionModel.getAllSubscribers();
    return res.json({ success: true, subscribers });
  } catch (err) {
    next(err);
  }
}

export async function portalGetStats(req, res, next) {
  try {
    const stats = await SubscriptionModel.getSubscriberStats();
    return res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function portalGetInvoices(req, res, next) {
  try {
    const { search = '', status = '', role = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const data = await SubscriptionModel.getAllInvoices({
      search,
      status,
      role,
      limit: limitNum,
      offset
    });

    return res.json({
      success: true,
      invoices: data.invoices,
      totalCount: data.totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(data.totalCount / limitNum) || 1
    });
  } catch (err) {
    next(err);
  }
}

export async function portalGetUnifiedRevenueStats(req, res, next) {
  try {
    const stats = await SubscriptionModel.getUnifiedRevenueStats();
    return res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function portalGrantTier(req, res, next) {
  try {
    const superadminId = req.user.id || req.user.sub;
    const { userId, tier = 'pro', durationDays = 30, grantReason, grantType = 'complimentary' } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const granted = await SubscriptionService.grantSubscription({
      superadminId,
      targetUserId: userId,
      tier,
      durationDays: Number(durationDays),
      grantReason,
      grantType
    });

    return res.json({
      success: true,
      message: `Tier "${tier}" successfully granted to user #${userId}`,
      subscription: granted
    });
  } catch (err) {
    next(err);
  }
}

export async function portalSuspendSubscription(req, res, next) {
  try {
    const superadminId = req.user.id || req.user.sub;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const result = await SubscriptionService.suspendSubscription({
      superadminId,
      targetUserId: userId,
      reason
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function portalResumeSubscription(req, res, next) {
  try {
    const superadminId = req.user.id || req.user.sub;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const result = await SubscriptionService.resumeSubscription({
      superadminId,
      targetUserId: userId
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function portalUpdateSubscriptionExpiry(req, res, next) {
  try {
    const { userId, newExpiryDate, extendDays, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const result = await SubscriptionService.updateSubscriptionExpiry({
      targetUserId: userId,
      newExpiryDate,
      extendDays,
      reason
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Isolated Platform Webhook Ingress
// -----------------------------------------------------------------------------

export async function handlePlatformWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  const rawBuffer = req.rawBody || Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body), 'utf8');

  // Verify signature against Platform Admin's secret
  const expected = crypto.createHmac('sha256', PLATFORM_WEBHOOK_SECRET).update(rawBuffer).digest('hex');
  if (expected !== signature) {
    return res.status(401).json({ error: 'Platform webhook signature verification failed' });
  }

  const body = (typeof req.body === 'object' && req.body !== null) ? req.body : JSON.parse(rawBuffer.toString('utf8'));
  const eventName = body.event || 'unknown';
  let eventId = req.headers['x-razorpay-event-id'] || body.id || body.event_id;
  if (!eventId) {
    eventId = crypto.createHash('sha256').update(`platform:${eventName}:${Date.now()}:${Math.random()}`).digest('hex');
  }

  try {
    // Durable persistence into platform_webhook_events
    const insRes = await pool.query(
      `INSERT INTO platform_webhook_events (event_id, event_name, payload, processing_status)
       VALUES ($1, $2, $3, 'received')
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [eventId, eventName, JSON.stringify(body)]
    );

    res.status(200).json({ received: true, eventId });

    // Handle payment.captured for subscriptions asynchronously
    if (insRes.rows.length && eventName === 'payment.captured') {
      const payment = body.payload?.payment?.entity;
      const rzpOrderId = payment?.order_id;
      const rzpPaymentId = payment?.id;

      if (rzpOrderId && rzpPaymentId) {
        setImmediate(async () => {
          try {
            await SubscriptionService.verifySubscriptionPayment({
              razorpay_order_id: rzpOrderId,
              razorpay_payment_id: rzpPaymentId,
              razorpay_signature: signature,
              userId: null
            });
            await pool.query(
              `UPDATE platform_webhook_events SET processing_status = 'processed', processed_at = NOW() WHERE event_id = $1`,
              [eventId]
            );
          } catch (procErr) {
            console.warn('[PlatformWebhook] Async capture note:', procErr.message);
          }
        });
      }
    }
  } catch (err) {
    console.error('[PlatformWebhook] Storage error:', err);
    return res.status(500).json({ error: 'Internal error persisting platform webhook' });
  }
}

