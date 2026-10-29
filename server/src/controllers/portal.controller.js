import userModel from '../models/user.model.js';
import userService from '../services/user.service.js';
import financialSettingsModel from '../models/financialSettings.model.js';

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

export default {
  listProviders,
  updateProviderStatus,
  getFinancialSettings,
  updateFinancialSettings,
  getPublicFinancialSettings
};
