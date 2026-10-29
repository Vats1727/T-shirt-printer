import storeModel from '../models/store.model.js';
import { decodeId } from '../utils/idEncoder.js';

export async function listStores({ search = '', category = 'all', sort = 'products' } = {}) {
  const allStores = await storeModel.getAllStores();

  // Only show stores that are public and opted-in to the customer portal directory
  let filtered = allStores.filter(
    (s) => s.is_public !== false && s.show_in_customer_portal !== false
  );

  // Category filter: 'all' | 'designers' | 'providers'
  if (category === 'designers') {
    filtered = filtered.filter((s) => !s.is_provider);
  } else if (category === 'providers') {
    filtered = filtered.filter((s) => s.is_provider);
  }

  // Search keyword filter (store name, creator name, tagline)
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((s) => {
      const matchStoreName = (s.store_name || '').toLowerCase().includes(q);
      const matchOwnerName = (s.name || '').toLowerCase().includes(q);
      const matchTagline = (s.tagline || '').toLowerCase().includes(q);
      return matchStoreName || matchOwnerName || matchTagline;
    });
  }

  // Sorting
  filtered.sort((a, b) => {
    if (sort === 'products') {
      return (b.products_count || 0) - (a.products_count || 0);
    }
    if (sort === 'newest') {
      return Number(b.id) - Number(a.id);
    }
    if (sort === 'alpha') {
      return (a.store_name || '').localeCompare(b.store_name || '');
    }
    return 0;
  });

  return filtered;
}

export async function getStore(rawId) {
  const numericId = decodeId(rawId) || rawId;
  const store = await storeModel.getStoreById(numericId);
  if (!store) {
    const err = new Error('Storefront not found');
    err.status = 404;
    throw err;
  }
  return store;
}

export default {
  listStores,
  getStore
};

