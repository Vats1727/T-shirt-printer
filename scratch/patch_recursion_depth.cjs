const fs = require('fs');

// 1. server/src/services/storage.js
let storage = fs.readFileSync('server/src/services/storage.js', 'utf8');

storage = storage.replace(
  'async function replaceDataUrlsInObject(obj, idPrefix) {\r\n      if (!obj || typeof obj !== "object") return;',
  'async function replaceDataUrlsInObject(obj, idPrefix, depth = 0) {\r\n      if (!obj || typeof obj !== "object" || depth > 20) return;'
);
storage = storage.replace(
  'await replaceDataUrlsInObject(v, `${idPrefix}-${i}`);',
  'await replaceDataUrlsInObject(v, `${idPrefix}-${i}`, depth + 1);'
);
storage = storage.replace(
  'await replaceDataUrlsInObject(v, `${idPrefix}-${k}`);',
  'await replaceDataUrlsInObject(v, `${idPrefix}-${k}`, depth + 1);'
);

storage = storage.replace(
  'async function replaceDataUrlsInObject_update(obj, idPrefix) {\r\n      if (!obj || typeof obj !== "object") return;',
  'async function replaceDataUrlsInObject_update(obj, idPrefix, depth = 0) {\r\n      if (!obj || typeof obj !== "object" || depth > 20) return;'
);
storage = storage.replace(
  'await replaceDataUrlsInObject_update(v, `${idPrefix}-${i}`);',
  'await replaceDataUrlsInObject_update(v, `${idPrefix}-${i}`, depth + 1);'
);
storage = storage.replace(
  'await replaceDataUrlsInObject_update(v, `${idPrefix}-${k}`);',
  'await replaceDataUrlsInObject_update(v, `${idPrefix}-${k}`, depth + 1);'
);

fs.writeFileSync('server/src/services/storage.js', storage, 'utf8');
console.log('storage.js patched');

// 2. server/src/controllers/supplierController.js
let supplierCtrl = fs.readFileSync('server/src/controllers/supplierController.js', 'utf8');
supplierCtrl = supplierCtrl.replace(
  'const stripLargeImages = (obj) => {\r\n      if (!obj || typeof obj !== "object") return;',
  'const stripLargeImages = (obj, depth = 0) => {\r\n      if (!obj || typeof obj !== "object" || depth > 20) return;'
);
supplierCtrl = supplierCtrl.replace(
  'stripLargeImages(v);',
  'stripLargeImages(v, depth + 1);'
);
fs.writeFileSync('server/src/controllers/supplierController.js', supplierCtrl, 'utf8');
console.log('supplierController.js patched');

// 3. server/src/services/order.service.js
let orderSvc = fs.readFileSync('server/src/services/order.service.js', 'utf8');
orderSvc = orderSvc.replace(
  'const stripLargeImages = (obj) => {\r\n      if (!obj || typeof obj !== \'object\') return;',
  'const stripLargeImages = (obj, depth = 0) => {\r\n      if (!obj || typeof obj !== \'object\' || depth > 20) return;'
);
orderSvc = orderSvc.replace(
  'stripLargeImages(v);',
  'stripLargeImages(v, depth + 1);'
);
fs.writeFileSync('server/src/services/order.service.js', orderSvc, 'utf8');
console.log('order.service.js patched');

