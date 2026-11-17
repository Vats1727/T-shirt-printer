import { pool } from '../config/database.js';
import financialSettingsModel from '../models/financialSettings.model.js';
import * as userStore from '../services/userStore.js';

export const PayoutController = {
  /**
   * Print Provider: Get margin configuration & platform governance boundaries.
   */
  async getProviderMargins(req, res, next) {
    try {
      const providerId = req.user?.id || req.user?.sub;
      if (!providerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const globalSettings = await financialSettingsModel.getFinancialSettings();
      const user = await userStore.findById(providerId);
      const storeSettings = user?.store_settings || {};

      const currentDesignerMargin = storeSettings.designer_margin_percent !== undefined
        ? Number(storeSettings.designer_margin_percent)
        : Number(globalSettings.designer_margin_percent || 35.0);

      const providerMargin = Math.max(0, 100 - currentDesignerMargin);

      return res.json({
        success: true,
        margins: {
          designerMarginPercent: currentDesignerMargin,
          providerMarginPercent: providerMargin,
          minDesignerMarginPercent: Number(globalSettings.min_designer_margin_percent || 10.0),
          minProviderMarginPercent: Number(globalSettings.min_provider_margin_percent || 20.0),
          isCustomized: storeSettings.designer_margin_percent !== undefined
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Print Provider: Update custom designer royalty margin percentage.
   */
  async updateProviderMargins(req, res, next) {
    try {
      const providerId = req.user?.id || req.user?.sub;
      if (!providerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { designerMarginPercent } = req.body;
      const numMargin = Number(designerMarginPercent);

      if (isNaN(numMargin) || numMargin <= 0 || numMargin > 80) {
        return res.status(400).json({
          success: false,
          message: 'Designer margin percentage must be a valid number between 10% and 80%.'
        });
      }

      const globalSettings = await financialSettingsModel.getFinancialSettings();
      const minDesigner = Number(globalSettings.min_designer_margin_percent || 10.0);

      if (numMargin < minDesigner) {
        return res.status(400).json({
          success: false,
          message: `Designer margin cannot be lower than the platform minimum of ${minDesigner}%.`
        });
      }

      const user = await userStore.findById(providerId);
      const updatedStoreSettings = {
        ...(user?.store_settings || {}),
        designer_margin_percent: numMargin
      };

      await userStore.updateStoreSettings(providerId, updatedStoreSettings);

      const providerMargin = Math.max(0, 100 - numMargin);

      return res.json({
        success: true,
        message: 'Designer margin settings updated successfully.',
        margins: {
          designerMarginPercent: numMargin,
          providerMarginPercent: providerMargin
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Designer: Get or update payout details (UPI / Bank Account).
   */
  async getDesignerPayoutProfile(req, res, next) {
    try {
      const designerId = req.user?.id || req.user?.sub;
      if (!designerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const user = await userStore.findById(designerId);
      const payoutSettings = user?.store_settings?.payout_settings || {
        method: 'upi',
        upi_id: '',
        account_number: '',
        ifsc: '',
        account_holder_name: '',
        bank_name: ''
      };

      return res.json({
        success: true,
        payoutSettings
      });
    } catch (err) {
      next(err);
    }
  },

  async updateDesignerPayoutProfile(req, res, next) {
    try {
      const designerId = req.user?.id || req.user?.sub;
      if (!designerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { method, upi_id, account_number, ifsc, account_holder_name, bank_name } = req.body;

      if (method === 'upi' && (!upi_id || !upi_id.includes('@'))) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid UPI ID (e.g., yourname@okhdfcbank).'
        });
      }

      if (method === 'bank_transfer') {
        if (!account_number || !ifsc || !account_holder_name) {
          return res.status(400).json({
            success: false,
            message: 'Please provide Account Holder Name, Account Number, and IFSC Code.'
          });
        }
      }

      const user = await userStore.findById(designerId);
      const existingSettings = user?.store_settings || {};

      const updatedPayoutSettings = {
        method: method || 'upi',
        upi_id: upi_id ? upi_id.trim() : '',
        account_number: account_number ? account_number.trim() : '',
        ifsc: ifsc ? ifsc.trim().toUpperCase() : '',
        account_holder_name: account_holder_name ? account_holder_name.trim() : '',
        bank_name: bank_name ? bank_name.trim() : '',
        updated_at: new Date().toISOString()
      };

      const newStoreSettings = {
        ...existingSettings,
        payout_settings: updatedPayoutSettings
      };

      await userStore.updateStoreSettings(designerId, newStoreSettings);

      return res.json({
        success: true,
        message: 'Payout details saved successfully.',
        payoutSettings: updatedPayoutSettings
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Designer: Summary of earnings, cleared balance, pending payouts, and request history.
   */
  async getDesignerPayoutSummary(req, res, next) {
    try {
      const designerId = req.user?.id || req.user?.sub;
      if (!designerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // 1. Total lifetime royalties earned from paid orders
      const earningsRes = await pool.query(
        `SELECT COALESCE(SUM(designer_earnings_cents), 0) AS total_cents
         FROM orders
         WHERE designer_id = $1 
           AND status != 'cancelled' 
           AND payment_status = 'paid'`,
        [designerId]
      );
      const lifetimeEarningsCents = Number(earningsRes.rows[0]?.total_cents || 0);

      // 2. Total settled payouts
      const settledRes = await pool.query(
        `SELECT COALESCE(SUM(amount_cents), 0) AS settled_cents
         FROM designer_payout_requests
         WHERE designer_id = $1 AND status = 'settled'`,
        [designerId]
      );
      const settledCents = Number(settledRes.rows[0]?.settled_cents || 0);

      // 3. Total pending/processing payouts
      const pendingRes = await pool.query(
        `SELECT COALESCE(SUM(amount_cents), 0) AS pending_cents
         FROM designer_payout_requests
         WHERE designer_id = $1 AND status IN ('pending', 'processing')`,
        [designerId]
      );
      const pendingCents = Number(pendingRes.rows[0]?.pending_cents || 0);

      // 4. Available balance to withdraw
      const availableCents = Math.max(0, lifetimeEarningsCents - settledCents - pendingCents);

      // 5. Recent payout requests list
      const requestsRes = await pool.query(
        `SELECT dpr.*, u.name AS provider_name
         FROM designer_payout_requests dpr
         JOIN users u ON u.id = dpr.provider_id
         WHERE dpr.designer_id = $1
         ORDER BY dpr.created_at DESC`,
        [designerId]
      );

      const user = await userStore.findById(designerId);
      const payoutSettings = user?.store_settings?.payout_settings || null;

      return res.json({
        success: true,
        summary: {
          lifetimeEarningsCents,
          lifetimeEarningsRupees: (lifetimeEarningsCents / 100),
          settledCents,
          settledRupees: (settledCents / 100),
          pendingCents,
          pendingRupees: (pendingCents / 100),
          availableCents,
          availableRupees: (availableCents / 100),
          hasConfiguredPayoutDetails: Boolean(payoutSettings?.upi_id || payoutSettings?.account_number)
        },
        requests: requestsRes.rows,
        payoutSettings
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Designer: Request a royalty payout.
   */
  async requestPayout(req, res, next) {
    try {
      const designerId = req.user?.id || req.user?.sub;
      if (!designerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { amountRupees, notes = '' } = req.body;
      const requestedAmount = Number(amountRupees);

      if (isNaN(requestedAmount) || requestedAmount < 100) {
        return res.status(400).json({
          success: false,
          message: 'Minimum payout request amount is ₹100.'
        });
      }

      const reqCents = Math.round(requestedAmount * 100);

      // Verify Designer payout details
      const user = await userStore.findById(designerId);
      const payoutSettings = user?.store_settings?.payout_settings;

      if (!payoutSettings || (!payoutSettings.upi_id && !payoutSettings.account_number)) {
        return res.status(400).json({
          success: false,
          message: 'Please configure your UPI ID or Bank Account in your Profile before requesting a payout.'
        });
      }

      // Check designer's associated provider
      let providerId = user.associated_provider_id;
      if (!providerId) {
        // Find most frequent provider from recent orders
        const pOrderRes = await pool.query(
          `SELECT provider_id, COUNT(*) as cnt 
           FROM orders 
           WHERE designer_id = $1 AND provider_id IS NOT NULL 
           GROUP BY provider_id ORDER BY cnt DESC LIMIT 1`,
          [designerId]
        );
        providerId = pOrderRes.rows[0]?.provider_id;
      }

      if (!providerId) {
        return res.status(400).json({
          success: false,
          message: 'No associated print provider found to process this payout request.'
        });
      }

      // Calculate available balance
      const earningsRes = await pool.query(
        `SELECT COALESCE(SUM(designer_earnings_cents), 0) AS total_cents
         FROM orders
         WHERE designer_id = $1 
           AND status != 'cancelled' 
           AND payment_status = 'paid'`,
        [designerId]
      );
      const lifetimeEarningsCents = Number(earningsRes.rows[0]?.total_cents || 0);

      const requestedAlreadyRes = await pool.query(
        `SELECT COALESCE(SUM(amount_cents), 0) AS used_cents
         FROM designer_payout_requests
         WHERE designer_id = $1 AND status IN ('pending', 'processing', 'settled')`,
        [designerId]
      );
      const usedCents = Number(requestedAlreadyRes.rows[0]?.used_cents || 0);

      const availableCents = Math.max(0, lifetimeEarningsCents - usedCents);

      if (reqCents > availableCents) {
        return res.status(400).json({
          success: false,
          message: `Requested amount (₹${requestedAmount.toFixed(2)}) exceeds your available balance of ₹${(availableCents / 100).toFixed(2)}.`
        });
      }

      // Insert payout request
      const insRes = await pool.query(
        `INSERT INTO designer_payout_requests (
          designer_id, provider_id, amount_cents, amount_paise,
          payout_method, payout_details, status, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), NOW())
        RETURNING *`,
        [
          designerId,
          providerId,
          reqCents,
          reqCents, // paise is identical scale
          payoutSettings.method || 'upi',
          JSON.stringify(payoutSettings),
          notes || 'Royalty withdrawal request'
        ]
      );

      return res.json({
        success: true,
        message: `Payout request of ₹${requestedAmount.toFixed(2)} submitted successfully.`,
        payoutRequest: insRes.rows[0]
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Print Provider / Portal Admin: List all payout requests.
   */
  async getProviderPayoutRequests(req, res, next) {
    try {
      const userRole = req.user?.role;
      const providerId = req.user?.id || req.user?.sub;

      let query = `
        SELECT 
          dpr.*,
          d.name AS designer_name,
          d.email AS designer_email,
          p.name AS provider_name
        FROM designer_payout_requests dpr
        JOIN users d ON d.id = dpr.designer_id
        JOIN users p ON p.id = dpr.provider_id
      `;
      const params = [];

      if (userRole !== 'portal_admin') {
        query += ` WHERE dpr.provider_id = $1`;
        params.push(providerId);
      }

      query += ` ORDER BY CASE WHEN dpr.status = 'pending' THEN 0 WHEN dpr.status = 'processing' THEN 1 ELSE 2 END, dpr.created_at DESC;`;

      const resList = await pool.query(query, params);

      return res.json({
        success: true,
        requests: resList.rows
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Print Provider: Mark payout as settled with UTR / Bank reference.
   */
  async settlePayoutRequest(req, res, next) {
    try {
      const userRole = req.user?.role;
      const providerId = req.user?.id || req.user?.sub;
      const { id } = req.params;
      const { settlementReferenceUtr, notes } = req.body;

      if (!settlementReferenceUtr || !settlementReferenceUtr.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Bank UTR / Transaction Reference Number is required to settle a payout.'
        });
      }

      const reqRes = await pool.query(
        `SELECT * FROM designer_payout_requests WHERE id = $1`,
        [id]
      );
      const payoutReq = reqRes.rows[0];

      if (!payoutReq) {
        return res.status(404).json({ success: false, message: 'Payout request not found.' });
      }

      if (userRole !== 'portal_admin' && Number(payoutReq.provider_id) !== Number(providerId)) {
        return res.status(403).json({ success: false, message: 'Unauthorized to settle this request.' });
      }

      if (payoutReq.status === 'settled') {
        return res.status(400).json({ success: false, message: 'This payout request is already settled.' });
      }

      const updRes = await pool.query(
        `UPDATE designer_payout_requests
         SET status = 'settled',
             settlement_reference_utr = $1,
             notes = COALESCE($2, notes),
             settled_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [settlementReferenceUtr.trim(), notes || null, id]
      );

      return res.json({
        success: true,
        message: 'Payout settled successfully.',
        payoutRequest: updRes.rows[0]
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Print Provider: Reject payout request.
   */
  async rejectPayoutRequest(req, res, next) {
    try {
      const userRole = req.user?.role;
      const providerId = req.user?.id || req.user?.sub;
      const { id } = req.params;
      const { rejectedReason } = req.body;

      if (!rejectedReason || !rejectedReason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Reason for rejection is required.'
        });
      }

      const reqRes = await pool.query(
        `SELECT * FROM designer_payout_requests WHERE id = $1`,
        [id]
      );
      const payoutReq = reqRes.rows[0];

      if (!payoutReq) {
        return res.status(404).json({ success: false, message: 'Payout request not found.' });
      }

      if (userRole !== 'portal_admin' && Number(payoutReq.provider_id) !== Number(providerId)) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
      }

      const updRes = await pool.query(
        `UPDATE designer_payout_requests
         SET status = 'rejected',
             rejected_reason = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [rejectedReason.trim(), id]
      );

      return res.json({
        success: true,
        message: 'Payout request rejected.',
        payoutRequest: updRes.rows[0]
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Print Provider: Complete accounting financial ledger & statements.
   */
  async getProviderLedger(req, res, next) {
    try {
      const userRole = req.user?.role;
      let rawProviderId = req.user?.id || req.user?.sub;

      if (userRole === 'portal_admin' && req.query.providerId) {
        rawProviderId = req.query.providerId;
      }

      if (!rawProviderId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const providerId = Number(rawProviderId);

      const { search = '', startDate, endDate } = req.query;

      let orderQuery = `
        SELECT 
          o.id,
          o.order_number,
          o.customer_name,
          o.customer_email,
          o.total_cents,
          o.provider_earnings_cents,
          o.designer_earnings_cents,
          o.status,
          o.payment_status,
          o.payment_method,
          o.created_at,
          d.name AS designer_name,
          d.email AS designer_email
        FROM orders o
        LEFT JOIN users d ON d.id = o.designer_id
        WHERE o.provider_id = $1 AND o.payment_status = 'paid'
      `;
      const params = [providerId];
      let pIdx = 2;

      if (startDate) {
        orderQuery += ` AND o.created_at >= $${pIdx++}`;
        params.push(startDate);
      }
      if (endDate) {
        orderQuery += ` AND o.created_at <= $${pIdx++}`;
        params.push(endDate);
      }
      if (search) {
        orderQuery += ` AND (o.order_number ILIKE $${pIdx} OR o.customer_name ILIKE $${pIdx} OR d.name ILIKE $${pIdx})`;
        params.push(`%${search}%`);
        pIdx++;
      }

      orderQuery += ` ORDER BY o.created_at DESC;`;

      const ordersRes = await pool.query(orderQuery, params);

      // Financial Aggregates
      const aggRes = await pool.query(
        `SELECT 
           COALESCE(SUM(total_cents), 0) AS total_gross_cents,
           COALESCE(SUM(provider_earnings_cents), 0) AS total_retained_cents,
           COALESCE(SUM(designer_earnings_cents), 0) AS total_royalties_cents,
           COUNT(*) AS total_order_count
         FROM orders
         WHERE provider_id = $1 AND payment_status = 'paid'`,
        [providerId]
      );
      const agg = aggRes.rows[0];

      // Payout Aggregates
      const payoutAggRes = await pool.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN status = 'settled' THEN amount_cents ELSE 0 END), 0) AS settled_cents,
           COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN amount_cents ELSE 0 END), 0) AS pending_cents
         FROM designer_payout_requests
         WHERE provider_id = $1`,
        [providerId]
      );
      const payoutAgg = payoutAggRes.rows[0];

      const grossRupees = Number(agg.total_gross_cents) / 100;
      const retainedRupees = Number(agg.total_retained_cents) / 100;
      const totalRoyaltiesRupees = Number(agg.total_royalties_cents) / 100;
      const settledRoyaltiesRupees = Number(payoutAgg.settled_cents) / 100;
      const pendingRoyaltiesRupees = Number(payoutAgg.pending_cents) / 100;
      const unpaidAccruedRoyalties = Math.max(0, totalRoyaltiesRupees - settledRoyaltiesRupees);

      return res.json({
        success: true,
        summary: {
          totalGrossRupees: grossRupees,
          totalRetainedRupees: retainedRupees,
          totalRoyaltiesRupees,
          settledRoyaltiesRupees,
          pendingRoyaltiesRupees,
          unpaidAccruedRoyalties,
          orderCount: Number(agg.total_order_count)
        },
        orders: ordersRes.rows.map(o => ({
          ...o,
          total: Number(o.total_cents) / 100,
          provider_retained: Number(o.provider_earnings_cents) / 100,
          designer_royalty: Number(o.designer_earnings_cents) / 100
        }))
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Designer: Passbook statement of all credits (sales) & debits (withdrawals).
   */
  async getDesignerLedger(req, res, next) {
    try {
      const userRole = req.user?.role;
      let rawDesignerId = req.user?.id || req.user?.sub;

      if (userRole === 'portal_admin' && req.query.designerId) {
        rawDesignerId = req.query.designerId;
      }

      if (!rawDesignerId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const designerId = Number(rawDesignerId);

      // 1. Fetch all sales credits
      const salesRes = await pool.query(
        `SELECT 
           o.id,
           o.order_number,
           o.total_cents,
           o.designer_earnings_cents,
           o.created_at,
           p.name AS provider_name
         FROM orders o
         LEFT JOIN users p ON p.id = o.provider_id
         WHERE o.designer_id = $1 AND o.payment_status = 'paid'
         ORDER BY o.created_at ASC`,
        [designerId]
      );

      // 2. Fetch all withdrawals / payout requests
      const payoutsRes = await pool.query(
        `SELECT 
           pr.id,
           pr.amount_cents,
           pr.status,
           pr.settlement_reference_utr,
           pr.payout_method,
           pr.created_at,
           pr.settled_at,
           p.name AS provider_name
         FROM designer_payout_requests pr
         LEFT JOIN users p ON p.id = pr.provider_id
         WHERE pr.designer_id = $1
         ORDER BY pr.created_at ASC`,
        [designerId]
      );

      // 3. Build chronological statement timeline
      const timeline = [];

      for (const sale of salesRes.rows) {
        const creditAmt = Number(sale.designer_earnings_cents) / 100;
        timeline.push({
          id: `sale-${sale.id}`,
          date: sale.created_at,
          type: 'CREDIT',
          category: 'Retail Store Sale',
          reference: sale.order_number,
          partner: sale.provider_name || 'Print Hub',
          amount: creditAmt,
          status: 'cleared',
          details: `Royalty earned from sale (Gross: ₹${(Number(sale.total_cents) / 100).toFixed(2)})`
        });
      }

      for (const po of payoutsRes.rows) {
        const debitAmt = Number(po.amount_cents) / 100;
        timeline.push({
          id: `payout-${po.id}`,
          date: po.created_at,
          type: 'DEBIT',
          category: 'Royalty Withdrawal',
          reference: po.settlement_reference_utr ? `UTR: ${po.settlement_reference_utr}` : `REQ-#${po.id}`,
          partner: po.provider_name || 'Print Hub',
          amount: debitAmt,
          status: po.status,
          details: po.status === 'settled'
            ? `Paid via ${po.payout_method === 'upi' ? 'UPI' : 'Bank'}`
            : po.status === 'rejected'
            ? 'Request rejected'
            : 'Pending provider disbursement'
        });
      }

      // Sort chronological
      timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Compute running balance
      let currentRunningBalance = 0;
      const statement = timeline.map(entry => {
        if (entry.type === 'CREDIT') {
          currentRunningBalance += entry.amount;
        } else if (entry.type === 'DEBIT' && entry.status !== 'rejected') {
          currentRunningBalance -= entry.amount;
        }
        return {
          ...entry,
          runningBalance: Math.max(0, currentRunningBalance)
        };
      });

      // Reverse so newest statement entries are at top
      statement.reverse();

      // Aggregate Totals
      const totalLifetimeEarned = salesRes.rows.reduce((sum, s) => sum + (Number(s.designer_earnings_cents) / 100), 0);
      const totalSettledWithdrawn = payoutsRes.rows
        .filter(p => p.status === 'settled')
        .reduce((sum, p) => sum + (Number(p.amount_cents) / 100), 0);
      const totalPendingWithdrawn = payoutsRes.rows
        .filter(p => p.status === 'pending' || p.status === 'processing')
        .reduce((sum, p) => sum + (Number(p.amount_cents) / 100), 0);
      const availableBalance = Math.max(0, totalLifetimeEarned - totalSettledWithdrawn - totalPendingWithdrawn);

      return res.json({
        success: true,
        summary: {
          lifetimeEarnedRupees: totalLifetimeEarned,
          settledWithdrawnRupees: totalSettledWithdrawn,
          pendingWithdrawnRupees: totalPendingWithdrawn,
          availableBalanceRupees: availableBalance,
          salesCount: salesRes.rows.length
        },
        statement
      });
    } catch (err) {
      next(err);
    }
  }
};
