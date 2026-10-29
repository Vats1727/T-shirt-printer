import customerService from '../services/customer.service.js';

export async function listStores(req, res, next) {
  try {
    const { search, category, sort } = req.query;
    const stores = await customerService.listStores({ search, category, sort });
    return res.json({ stores, count: stores.length });
  } catch (err) {
    next(err);
  }
}

export async function getStore(req, res, next) {
  try {
    const store = await customerService.getStore(req.params.storeId);
    return res.json({ store });
  } catch (err) {
    next(err);
  }
}

export default {
  listStores,
  getStore
};

