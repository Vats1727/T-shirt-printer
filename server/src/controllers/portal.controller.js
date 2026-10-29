import userModel from '../models/user.model.js';
import userService from '../services/user.service.js';
import financialSettingsModel from '../models/financialSettings.model.js';
import b2bFinancialSettingsModel from '../models/b2bFinancialSettings.model.js';
import { pool } from '../config/database.js';
import PDFDocument from 'pdfkit';

export async function listProviders(_req, res, next) {
  try {
    const providers = await userService.getAllProviders();
    return res.json(providers);
  } catch (err) {
    next(err);
  }
}

export async function updateProviderStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const data = req.body;

    if (data.status && !['active', 'pending', 'rejected', 'suspended', 'deactivated'].includes(data.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await userModel.updateUser(id, data);
    return res.json({ ok: true, status: data.status });
  } catch (err) {
    next(err);
  }
}

export async function getFinancialSettings(_req, res, next) {
  try {
    const settings = await financialSettingsModel.getFinancialSettings(true);
    return res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

export async function updateFinancialSettings(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.sub || null;
    const updated = await financialSettingsModel.updateFinancialSettings(req.body, userId);
    return res.json({
      success: true,
      message: 'Global financial settings updated successfully',
      settings: updated
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to update financial settings'
    });
  }
}

export async function getPublicFinancialSettings(_req, res, next) {
  try {
    const settings = await financialSettingsModel.getFinancialSettings(false);
    return res.json({
      success: true,
      settings: {
        standard_shipping_charge: settings.standard_shipping_charge,
        free_shipping_threshold: settings.free_shipping_threshold,
        shipping_enabled: settings.shipping_enabled,
        platform_fee_percent: settings.platform_fee_percent,
        platform_fixed_fee: settings.platform_fixed_fee,
        designer_margin_percent: settings.designer_margin_percent,
        min_designer_margin_percent: settings.min_designer_margin_percent,
        provider_margin_percent: settings.provider_margin_percent,
        min_provider_margin_percent: settings.min_provider_margin_percent,
        tax_percent: settings.tax_percent,
        gst_enabled: Boolean(settings.gst_enabled ?? true)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getProviderLedger(_req, res, next) {
  try {
    if (!pool) return res.json({ providers: [], summary: {} });

    const q = `
      SELECT 
        u.id AS provider_id,
        u.name AS provider_name,
        u.email AS provider_email,
        u.status AS provider_status,
        COUNT(DISTINCT p.id) AS products_count,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.total_cents), 0) / 100.0 AS gross_volume,
        COALESCE(SUM(o.subtotal_cents), 0) / 100.0 AS subtotal_volume,
        COALESCE(SUM(o.provider_earnings_cents), 0) / 100.0 AS provider_earnings,
        COALESCE(SUM(o.platform_fee_cents), 0) / 100.0 AS platform_commission,
        COALESCE(SUM(o.tax_cents), 0) / 100.0 AS gst_collected
      FROM users u
      LEFT JOIN products_full p ON p.owner_id = u.id
      LEFT JOIN orders o ON o.provider_id = u.id AND (o.payment_status != 'failed' OR o.payment_status IS NULL) AND (o.status != 'cancelled' OR o.status IS NULL)
      WHERE u.role IN ('print_provider', 'admin') AND u.role != 'portal_admin'
      GROUP BY u.id, u.name, u.email, u.status
      ORDER BY gross_volume DESC, total_orders DESC, u.name ASC
    `;
    const result = await pool.query(q);

    const rows = result.rows.map(r => ({
      provider_id: Number(r.provider_id),
      provider_name: r.provider_name || 'Print Hub #' + r.provider_id,
      provider_email: r.provider_email,
      provider_status: r.provider_status || 'active',
      products_count: Number(r.products_count || 0),
      total_orders: Number(r.total_orders || 0),
      gross_volume: Number(Number(r.gross_volume).toFixed(2)),
      subtotal_volume: Number(Number(r.subtotal_volume).toFixed(2)),
      provider_earnings: Number(Number(r.provider_earnings).toFixed(2)),
      platform_commission: Number(Number(r.platform_commission).toFixed(2)),
      gst_collected: Number(Number(r.gst_collected).toFixed(2))
    }));

    const summary = rows.reduce((acc, r) => ({
      total_gross_volume: Number((acc.total_gross_volume + r.gross_volume).toFixed(2)),
      total_provider_payouts: Number((acc.total_provider_payouts + r.provider_earnings).toFixed(2)),
      total_platform_commission: Number((acc.total_platform_commission + r.platform_commission).toFixed(2)),
      total_gst_collected: Number((acc.total_gst_collected + r.gst_collected).toFixed(2)),
      total_orders_count: acc.total_orders_count + r.total_orders
    }), {
      total_gross_volume: 0,
      total_provider_payouts: 0,
      total_platform_commission: 0,
      total_gst_collected: 0,
      total_orders_count: 0
    });

    return res.json({ providers: rows, summary });
  } catch (err) {
    next(err);
  }
}

export async function getDesignerLedger(_req, res, next) {
  try {
    if (!pool) return res.json({ designers: [], summary: {} });

    const q = `
      SELECT 
        u.id AS designer_id,
        u.name AS designer_name,
        u.email AS designer_email,
        u.status AS designer_status,
        prov.name AS associated_provider_name,
        COUNT(DISTINCT l.id) AS listings_count,
        COUNT(o.id) AS total_sales,
        COALESCE(SUM(o.total_cents), 0) / 100.0 AS gross_volume,
        COALESCE(SUM(o.subtotal_cents), 0) / 100.0 AS subtotal_volume,
        COALESCE(SUM(o.designer_earnings_cents), 0) / 100.0 AS designer_royalties,
        COALESCE(SUM(o.platform_fee_cents), 0) / 100.0 AS platform_commission,
        COALESCE(SUM(o.tax_cents), 0) / 100.0 AS gst_collected
      FROM users u
      LEFT JOIN users prov ON prov.id = u.associated_provider_id
      LEFT JOIN listings l ON l.supplier_id = u.id
      LEFT JOIN orders o ON o.designer_id = u.id AND (o.payment_status != 'failed' OR o.payment_status IS NULL) AND (o.status != 'cancelled' OR o.status IS NULL)
      WHERE u.role IN ('designer', 'supplier')
      GROUP BY u.id, u.name, u.email, u.status, prov.name
      ORDER BY gross_volume DESC, total_sales DESC, u.name ASC
    `;
    const result = await pool.query(q);

    const rows = result.rows.map(r => ({
      designer_id: Number(r.designer_id),
      designer_name: r.designer_name || 'Designer #' + r.designer_id,
      designer_email: r.designer_email,
      designer_status: r.designer_status || 'active',
      store_name: r.designer_name ? r.designer_name + ' Studio' : 'Creator Store',
      associated_provider_name: r.associated_provider_name || 'Global Provider Pool',
      listings_count: Number(r.listings_count || 0),
      total_sales: Number(r.total_sales || 0),
      gross_volume: Number(Number(r.gross_volume).toFixed(2)),
      subtotal_volume: Number(Number(r.subtotal_volume).toFixed(2)),
      designer_royalties: Number(Number(r.designer_royalties).toFixed(2)),
      platform_commission: Number(Number(r.platform_commission).toFixed(2)),
      gst_collected: Number(Number(r.gst_collected).toFixed(2))
    }));

    const summary = rows.reduce((acc, r) => ({
      total_gross_volume: Number((acc.total_gross_volume + r.gross_volume).toFixed(2)),
      total_designer_royalties: Number((acc.total_designer_royalties + r.designer_royalties).toFixed(2)),
      total_platform_commission: Number((acc.total_platform_commission + r.platform_commission).toFixed(2)),
      total_gst_collected: Number((acc.total_gst_collected + r.gst_collected).toFixed(2)),
      total_sales_count: acc.total_sales_count + r.total_sales
    }), {
      total_gross_volume: 0,
      total_designer_royalties: 0,
      total_platform_commission: 0,
      total_gst_collected: 0,
      total_sales_count: 0
    });

    return res.json({ designers: rows, summary });
  } catch (err) {
    next(err);
  }
}

export async function getPartnerStatement(req, res, next) {
  try {
    const partnerId = Number(req.params.id);
    if (!pool || !partnerId) return res.status(400).json({ message: 'Invalid partner ID' });

    const uRes = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [partnerId]);
    if (uRes.rows.length === 0) return res.status(404).json({ message: 'Partner not found' });
    const partner = uRes.rows[0];

    const isProvider = partner.role === 'print_provider' || partner.role === 'admin';
    const filterField = isProvider ? 'provider_id' : 'designer_id';

    const ordersRes = await pool.query(
      `SELECT 
        id, order_number, customer_name, customer_email, status, payment_status, payment_method,
        subtotal_cents / 100.0 AS subtotal,
        shipping_cost_cents / 100.0 AS shipping_cost,
        tax_cents / 100.0 AS tax,
        total_cents / 100.0 AS total,
        provider_earnings_cents / 100.0 AS provider_earnings,
        designer_earnings_cents / 100.0 AS designer_earnings,
        platform_fee_cents / 100.0 AS platform_commission,
        created_at,
        FALSE as is_b2b_order,
        'customer_storefront' as order_type
       FROM orders
       WHERE ${filterField} = $1
       ORDER BY created_at DESC`,
      [partnerId]
    );

    let b2bRows = [];
    try {
      const b2bOrdersRes = await pool.query(
        `SELECT 
          o.id, o.order_number, 
          d.name as customer_name, d.email as customer_email, 
          o.status, o.payment_status, o.payment_method,
          o.subtotal_cents / 100.0 AS subtotal,
          o.shipping_cost_cents / 100.0 AS shipping_cost,
          o.tax_cents / 100.0 AS tax,
          o.total_cents / 100.0 AS total,
          o.provider_earnings_cents / 100.0 AS provider_earnings,
          0.00 AS designer_earnings,
          o.platform_commission_cents / 100.0 AS platform_commission,
          o.created_at,
          TRUE as is_b2b_order,
          o.order_type
         FROM b2b_designer_orders o
         JOIN users d ON d.id = o.designer_id
         WHERE o.${filterField} = $1
         ORDER BY o.created_at DESC`,
        [partnerId]
      );
      b2bRows = b2bOrdersRes.rows || [];
    } catch (b2bErr) {
      console.warn('Could not query b2b orders in partner statement:', b2bErr.message);
    }

    const allPartnerOrders = [...ordersRes.rows, ...b2bRows].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return res.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        role: partner.role,
        status: partner.status,
        store_name: partner.store_name
      },
      orders: allPartnerOrders
    });
  } catch (err) {
    next(err);
  }
}

export async function exportLedgerPdf(req, res, next) {
  try {
    const { type = 'providers' } = req.query;
    const isProv = type === 'providers';

    let rows = [];
    let summary = { total_orders: 0, total_gross: 0, total_earnings: 0, total_commission: 0, total_gst: 0 };

    if (isProv) {
      if (pool) {
        const q = `
          SELECT 
            u.id AS provider_id,
            u.name AS provider_name,
            u.email AS provider_email,
            u.status AS provider_status,
            COUNT(DISTINCT p.id) AS products_count,
            COUNT(o.id) AS total_orders,
            COALESCE(SUM(o.total_cents), 0) / 100.0 AS gross_volume,
            COALESCE(SUM(o.subtotal_cents), 0) / 100.0 AS subtotal_volume,
            COALESCE(SUM(o.provider_earnings_cents), 0) / 100.0 AS provider_earnings,
            COALESCE(SUM(o.platform_fee_cents), 0) / 100.0 AS platform_commission,
            COALESCE(SUM(o.tax_cents), 0) / 100.0 AS gst_collected
          FROM users u
          LEFT JOIN products_full p ON p.owner_id = u.id
          LEFT JOIN orders o ON o.provider_id = u.id AND (o.payment_status != 'failed' OR o.payment_status IS NULL) AND (o.status != 'cancelled' OR o.status IS NULL)
          WHERE u.role IN ('print_provider', 'admin') AND u.role != 'portal_admin'
          GROUP BY u.id, u.name, u.email, u.status
          ORDER BY gross_volume DESC, total_orders DESC, u.name ASC
        `;
        const result = await pool.query(q);
        rows = result.rows.map(r => ({
          name: r.provider_name || 'Print Hub #' + r.provider_id,
          email: r.provider_email || '',
          status: (r.provider_status || 'active').toUpperCase(),
          total_orders: Number(r.total_orders || 0),
          gross_volume: Number(Number(r.gross_volume).toFixed(2)),
          partner_earnings: Number(Number(r.provider_earnings).toFixed(2)),
          platform_commission: Number(Number(r.platform_commission).toFixed(2)),
          gst_collected: Number(Number(r.gst_collected).toFixed(2))
        }));

        summary = rows.reduce((acc, r) => ({
          total_orders: acc.total_orders + r.total_orders,
          total_gross: Number((acc.total_gross + r.gross_volume).toFixed(2)),
          total_earnings: Number((acc.total_earnings + r.partner_earnings).toFixed(2)),
          total_commission: Number((acc.total_commission + r.platform_commission).toFixed(2)),
          total_gst: Number((acc.total_gst + r.gst_collected).toFixed(2))
        }), { total_orders: 0, total_gross: 0, total_earnings: 0, total_commission: 0, total_gst: 0 });
      }
    } else {
      if (pool) {
        const q = `
          SELECT 
            u.id AS designer_id,
            u.name AS designer_name,
            u.email AS designer_email,
            u.status AS designer_status,
            prov.name AS associated_provider_name,
            COUNT(DISTINCT l.id) AS listings_count,
            COUNT(o.id) AS total_sales,
            COALESCE(SUM(o.total_cents), 0) / 100.0 AS gross_volume,
            COALESCE(SUM(o.subtotal_cents), 0) / 100.0 AS subtotal_volume,
            COALESCE(SUM(o.designer_earnings_cents), 0) / 100.0 AS designer_royalties,
            COALESCE(SUM(o.platform_fee_cents), 0) / 100.0 AS platform_commission,
            COALESCE(SUM(o.tax_cents), 0) / 100.0 AS gst_collected
          FROM users u
          LEFT JOIN users prov ON prov.id = u.associated_provider_id
          LEFT JOIN listings l ON l.supplier_id = u.id
          LEFT JOIN orders o ON o.designer_id = u.id AND (o.payment_status != 'failed' OR o.payment_status IS NULL) AND (o.status != 'cancelled' OR o.status IS NULL)
          WHERE u.role IN ('designer', 'supplier')
          GROUP BY u.id, u.name, u.email, u.status, prov.name
          ORDER BY gross_volume DESC, total_sales DESC, u.name ASC
        `;
        const result = await pool.query(q);
        rows = result.rows.map(r => ({
          name: r.designer_name || 'Designer #' + r.designer_id,
          email: r.designer_email || '',
          status: (r.designer_status || 'active').toUpperCase(),
          store_name: r.designer_name ? r.designer_name + ' Studio' : 'Creator Store',
          associated_hub: r.associated_provider_name || 'Global Pool',
          total_orders: Number(r.total_sales || 0),
          gross_volume: Number(Number(r.gross_volume).toFixed(2)),
          partner_earnings: Number(Number(r.designer_royalties).toFixed(2)),
          platform_commission: Number(Number(r.platform_commission).toFixed(2)),
          gst_collected: Number(Number(r.gst_collected).toFixed(2))
        }));

        summary = rows.reduce((acc, r) => ({
          total_orders: acc.total_orders + r.total_orders,
          total_gross: Number((acc.total_gross + r.gross_volume).toFixed(2)),
          total_earnings: Number((acc.total_earnings + r.partner_earnings).toFixed(2)),
          total_commission: Number((acc.total_commission + r.platform_commission).toFixed(2)),
          total_gst: Number((acc.total_gst + r.gst_collected).toFixed(2))
        }), { total_orders: 0, total_gross: 0, total_earnings: 0, total_commission: 0, total_gst: 0 });
      }
    }

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const fileName = `Partner_Ledger_${isProv ? 'Print_Providers' : 'Designers'}_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    doc.pipe(res);

    // Header banner
    doc.rect(36, 36, 523, 54).fill('#1e1b4b');
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text('PRINT PORTAL FINANCIAL LEDGER & AUDIT REPORT', 48, 48);
    doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica')
       .text(`Scope: ${isProv ? 'Print Facility Partners' : 'Creator Storefronts'} | Generated: ${new Date().toLocaleString()} | Currency: INR`, 48, 68);

    // KPI boxes
    let y = 105;
    const kpiBox = (x, title, value, color) => {
      doc.rect(x, y, 122, 42).lineWidth(1).strokeColor('#e2e8f0').fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor(color).fontSize(7).font('Helvetica-Bold').text(title.toUpperCase(), x + 8, y + 8);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(value, x + 8, y + 22);
    };

    kpiBox(36, 'Platform Commission', `Rs.${Number(summary.total_commission || 0).toFixed(2)}`, '#4338ca');
    kpiBox(169, isProv ? 'Provider Payouts' : 'Designer Royalties', `Rs.${Number(summary.total_earnings || 0).toFixed(2)}`, isProv ? '#b45309' : '#7e22ce');
    kpiBox(302, 'Govt. GST Escrow', `Rs.${Number(summary.total_gst || 0).toFixed(2)}`, '#047857');
    kpiBox(435, 'Gross Network GMV', `Rs.${Number(summary.total_gross || 0).toFixed(2)}`, '#1e293b');

    // Table Header
    y = 165;
    const drawTableHeader = () => {
      doc.rect(36, y, 523, 20).fill('#f1f5f9');
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
      if (isProv) {
        doc.text('Print Facility Partner', 42, y + 6, { width: 145 });
        doc.text('Status', 190, y + 6, { width: 45 });
        doc.text('Orders', 235, y + 6, { width: 45, align: 'right' });
        doc.text('Gross GMV', 285, y + 6, { width: 60, align: 'right' });
        doc.text('Payout', 350, y + 6, { width: 65, align: 'right' });
        doc.text('Platform Cut', 420, y + 6, { width: 65, align: 'right' });
        doc.text('GST Handled', 490, y + 6, { width: 65, align: 'right' });
      } else {
        doc.text('Designer & Storefront', 42, y + 6, { width: 145 });
        doc.text('Printing Hub', 190, y + 6, { width: 50 });
        doc.text('Sales', 240, y + 6, { width: 40, align: 'right' });
        doc.text('Gross GMV', 285, y + 6, { width: 60, align: 'right' });
        doc.text('Royalty', 350, y + 6, { width: 65, align: 'right' });
        doc.text('Platform Cut', 420, y + 6, { width: 65, align: 'right' });
        doc.text('GST Handled', 490, y + 6, { width: 65, align: 'right' });
      }
      y += 20;
    };

    drawTableHeader();

    if (rows.length === 0) {
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('No partner records found in this category.', 42, y + 10);
      y += 30;
    } else {
      rows.forEach((r, idx) => {
        if (y > 740) {
          doc.addPage();
          y = 40;
          drawTableHeader();
        }

        if (idx % 2 === 1) {
          doc.rect(36, y, 523, 24).fill('#f8fafc');
        }

        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
           .text(r.name, 42, y + 4, { width: 145, ellipsis: true });
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
           .text(isProv ? r.email : (r.store_name || r.email), 42, y + 14, { width: 145, ellipsis: true });

        if (isProv) {
          const isAct = r.status === 'ACTIVE';
          doc.fillColor(isAct ? '#15803d' : '#ca8a04').fontSize(7).font('Helvetica-Bold')
             .text(r.status, 190, y + 8, { width: 45 });
        } else {
          doc.fillColor('#475569').fontSize(7).font('Helvetica')
             .text(r.associated_hub || 'Pool', 190, y + 8, { width: 50, ellipsis: true });
        }

        doc.fillColor('#334155').fontSize(8).font('Helvetica')
           .text(`${r.total_orders}`, isProv ? 235 : 240, y + 8, { width: isProv ? 45 : 40, align: 'right' });
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
           .text(`Rs.${r.gross_volume.toFixed(2)}`, 285, y + 8, { width: 60, align: 'right' });
        doc.fillColor(isProv ? '#b45309' : '#7e22ce').fontSize(8).font('Helvetica-Bold')
           .text(`Rs.${r.partner_earnings.toFixed(2)}`, 350, y + 8, { width: 65, align: 'right' });
        doc.fillColor('#4338ca').fontSize(8).font('Helvetica-Bold')
           .text(`Rs.${r.platform_commission.toFixed(2)}`, 420, y + 8, { width: 65, align: 'right' });
        doc.fillColor('#047857').fontSize(8).font('Helvetica-Bold')
           .text(`Rs.${r.gst_collected.toFixed(2)}`, 490, y + 8, { width: 65, align: 'right' });

        y += 24;
        doc.moveTo(36, y).lineTo(559, y).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
      });

      // Summary row
      if (y > 730) {
        doc.addPage();
        y = 40;
      }
      doc.rect(36, y, 523, 22).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
      doc.text('TOTAL NETWORK SETTLEMENT', 42, y + 6, { width: 145 });
      doc.text(`${summary.total_orders}`, isProv ? 235 : 240, y + 6, { width: isProv ? 45 : 40, align: 'right' });
      doc.text(`Rs.${Number(summary.total_gross || 0).toFixed(2)}`, 285, y + 6, { width: 60, align: 'right' });
      doc.text(`Rs.${Number(summary.total_earnings || 0).toFixed(2)}`, 350, y + 6, { width: 65, align: 'right' });
      doc.text(`Rs.${Number(summary.total_commission || 0).toFixed(2)}`, 420, y + 6, { width: 65, align: 'right' });
      doc.text(`Rs.${Number(summary.total_gst || 0).toFixed(2)}`, 490, y + 6, { width: 65, align: 'right' });
    }

    // Footer
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
       .text('Confidential Document • Print Portal Financial Governance & Settlement Audit • All rights reserved.', 36, 800, { align: 'center', width: 523 });

    doc.end();
  } catch (err) {
    next(err);
  }
}

export async function exportLedgerExcel(req, res, next) {
  try {
    const { type = 'providers' } = req.query;
    const isProv = type === 'providers';

    let csvRows = [];
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Partner_Ledger_${isProv ? 'Print_Providers' : 'Designers'}_${dateStr}.csv`;

    if (isProv) {
      const q = `
        SELECT 
          u.id AS provider_id,
          u.name AS provider_name,
          u.email AS provider_email,
          u.status AS provider_status,
          COUNT(o.id) AS total_orders,
          COALESCE(SUM(o.total_cents), 0) / 100.0 AS gross_volume,
          COALESCE(SUM(o.provider_earnings_cents), 0) / 100.0 AS provider_earnings,
          COALESCE(SUM(o.platform_fee_cents), 0) / 100.0 AS platform_commission,
          COALESCE(SUM(o.tax_cents), 0) / 100.0 AS gst_collected
        FROM users u
        LEFT JOIN orders o ON o.provider_id = u.id AND (o.payment_status != 'failed' OR o.payment_status IS NULL) AND (o.status != 'cancelled' OR o.status IS NULL)
        WHERE u.role IN ('print_provider', 'admin') AND u.role != 'portal_admin'
        GROUP BY u.id, u.name, u.email, u.status
        ORDER BY gross_volume DESC, total_orders DESC, u.name ASC
      `;
      const result = await pool.query(q);

      csvRows.push([`"PRINT PORTAL FINANCIAL LEDGER REPORT - PRINT FACILITY PARTNERS"`]);
      csvRows.push([`"Generated At"`, `"${new Date().toLocaleString()}"`]);
      csvRows.push([]);
      csvRows.push([
        `"Print Facility Partner"`,
        `"Email"`,
        `"Status"`,
        `"Orders Fulfilled"`,
        `"Gross GMV (INR)"`,
        `"Provider Payout (INR)"`,
        `"Platform Commission (INR)"`,
        `"GST Handled (INR)"`
      ]);

      let totOrd = 0, totGross = 0, totPayout = 0, totComm = 0, totGst = 0;
      result.rows.forEach(r => {
        const ord = Number(r.total_orders || 0);
        const gross = Number(Number(r.gross_volume || 0).toFixed(2));
        const payout = Number(Number(r.provider_earnings || 0).toFixed(2));
        const comm = Number(Number(r.platform_commission || 0).toFixed(2));
        const gst = Number(Number(r.gst_collected || 0).toFixed(2));
        totOrd += ord;
        totGross += gross;
        totPayout += payout;
        totComm += comm;
        totGst += gst;

        csvRows.push([
          `"${(r.provider_name || '').replace(/"/g, '""')}"`,
          `"${(r.provider_email || '').replace(/"/g, '""')}"`,
          `"${(r.provider_status || 'ACTIVE').toUpperCase()}"`,
          ord,
          gross.toFixed(2),
          payout.toFixed(2),
          comm.toFixed(2),
          gst.toFixed(2)
        ]);
      });

      csvRows.push([]);
      csvRows.push([
        `"TOTALS"`, `""`, `""`, totOrd, totGross.toFixed(2), totPayout.toFixed(2), totComm.toFixed(2), totGst.toFixed(2)
      ]);
    } else {
      const q = `
        SELECT 
          u.id AS designer_id,
          u.name AS designer_name,
          u.email AS designer_email,
          u.status AS designer_status,
          prov.name AS associated_provider_name,
          COUNT(o.id) AS total_sales,
          COALESCE(SUM(o.total_cents), 0) / 100.0 AS gross_volume,
          COALESCE(SUM(o.designer_earnings_cents), 0) / 100.0 AS designer_royalties,
          COALESCE(SUM(o.platform_fee_cents), 0) / 100.0 AS platform_commission,
          COALESCE(SUM(o.tax_cents), 0) / 100.0 AS gst_collected
        FROM users u
        LEFT JOIN users prov ON prov.id = u.associated_provider_id
        LEFT JOIN orders o ON o.designer_id = u.id AND (o.payment_status != 'failed' OR o.payment_status IS NULL) AND (o.status != 'cancelled' OR o.status IS NULL)
        WHERE u.role IN ('designer', 'supplier')
        GROUP BY u.id, u.name, u.email, u.status, prov.name
        ORDER BY gross_volume DESC, total_sales DESC, u.name ASC
      `;
      const result = await pool.query(q);

      csvRows.push([`"PRINT PORTAL FINANCIAL LEDGER REPORT - DESIGNERS & STOREFRONTS"`]);
      csvRows.push([`"Generated At"`, `"${new Date().toLocaleString()}"`]);
      csvRows.push([]);
      csvRows.push([
        `"Designer Name"`,
        `"Email"`,
        `"Storefront Name"`,
        `"Associated Printing Hub"`,
        `"Customer Sales"`,
        `"Store Gross Revenue (INR)"`,
        `"Designer Royalty (INR)"`,
        `"Platform Commission (INR)"`,
        `"GST Handled (INR)"`
      ]);

      let totSales = 0, totGross = 0, totRoyalty = 0, totComm = 0, totGst = 0;
      result.rows.forEach(r => {
        const sales = Number(r.total_sales || 0);
        const gross = Number(Number(r.gross_volume || 0).toFixed(2));
        const royalty = Number(Number(r.designer_royalties || 0).toFixed(2));
        const comm = Number(Number(r.platform_commission || 0).toFixed(2));
        const gst = Number(Number(r.gst_collected || 0).toFixed(2));
        totSales += sales;
        totGross += gross;
        totRoyalty += royalty;
        totComm += comm;
        totGst += gst;

        csvRows.push([
          `"${(r.designer_name || '').replace(/"/g, '""')}"`,
          `"${(r.designer_email || '').replace(/"/g, '""')}"`,
          `"${((r.designer_name ? r.designer_name + ' Studio' : 'Creator Store')).replace(/"/g, '""')}"`,
          `"${(r.associated_provider_name || 'Global Provider Pool').replace(/"/g, '""')}"`,
          sales,
          gross.toFixed(2),
          royalty.toFixed(2),
          comm.toFixed(2),
          gst.toFixed(2)
        ]);
      });

      csvRows.push([]);
      csvRows.push([
        `"TOTALS"`, `""`, `""`, `""`, totSales, totGross.toFixed(2), totRoyalty.toFixed(2), totComm.toFixed(2), totGst.toFixed(2)
      ]);
    }

    const csvContent = '\uFEFF' + csvRows.map(r => r.join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(csvContent);
  } catch (err) {
    next(err);
  }
}

export async function getB2BFinancialSettings(_req, res, next) {
  try {
    const settings = await b2bFinancialSettingsModel.getB2BFinancialSettings(true);
    return res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

export async function updateB2BFinancialSettings(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.sub || null;
    const updated = await b2bFinancialSettingsModel.updateB2BFinancialSettings(req.body, userId);
    return res.json({
      success: true,
      message: 'B2B Wholesale financial governance rules updated successfully',
      settings: updated
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to update B2B financial governance settings'
    });
  }
}

export async function getPublicB2BFinancialSettings(_req, res, next) {
  try {
    const settings = await b2bFinancialSettingsModel.getB2BFinancialSettings(false);
    return res.json({
      success: true,
      settings: {
        single_platform_fee_percent: settings.single_platform_fee_percent,
        single_provider_margin_percent: settings.single_provider_margin_percent,
        bulk_platform_fee_percent: settings.bulk_platform_fee_percent,
        bulk_provider_margin_percent: settings.bulk_provider_margin_percent,
        bulk_min_qty: settings.bulk_min_qty,
        platform_fee_percent: settings.platform_fee_percent,
        provider_margin_percent: settings.provider_margin_percent,
        standard_shipping_charge: settings.standard_shipping_charge,
        free_shipping_threshold: settings.free_shipping_threshold,
        shipping_enabled: settings.shipping_enabled,
        tax_percent: settings.tax_percent,
        gst_enabled: settings.gst_enabled
      }
    });
  } catch (err) {
    next(err);
  }
}

export default {
  listProviders,
  updateProviderStatus,
  getFinancialSettings,
  updateFinancialSettings,
  getPublicFinancialSettings,
  getB2BFinancialSettings,
  updateB2BFinancialSettings,
  getPublicB2BFinancialSettings,
  getProviderLedger,
  getDesignerLedger,
  getPartnerStatement,
  exportLedgerPdf,
  exportLedgerExcel
};
