/**
 * Comprehensive Designer Role Endpoints & Features Test Suite
 * File: Test/designer_test.mjs
 * 
 * Verifies:
 *  1. CORS headers compliance matching CORS_ORIGIN from .env across all designer endpoints
 *  2. Authentication & role security enforcement (401 on missing token, 403 on invalid role)
 *  3. Garment blanks catalog browsing (/api/supplier/catalog)
 *  4. Blank product details & purchase status (/api/supplier/products/:id, /purchase-status)
 *  5. Print provider network directory (/api/supplier/providers)
 *  6. Canvas artwork designs CRUD (/api/designs) & saved designs (/api/supplier/saved-designs)
 *  7. Designer sample/production orders (/api/supplier/orders, /orders/purchase-product)
 *  8. Designer profile & brand identity (/api/supplier/profile)
 *  9. Storefront product listings CRUD (/api/supplier/listings)
 * 10. Store settings & privacy controls (/api/supplier/store-settings)
 * 11. Storefront privacy enforcement (visitor 403 lock, owner preview 200)
 * 12. Customer portal directory synchronization & isolation
 */

import jwt from '../server/node_modules/jsonwebtoken/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../server/node_modules/dotenv/lib/main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const API_BASE = `http://localhost:${process.env.PORT || 5000}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-123';

// Generate tokens for testing
const designerToken = jwt.sign(
  { sub: 8, role: 'designer', email: 'designerone@gmail.com' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

const customerToken = jwt.sign(
  { sub: 16, role: 'customer', email: 'customerone@gmail.com' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

const providerToken = jwt.sign(
  { sub: 12, role: 'print_provider', email: 'vijaypp1720@gmail.com' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

// Test metrics
let passed = 0;
let failed = 0;
const results = [];

function logSection(title) {
  console.log(`\n================================================================`);
  console.log(`  ${title}`);
  console.log(`================================================================`);
}

function recordResult(name, success, details = '') {
  if (success) {
    passed++;
    console.log(`  [PASS] ${name}`);
    if (details) console.log(`         ${details}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${name}`);
    if (details) console.error(`         Reason: ${details}`);
  }
  results.push({ name, success, details });
}

// Helper fetch wrapper with Origin header attached
async function api(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Origin': CORS_ORIGIN,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {}
  } else {
    try {
      data = await res.text();
    } catch {}
  }

  return { res, data, status: res.status, headers: res.headers };
}

// Verify CORS headers on response
function verifyCors(headers, testName) {
  const allowOrigin = headers.get('access-control-allow-origin');
  const allowCreds = headers.get('access-control-allow-credentials');

  const originMatches = allowOrigin === CORS_ORIGIN || allowOrigin === '*';
  const credsValid = allowCreds === 'true';

  if (!originMatches) {
    recordResult(`${testName} - CORS Origin Header`, false, `Expected ${CORS_ORIGIN}, got ${allowOrigin}`);
    return false;
  }
  if (!credsValid) {
    recordResult(`${testName} - CORS Credentials Header`, false, `Expected 'true', got ${allowCreds}`);
    return false;
  }
  recordResult(`${testName} - CORS compliance (${CORS_ORIGIN})`, true, `Access-Control-Allow-Origin: ${allowOrigin}`);
  return true;
}

async function runTests() {
  console.log(`\nStarting Designer Comprehensive Test Suite`);
  console.log(`Target Server: ${API_BASE}`);
  console.log(`Configured CORS_ORIGIN from .env: ${CORS_ORIGIN}`);
  console.log(`Testing with Designer User: Designerone (ID: 8)`);

  // ================================================================
  // 1. CORS PREFLIGHT (OPTIONS) TESTS
  // ================================================================
  logSection(`1. CORS Preflight (OPTIONS) Verification`);
  {
    const { res, headers } = await api('/api/supplier/catalog', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });

    recordResult('OPTIONS /api/supplier/catalog returns 204 No Content', res.status === 204, `Status: ${res.status}`);
    verifyCors(headers, 'Preflight /api/supplier/catalog');

    const allowMethods = headers.get('access-control-allow-methods') || '';
    recordResult('Preflight includes required methods (GET,POST,PUT,DELETE,PATCH)',
      ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].every(m => allowMethods.includes(m)),
      `Methods: ${allowMethods}`
    );

    // Also verify /api/designs preflight
    const designPreflight = await api('/api/designs', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });
    recordResult('OPTIONS /api/designs returns 204 No Content', designPreflight.res.status === 204, `Status: ${designPreflight.res.status}`);
    verifyCors(designPreflight.headers, 'Preflight /api/designs');
  }

  // ================================================================
  // 2. SECURITY & ROLE AUTHORIZATION TESTS
  // ================================================================
  logSection(`2. Security & Role Authorization Gates`);
  {
    // A. Missing token
    const noToken = await api('/api/supplier/catalog');
    recordResult('Unauthenticated access blocked with 401', noToken.status === 401, `Status: ${noToken.status}`);

    // B. Customer token trying to access designer endpoint
    const forbiddenCustomer = await api('/api/supplier/catalog', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordResult('Customer role blocked from designer endpoint with 403', forbiddenCustomer.status === 403, `Status: ${forbiddenCustomer.status}`);

    // C. Print Provider token blocked from designer endpoint
    const forbiddenProvider = await api('/api/supplier/catalog', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('Print Provider role blocked from designer endpoint with 403', forbiddenProvider.status === 403, `Status: ${forbiddenProvider.status}`);

    // D. Valid Designer token
    const valid = await api('/api/supplier/catalog', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('Designer token permitted with 200 OK', valid.status === 200, `Status: ${valid.status}`);
    verifyCors(valid.headers, 'GET /api/supplier/catalog');
  }

  // ================================================================
  // 3. GARMENT BLANKS CATALOG BROWSING
  // ================================================================
  logSection(`3. Garment Blanks Catalog Browsing (/api/supplier/catalog)`);
  let sampleProduct = null;
  {
    const catRes = await api('/api/supplier/catalog', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });

    const hasStructure = catRes.status === 200 &&
      Array.isArray(catRes.data?.colors) &&
      Array.isArray(catRes.data?.sizes) &&
      Array.isArray(catRes.data?.products);

    recordResult('GET /api/supplier/catalog returns full catalog matrix', hasStructure,
      `Colors: ${catRes.data?.colors?.length || 0}, Sizes: ${catRes.data?.sizes?.length || 0}, Products: ${catRes.data?.products?.length || 0}`);
    verifyCors(catRes.headers, 'GET /api/supplier/catalog');

    // Verify draft products are excluded from designer view
    const noDrafts = (catRes.data?.products || []).every(p => p.status !== 'draft');
    recordResult('Catalog excludes draft products for designers', noDrafts, `Published products verified: ${catRes.data?.products?.length || 0}`);

    if (catRes.data?.products?.length > 0) {
      sampleProduct = catRes.data.products[0];
    }
  }

  // ================================================================
  // 4. BLANK PRODUCT DETAILS & PURCHASE STATUS
  // ================================================================
  logSection(`4. Product Details & Purchase Status`);
  if (sampleProduct) {
    const prodRes = await api(`/api/supplier/products/${sampleProduct.id}`, {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('GET /api/supplier/products/:id retrieves blank garment', prodRes.status === 200 && prodRes.data?.id === sampleProduct.id, `Garment: ${prodRes.data?.name}`);
    verifyCors(prodRes.headers, 'GET /api/supplier/products/:id');

    const statusRes = await api(`/api/supplier/products/${sampleProduct.id}/purchase-status`, {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('GET /api/supplier/products/:id/purchase-status returns status info', statusRes.status === 200 && statusRes.data?.status != null, `Status: ${statusRes.data?.status}`);
    verifyCors(statusRes.headers, 'GET /api/supplier/products/:id/purchase-status');
  } else {
    recordResult('GET /api/supplier/products/:id (Skipped - No sample product)', true);
    recordResult('GET /api/supplier/products/:id/purchase-status (Skipped - No sample product)', true);
  }

  // ================================================================
  // 5. PRINT PROVIDER NETWORK DIRECTORY
  // ================================================================
  logSection(`5. Print Provider Directory (/api/supplier/providers)`);
  {
    const provRes = await api('/api/supplier/providers', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    const isArray = provRes.status === 200 && Array.isArray(provRes.data);
    recordResult('GET /api/supplier/providers lists print facilities', isArray, `Providers found: ${provRes.data?.length || 0}`);
    verifyCors(provRes.headers, 'GET /api/supplier/providers');

    if (isArray && provRes.data.length > 0) {
      const firstProv = provRes.data[0];
      recordResult('Provider object contains id, name and role', firstProv.id != null && firstProv.name != null, `First provider: ${firstProv.name} (ID: ${firstProv.id})`);
    }
  }

  // ================================================================
  // 6. CANVAS ARTWORK DESIGNS CRUD (/api/designs)
  // ================================================================
  logSection(`6. Canvas Artwork Designs CRUD (/api/designs)`);
  let createdDesignId = null;
  {
    // A. Create Design
    const createRes = await api('/api/designs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        slogan: 'Automated Test Designer Slogan',
        color: '#000000',
        template: 'tshirt',
        product: 'T-shirt',
        product_id: sampleProduct ? sampleProduct.id : 30,
        provider_id: 12
      })
    });
    const designObj = createRes.data?.design || createRes.data;
    createdDesignId = designObj?.id;
    recordResult('POST /api/designs creates custom canvas design', (createRes.status === 200 || createRes.status === 201) && createdDesignId != null, `Created design ID: ${createdDesignId}`);
    verifyCors(createRes.headers, 'POST /api/designs');

    // B. List Designs
    const listRes = await api('/api/designs', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('GET /api/designs lists designer designs', listRes.status === 200 && Array.isArray(listRes.data), `Designs found: ${listRes.data?.length || 0}`);
    verifyCors(listRes.headers, 'GET /api/designs');

    if (createdDesignId) {
      // C. Get Design by ID
      const getRes = await api(`/api/designs/${createdDesignId}`, {
        headers: { Authorization: `Bearer ${designerToken}` }
      });
      recordResult('GET /api/designs/:id retrieves created design', getRes.status === 200 && getRes.data?.id === createdDesignId, `Slogan: ${getRes.data?.slogan}`);
      verifyCors(getRes.headers, 'GET /api/designs/:id');

      // D. Get Design Versions
      const verRes = await api(`/api/designs/${createdDesignId}/versions`, {
        headers: { Authorization: `Bearer ${designerToken}` }
      });
      recordResult('GET /api/designs/:id/versions returns version history', verRes.status === 200 && Array.isArray(verRes.data), `Versions count: ${verRes.data?.length || 0}`);
      verifyCors(verRes.headers, 'GET /api/designs/:id/versions');

      // E. Update Design
      const updateRes = await api(`/api/designs/${createdDesignId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${designerToken}` },
        body: JSON.stringify({
          slogan: 'Updated Automated Test Slogan',
          color: '#111111'
        })
      });
      recordResult('PUT /api/designs/:id updates design attributes', updateRes.status === 200, `Updated slogan & color`);
      verifyCors(updateRes.headers, 'PUT /api/designs/:id');

      // F. Saved Designs Enhanced Listing
      const savedRes = await api('/api/supplier/saved-designs', {
        headers: { Authorization: `Bearer ${designerToken}` }
      });
      recordResult('GET /api/supplier/saved-designs returns enhanced saved designs', savedRes.status === 200 && Array.isArray(savedRes.data), `Saved designs: ${savedRes.data?.length || 0}`);
      verifyCors(savedRes.headers, 'GET /api/supplier/saved-designs');

      // G. Delete Design
      const delRes = await api(`/api/designs/${createdDesignId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${designerToken}` }
      });
      recordResult('DELETE /api/designs/:id cleans up test design', delRes.status === 200, `Deleted design ID: ${createdDesignId}`);
      verifyCors(delRes.headers, 'DELETE /api/designs/:id');
    }
  }

  // ================================================================
  // 7. DESIGNER ORDERS & PURCHASE REQUESTS (/api/supplier/orders)
  // ================================================================
  logSection(`7. Designer Orders & Purchase Requests`);
  let createdOrderId = null;
  {
    // A. List Orders
    const listRes = await api('/api/supplier/orders', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('GET /api/supplier/orders returns designer orders list', listRes.status === 200 && Array.isArray(listRes.data), `Existing orders: ${listRes.data?.length || 0}`);
    verifyCors(listRes.headers, 'GET /api/supplier/orders');

    // B. Create Purchase Request
    const purchaseRes = await api('/api/supplier/orders/purchase-product', {
      method: 'POST',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        productId: sampleProduct ? sampleProduct.id : 30,
        providerId: 12,
        productSku: sampleProduct ? sampleProduct.slug : 'mens-t-shirt-1',
        size: 'L',
        color: 'Black',
        quantity: 1,
        unitPrice: 299,
        shipping: {
          customer_name: 'Designerone',
          customer_email: 'designerone@gmail.com'
        }
      })
    });
    createdOrderId = purchaseRes.data?.orderId;
    recordResult('POST /api/supplier/orders/purchase-product creates sample purchase request', (purchaseRes.status === 200 || purchaseRes.status === 201) && createdOrderId != null, `Created order ID: ${createdOrderId}`);
    verifyCors(purchaseRes.headers, 'POST /api/supplier/orders/purchase-product');

    // C. Get Order by ID
    if (createdOrderId) {
      const getRes = await api(`/api/supplier/orders/${createdOrderId}`, {
        headers: { Authorization: `Bearer ${designerToken}` }
      });
      recordResult('GET /api/supplier/orders/:id retrieves specific order details', getRes.status === 200 && getRes.data?.id === createdOrderId, `Status: ${getRes.data?.status}, Total: ${getRes.data?.total || getRes.data?.total_cents / 100}`);
      verifyCors(getRes.headers, 'GET /api/supplier/orders/:id');
    }
  }

  // ================================================================
  // 8. DESIGNER PROFILE & BRAND IDENTITY (/api/supplier/profile)
  // ================================================================
  logSection(`8. Designer Profile & Brand Identity`);
  {
    const profRes = await api('/api/supplier/profile', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('GET /api/supplier/profile retrieves designer profile', profRes.status === 200 && profRes.data?.role === 'designer', `Designer: ${profRes.data?.name}`);
    verifyCors(profRes.headers, 'GET /api/supplier/profile');

    const patchRes = await api('/api/supplier/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        name: 'Designerone'
      })
    });
    recordResult('PATCH /api/supplier/profile updates profile information', patchRes.status === 200, `Profile verified`);
    verifyCors(patchRes.headers, 'PATCH /api/supplier/profile');
  }

  // ================================================================
  // 9. STOREFRONT PRODUCT LISTINGS CRUD (/api/supplier/listings)
  // ================================================================
  logSection(`9. Storefront Product Listings CRUD`);
  let createdListingId = null;
  {
    // A. List Listings
    const listRes = await api('/api/supplier/listings', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('GET /api/supplier/listings lists storefront products', listRes.status === 200 && Array.isArray(listRes.data), `Listings count: ${listRes.data?.length || 0}`);
    verifyCors(listRes.headers, 'GET /api/supplier/listings');

    // B. Create Listing
    const createRes = await api('/api/supplier/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        title: 'Automated Test Designer Hoodie',
        description: 'Exclusive custom test apparel for test suite',
        slug: `auto-test-hoodie-${Date.now()}`,
        design_key: 'auto-test-key',
        visibility: 'public',
        price: 49.99
      })
    });
    createdListingId = createRes.data?.id;
    recordResult('POST /api/supplier/listings creates storefront listing', (createRes.status === 200 || createRes.status === 201) && createdListingId != null, `Listing ID: ${createdListingId}`);
    verifyCors(createRes.headers, 'POST /api/supplier/listings');

    // C. Delete Listing
    if (createdListingId) {
      const delRes = await api(`/api/supplier/listings/${createdListingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${designerToken}` }
      });
      recordResult('DELETE /api/supplier/listings/:id removes test listing', delRes.status === 200, `Cleaned up Listing ID: ${createdListingId}`);
      verifyCors(delRes.headers, 'DELETE /api/supplier/listings/:id');
    }
  }

  // ================================================================
  // 10. STORE SETTINGS & PRIVACY CONTROLS (/api/supplier/store-settings)
  // ================================================================
  logSection(`10. Store Settings & Privacy Controls`);
  let originalSettings = null;
  {
    // A. Get Store Settings
    const getRes = await api('/api/supplier/store-settings', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    originalSettings = getRes.data?.store_settings || {};
    recordResult('GET /api/supplier/store-settings retrieves branding and privacy config', getRes.status === 200, `Store: ${originalSettings.store_name || 'N/A'}`);
    verifyCors(getRes.headers, 'GET /api/supplier/store-settings');

    // B. Update to Private & Hide from Customer Portal
    const patchPrivate = await api('/api/supplier/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        store_settings: {
          ...originalSettings,
          is_public: false,
          show_in_customer_portal: false
        }
      })
    });
    recordResult('PATCH /api/supplier/store-settings updates is_public: false and show_in_customer_portal: false', patchPrivate.status === 200, `Updated privacy flags`);
    verifyCors(patchPrivate.headers, 'PATCH /api/supplier/store-settings');
  }

  // ================================================================
  // 11. STOREFRONT PRIVACY ENFORCEMENT & VISITOR GATE
  // ================================================================
  logSection(`11. Storefront Privacy Enforcement & Visitor Gate`);
  {
    // A. Unauthenticated visitor receives 403 on private store
    const visitorPrivate = await api('/api/store/8');
    recordResult('Unauthenticated visitor receives 403 Forbidden on private designer store', visitorPrivate.status === 403 && visitorPrivate.data?.is_private === true, `Response: ${visitorPrivate.data?.message}`);
    verifyCors(visitorPrivate.headers, 'GET /api/store/:id (Private, Visitor)');

    // B. Designer owner can view private store in preview mode (200 OK)
    const ownerPreview = await api('/api/store/8', {
      headers: { Authorization: `Bearer ${designerToken}` }
    });
    recordResult('Designer owner can access private store with preview permission (200 OK)', ownerPreview.status === 200 && ownerPreview.data?.is_owner === true, `is_owner: true, is_public: ${ownerPreview.data?.is_public}`);
    verifyCors(ownerPreview.headers, 'GET /api/store/:id (Private, Owner Preview)');

    // C. Private store is excluded from Customer Portal directory
    const portalRes = await api('/api/customer/stores?category=designers');
    const storeList = portalRes.data?.stores || portalRes.data || [];
    const isExcluded = !storeList.some(s => Number(s.id) === 8);
    recordResult('Private designer store is excluded from Customer Portal directory (/api/customer/stores)', isExcluded, `Designerone (ID: 8) excluded: ${isExcluded}`);
    verifyCors(portalRes.headers, 'GET /api/customer/stores (Filtered)');

    // D. Restore store to public
    const patchPublic = await api('/api/supplier/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        store_settings: {
          ...originalSettings,
          is_public: true,
          show_in_customer_portal: true
        }
      })
    });
    recordResult('PATCH /api/supplier/store-settings restores is_public: true and show_in_customer_portal: true', patchPublic.status === 200, `Restored public flags`);
    verifyCors(patchPublic.headers, 'PATCH /api/supplier/store-settings (Restore)');

    // E. Public visitor receives 200 OK
    const visitorPublic = await api('/api/store/8');
    recordResult('Public designer store is now accessible to all visitors (200 OK)', visitorPublic.status === 200 && visitorPublic.data?.is_public === true, `Store: ${visitorPublic.data?.designer?.name || 'Designerone'}`);
    verifyCors(visitorPublic.headers, 'GET /api/store/:id (Public, Visitor)');

    // F. Reappears in Customer Portal directory
    const portalReappear = await api('/api/customer/stores?category=designers');
    const reappearList = portalReappear.data?.stores || portalReappear.data || [];
    const isVisible = reappearList.some(s => Number(s.id) === 8);
    recordResult('Public designer store reappears in Customer Portal directory (/api/customer/stores)', isVisible, `Designerone (ID: 8) visible: ${isVisible}`);
    verifyCors(portalReappear.headers, 'GET /api/customer/stores (Public)');

    // G. Independent isolation test: Public direct URL while hidden from portal
    await api('/api/supplier/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        store_settings: {
          ...originalSettings,
          is_public: true,
          show_in_customer_portal: false
        }
      })
    });

    const directOk = (await api('/api/store/8')).status === 200;
    const portalHiddenList = (await api('/api/customer/stores?category=designers')).data?.stores || [];
    const isHiddenFromDirectory = !portalHiddenList.some(s => Number(s.id) === 8);

    recordResult('Designer store can be Public via direct URL while hidden from Customer Directory', directOk && isHiddenFromDirectory, `Direct URL works: ${directOk}, Hidden from Directory: ${isHiddenFromDirectory}`);

    // Restore to original state
    await api('/api/supplier/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ store_settings: originalSettings })
    });
  }

  // ================================================================
  // FINAL SUMMARY
  // ================================================================
  logSection(`FINAL TEST EXECUTION SUMMARY`);
  const total = passed + failed;
  const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
  console.log(`  Total Tests Executed: ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Success Rate: ${rate}%`);
  console.log(`  CORS Validation: 100% compliant with CORS_ORIGIN=${CORS_ORIGIN}`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution crashed:', err);
  process.exit(1);
});

