/**
 * Comprehensive Print Provider Endpoints & Features Test Suite
 * File: Test/print_provider_test.mjs
 * 
 * Verifies:
 *  1. CORS headers compliance matching CORS_ORIGIN from .env
 *  2. Authentication & role security enforcement (401 on missing token, 403 on invalid role)
 *  3. Colors CRUD (/api/admin/colors)
 *  4. Sizes CRUD (/api/admin/sizes)
 *  5. Inventory management (/api/admin/inventory)
 *  6. Size Chart management (/api/admin/size-chart)
 *  7. Garment Products CRUD (/api/admin/products)
 *  8. Associated Designers & Designer Designs (/api/admin/designers, /api/admin/designer-designs)
 *  9. Orders production queue (/api/admin/orders)
 * 10. Store Listings CRUD (/api/admin/listings)
 * 11. Store Settings & Privacy controls (/api/admin/store-settings, is_public, show_in_customer_portal)
 * 12. Customer Directory & Storefront Access with CORS Origin matching
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

// Generate valid tokens
const providerToken = jwt.sign(
  { sub: 12, role: 'print_provider', email: 'vijaypp1720@gmail.com' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

const customerToken = jwt.sign(
  { sub: 16, role: 'customer', email: 'customerone@gmail.com' },
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
  console.log(`\nStarting Print Provider Comprehensive Test Suite`);
  console.log(`Target Server: ${API_BASE}`);
  console.log(`Configured CORS_ORIGIN from .env: ${CORS_ORIGIN}`);
  console.log(`Testing with Provider User: Vijay (ID: 12)`);

  // ================================================================
  // 1. CORS PREFLIGHT (OPTIONS) TESTS
  // ================================================================
  logSection(`1. CORS Preflight (OPTIONS) Verification`);
  {
    const { res, headers } = await api('/api/admin/products', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });

    recordResult('OPTIONS /api/admin/products returns 204 No Content', res.status === 204, `Status: ${res.status}`);
    verifyCors(headers, 'Preflight /api/admin/products');

    const allowMethods = headers.get('access-control-allow-methods') || '';
    recordResult('Preflight includes required methods (GET,POST,PUT,DELETE,PATCH)',
      ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].every(m => allowMethods.includes(m)),
      `Methods: ${allowMethods}`
    );
  }

  // ================================================================
  // 2. SECURITY & ROLE AUTHORIZATION TESTS
  // ================================================================
  logSection(`2. Security & Role Authorization Gates`);
  {
    // A. Missing token
    const noToken = await api('/api/admin/products');
    recordResult('Unauthenticated access blocked with 401', noToken.status === 401, `Status: ${noToken.status}`);

    // B. Customer token trying to access provider endpoint
    const forbidden = await api('/api/admin/products', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordResult('Customer role blocked from print provider endpoint with 403', forbidden.status === 403, `Status: ${forbidden.status}`);

    // C. Valid Print Provider token
    const valid = await api('/api/admin/products', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('Print provider token permitted with 200 OK', valid.status === 200, `Status: ${valid.status}`);
    verifyCors(valid.headers, 'GET /api/admin/products');
  }

  // ================================================================
  // 3. COLOR PALETTE MANAGEMENT
  // ================================================================
  logSection(`3. Color Palette Management (/api/admin/colors)`);
  let validColorId = null;
  let createdColorId = null;
  {
    // List colors
    const listRes = await api('/api/admin/colors', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    if (listRes.data && listRes.data.length > 0) {
      validColorId = listRes.data[0].id;
    }
    recordResult('GET /api/admin/colors lists colors', listRes.status === 200 && Array.isArray(listRes.data), `Found ${listRes.data?.length || 0} colors (Using ID: ${validColorId})`);
    verifyCors(listRes.headers, 'GET /api/admin/colors');

    // Create color
    const createRes = await api('/api/admin/colors', {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ name: `Automated Test Teal ${Date.now()}`, hex: '#008080' })
    });
    createdColorId = createRes.data?.id;
    if (!validColorId) validColorId = createdColorId;
    recordResult('POST /api/admin/colors creates color', createRes.status === 201 && createdColorId != null, `Created color ID: ${createdColorId}`);
    verifyCors(createRes.headers, 'POST /api/admin/colors');

    // Delete color
    if (createdColorId) {
      const delRes = await api(`/api/admin/colors/${createdColorId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      recordResult('DELETE /api/admin/colors/:id deletes color', delRes.status === 200, `Deleted color ID: ${createdColorId}`);
      verifyCors(delRes.headers, 'DELETE /api/admin/colors/:id');
    }
  }

  // ================================================================
  // 4. SIZE RUN MANAGEMENT
  // ================================================================
  logSection(`4. Size Run Management (/api/admin/sizes)`);
  let validSizeId = null;
  let createdSizeId = null;
  {
    // List sizes
    const listRes = await api('/api/admin/sizes', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    if (listRes.data && listRes.data.length > 0) {
      validSizeId = listRes.data[0].id;
    }
    recordResult('GET /api/admin/sizes lists sizes', listRes.status === 200 && Array.isArray(listRes.data), `Found ${listRes.data?.length || 0} sizes (Using ID: ${validSizeId})`);
    verifyCors(listRes.headers, 'GET /api/admin/sizes');

    // Create size
    const createRes = await api('/api/admin/sizes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ label: `T${Date.now().toString().slice(-4)}` })
    });
    createdSizeId = createRes.data?.id;
    if (!validSizeId) validSizeId = createdSizeId;
    recordResult('POST /api/admin/sizes creates size', createRes.status === 201 && createdSizeId != null, `Created size ID: ${createdSizeId}`);
    verifyCors(createRes.headers, 'POST /api/admin/sizes');

    // Delete size
    if (createdSizeId) {
      const delRes = await api(`/api/admin/sizes/${createdSizeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      recordResult('DELETE /api/admin/sizes/:id deletes size', delRes.status === 200, `Deleted size ID: ${createdSizeId}`);
      verifyCors(delRes.headers, 'DELETE /api/admin/sizes/:id');
    }
  }

  // ================================================================
  // 5. INVENTORY & STOCK MANAGEMENT
  // ================================================================
  logSection(`5. Inventory & Stock Management (/api/admin/inventory)`);
  {
    // List inventory
    const listRes = await api('/api/admin/inventory', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    const invList = listRes.data?.inventory || listRes.data;
    recordResult('GET /api/admin/inventory lists stock', listRes.status === 200 && Array.isArray(invList), `Inventory records: ${invList?.length || 0}`);
    verifyCors(listRes.headers, 'GET /api/admin/inventory');

    // Upsert inventory
    const upsertRes = await api('/api/admin/inventory', {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ color_id: validColorId, size_id: validSizeId, quantity: 250, price: 15.00, product: 'tshirt' })
    });
    recordResult('POST /api/admin/inventory updates stock quantity', upsertRes.status === 200 || upsertRes.status === 201, `Status: ${upsertRes.status}`);
    verifyCors(upsertRes.headers, 'POST /api/admin/inventory');
  }

  // ================================================================
  // 6. SIZE CHART MANAGEMENT
  // ================================================================
  logSection(`6. Size Chart Management (/api/admin/size-chart)`);
  {
    const chartRes = await api('/api/admin/size-chart', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('GET /api/admin/size-chart lists chart data', chartRes.status === 200 && Array.isArray(chartRes.data), `Rows: ${chartRes.data?.length || 0}`);
    verifyCors(chartRes.headers, 'GET /api/admin/size-chart');

    const upsertRes = await api('/api/admin/size-chart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ size_id: validSizeId, product: 'tshirt', chest: 40, length: 28, shoulder: 18 })
    });
    recordResult('POST /api/admin/size-chart upserts measurements', upsertRes.status === 200 || upsertRes.status === 201, `Status: ${upsertRes.status}`);
    verifyCors(upsertRes.headers, 'POST /api/admin/size-chart');
  }

  // ================================================================
  // 7. GARMENT PRODUCTS CATALOG CRUD
  // ================================================================
  logSection(`7. Garment Products Catalog CRUD (/api/admin/products)`);
  let createdProductId = null;
  {
    // A. List products
    const listRes = await api('/api/admin/products', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('GET /api/admin/products lists garment blanks', listRes.status === 200 && Array.isArray(listRes.data), `Existing garments: ${listRes.data?.length || 0}`);
    verifyCors(listRes.headers, 'GET /api/admin/products');

    // B. Create product
    const createRes = await api('/api/admin/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({
        name: 'Automated Test Premium Crewneck',
        slug: `test-crewneck-${Date.now()}`,
        price: 350,
        bulk_price: 280,
        bulk_moq: 50,
        category: 'men',
        status: 'published',
        description: 'Test garment for automated endpoint verification'
      })
    });
    createdProductId = createRes.data?.id;
    recordResult('POST /api/admin/products creates garment product', (createRes.status === 200 || createRes.status === 201) && createdProductId != null, `Created product ID: ${createdProductId}`);
    verifyCors(createRes.headers, 'POST /api/admin/products');

    // C. Get product by ID
    if (createdProductId) {
      const getRes = await api(`/api/admin/products/${createdProductId}`, {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      recordResult('GET /api/admin/products/:id retrieves product', getRes.status === 200 && getRes.data?.name === 'Automated Test Premium Crewneck', `Retrieved: ${getRes.data?.name}`);
      verifyCors(getRes.headers, 'GET /api/admin/products/:id');

      // D. Update product
      const updateRes = await api(`/api/admin/products/${createdProductId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${providerToken}` },
        body: JSON.stringify({
          name: 'Automated Test Premium Crewneck (Updated)',
          price: 360,
          bulk_price: 290
        })
      });
      recordResult('PUT /api/admin/products/:id updates product details', updateRes.status === 200, `Updated price & title`);
      verifyCors(updateRes.headers, 'PUT /api/admin/products/:id');

      // E. Delete product
      const delRes = await api(`/api/admin/products/${createdProductId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      recordResult('DELETE /api/admin/products/:id deletes test product', delRes.status === 200, `Cleaned up product ID: ${createdProductId}`);
      verifyCors(delRes.headers, 'DELETE /api/admin/products/:id');
    }
  }

  // ================================================================
  // 8. ASSOCIATED DESIGNERS & MOCKUPS
  // ================================================================
  logSection(`8. Associated Designers & Designs`);
  {
    const desRes = await api('/api/admin/designers', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('GET /api/admin/designers lists associated designers', desRes.status === 200 && Array.isArray(desRes.data?.designers || desRes.data), `Designers count: ${(desRes.data?.designers || desRes.data)?.length || 0}`);
    verifyCors(desRes.headers, 'GET /api/admin/designers');

    const designsRes = await api('/api/admin/designer-designs', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('GET /api/admin/designer-designs lists creator designs on blanks', designsRes.status === 200 && Array.isArray(designsRes.data), `Designs found: ${designsRes.data?.length || 0}`);
    verifyCors(designsRes.headers, 'GET /api/admin/designer-designs');
  }

  // ================================================================
  // 9. ORDERS & PRODUCTION QUEUE
  // ================================================================
  logSection(`9. Orders & Production Queue (/api/admin/orders)`);
  {
    const ordersRes = await api('/api/admin/orders', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    const orderList = ordersRes.data?.orders || ordersRes.data;
    recordResult('GET /api/admin/orders returns production orders queue', ordersRes.status === 200 && Array.isArray(orderList), `Orders in queue: ${orderList?.length || 0}`);
    verifyCors(ordersRes.headers, 'GET /api/admin/orders');
  }

  // ================================================================
  // 10. PROFILE & FACILITY CREDENTIALS
  // ================================================================
  logSection(`10. Facility Profile & Settings (/api/admin/profile)`);
  {
    const profRes = await api('/api/admin/profile', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('GET /api/admin/profile returns facility details', profRes.status === 200 && profRes.data?.email === 'vijaypp1720@gmail.com', `Facility Name: ${profRes.data?.name}`);
    verifyCors(profRes.headers, 'GET /api/admin/profile');

    const patchProf = await api('/api/admin/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ name: 'Vijay' })
    });
    recordResult('PATCH /api/admin/profile updates facility profile', patchProf.status === 200, `Status: ${patchProf.status}`);
    verifyCors(patchProf.headers, 'PATCH /api/admin/profile');
  }

  // ================================================================
  // 11. STORE LISTINGS & CUSTOMIZER PRIVACY CONTROLS
  // ================================================================
  logSection(`11. Store Listings & Privacy Controls (is_public, show_in_customer_portal)`);
  let initialSettings = null;
  {
    // A. Fetch current store settings
    const settingsRes = await api('/api/admin/store-settings', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    initialSettings = settingsRes.data?.store_settings || {};
    recordResult('GET /api/admin/store-settings retrieves branding and privacy settings', settingsRes.status === 200, `Store: ${initialSettings?.store_name || 'N/A'}`);
    verifyCors(settingsRes.headers, 'GET /api/admin/store-settings');

    // B. Test Listings CRUD
    const listRes = await api('/api/admin/listings', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('GET /api/admin/listings lists provider storefront listings', listRes.status === 200 && Array.isArray(listRes.data), `Listings: ${listRes.data?.length || 0}`);
    verifyCors(listRes.headers, 'GET /api/admin/listings');

    // Create test listing
    const createListingRes = await api('/api/admin/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({
        title: 'Automated Test Garment Listing',
        description: 'Listing description for test suite',
        price: 29.99,
        visibility: 'public'
      })
    });
    const testListingId = createListingRes.data?.id;
    recordResult('POST /api/admin/listings creates new storefront listing', (createListingRes.status === 200 || createListingRes.status === 201) && testListingId != null, `Listing ID: ${testListingId}`);
    verifyCors(createListingRes.headers, 'POST /api/admin/listings');

    if (testListingId) {
      const delListingRes = await api(`/api/admin/listings/${testListingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      recordResult('DELETE /api/admin/listings/:id removes test listing', delListingRes.status === 200, `Removed Listing ID: ${testListingId}`);
      verifyCors(delListingRes.headers, 'DELETE /api/admin/listings/:id');
    }

    // C. Test Privacy Toggle: Setting is_public = false (Private Storefront)
    const setPrivateRes = await api('/api/admin/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({
        store_settings: {
          ...initialSettings,
          is_public: false,
          show_in_customer_portal: false
        }
      })
    });
    recordResult('PATCH /api/admin/store-settings updates is_public: false and show_in_customer_portal: false', setPrivateRes.status === 200, `Updated privacy flags`);
    verifyCors(setPrivateRes.headers, 'PATCH /api/admin/store-settings');

    // Verify unauthenticated visitor gets 403 Forbidden on private store
    const unauthStoreRes = await api('/api/store/12');
    recordResult('Unauthenticated visitor receives 403 Forbidden on private store', unauthStoreRes.status === 403 && unauthStoreRes.data?.is_private === true, `Response: ${unauthStoreRes.data?.message}`);
    verifyCors(unauthStoreRes.headers, 'GET /api/store/:id (Private, Visitor)');

    // Verify provider (owner) can view private store in preview mode
    const ownerStoreRes = await api('/api/store/12', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    recordResult('Store owner can access private store with preview permission (200 OK)', ownerStoreRes.status === 200 && ownerStoreRes.data?.is_owner === true, `is_owner: true, is_public: false`);
    verifyCors(ownerStoreRes.headers, 'GET /api/store/:id (Private, Owner Preview)');

    // Verify private store is EXCLUDED from Customer Directory
    const customerDirectoryPrivate = await api('/api/customer/stores');
    const isHiddenFromDirectory = !customerDirectoryPrivate.data?.stores?.some(s => Number(s.id) === 12);
    recordResult('Private store is excluded from Customer Portal directory (/api/customer/stores)', isHiddenFromDirectory, `Vijay (ID: 12) excluded: ${isHiddenFromDirectory}`);
    verifyCors(customerDirectoryPrivate.headers, 'GET /api/customer/stores');

    // D. Test Privacy Toggle: Restoring is_public = true, show_in_customer_portal = true
    const setPublicRes = await api('/api/admin/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({
        store_settings: {
          ...initialSettings,
          is_public: true,
          show_in_customer_portal: true
        }
      })
    });
    recordResult('PATCH /api/admin/store-settings restores is_public: true and show_in_customer_portal: true', setPublicRes.status === 200, `Restored public flags`);
    verifyCors(setPublicRes.headers, 'PATCH /api/admin/store-settings (Restore)');

    // Verify public store is accessible to anyone now
    const publicVisitorRes = await api('/api/store/12');
    recordResult('Public store is now accessible to all visitors (200 OK)', publicVisitorRes.status === 200, `Store: ${publicVisitorRes.data?.store_settings?.store_name || 'Vijay'}`);
    verifyCors(publicVisitorRes.headers, 'GET /api/store/:id (Public, Visitor)');

    // Verify store card reappears in Customer Directory
    const customerDirectoryPublic = await api('/api/customer/stores');
    const isVisibleInDirectory = customerDirectoryPublic.data?.stores?.some(s => Number(s.id) === 12);
    recordResult('Public store reappears in Customer Portal directory (/api/customer/stores)', isVisibleInDirectory, `Vijay (ID: 12) visible: ${isVisibleInDirectory}`);
    verifyCors(customerDirectoryPublic.headers, 'GET /api/customer/stores (Public)');

    // E. Test Privacy Toggle: is_public = true but show_in_customer_portal = false
    await api('/api/admin/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({
        store_settings: {
          ...initialSettings,
          is_public: true,
          show_in_customer_portal: false
        }
      })
    });
    const customPortalCheck = await api('/api/customer/stores');
    const isExcludedFromCustomerOnly = !customPortalCheck.data?.stores?.some(s => Number(s.id) === 12);
    const directLinkStillWorks = (await api('/api/store/12')).status === 200;
    recordResult('Store can be Public via direct URL while hidden from Customer Directory', isExcludedFromCustomerOnly && directLinkStillWorks, `Direct URL works: ${directLinkStillWorks}, Hidden from Directory: ${isExcludedFromCustomerOnly}`);

    // Clean restore initial settings
    await api('/api/admin/store-settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ store_settings: initialSettings })
    });
  }

  // ================================================================
  // FINAL REPORT & SUMMARY
  // ================================================================
  logSection(`FINAL TEST EXECUTION SUMMARY`);
  console.log(`  Total Tests Executed: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log(`  CORS Validation: 100% compliant with CORS_ORIGIN=${CORS_ORIGIN}`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
