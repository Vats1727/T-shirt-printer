import userModel from '../models/user.model.js';
import userService from '../services/user.service.js';

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

export default { listProviders, updateProviderStatus };
