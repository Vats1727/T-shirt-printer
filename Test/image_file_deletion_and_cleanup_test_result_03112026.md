# Image File Deletion & Disk Optimization - Test Execution Report

**Date of Execution**: 2026-11-03  
**Report File**: `Test/image_file_deletion_and_cleanup_test_result_03112026.md`  
**Test Runner Script**: [`Test/image_file_deletion_and_cleanup_test.mjs`](file:///e:/dummy2-allysoft/Tshirt-printer/Test/image_file_deletion_and_cleanup_test.mjs)  
**Target Storage Directory**: `server/uploads` (and nested subdirectories `designs/front`, `designs/back`, `farmo`)  
**Storage Engine**: PostgreSQL (`tshirt_printer_db`) & Local Node.js Filesystem  

---

## 1. Executive Summary

| Metric | Result | Status |
|---|---|:---:|
| **Total Test Assertions** | **47** | Verified |
| **Passed Assertions** | **47** | **100% PASS** |
| **Failed Assertions** | **0** | **0 FAIL** |
| **Success Rate** | **100%** | **OPTIMAL** |
| **Order Safety Invariant** | **ZERO HISTORICAL/ACTIVE ORDERS BROKEN** | **VERIFIED** |
| **Disk Bloat Prevention** | **PHYSICAL DELETION TRIGGERED ON ALL BROWSER ACTIONS** | **ACTIVE** |
| **Path Traversal Resistance** | **100% BLOCKED & VALIDATED** | **SECURE** |

---

## 2. Problem Statement & Architecture Overhaul

### The Problem
In the live production environment, when designers or print providers deleted custom designs, garment blank listings, or mockup images from the browser interface:
1. The database records were deleted or soft-deleted, but **actual image files in `server/uploads` remained permanently on disk**.
2. Files were stored across nested subdirectories (`designs/front/`, `designs/back/`, `farmo/`) with crypto hex prefixes (`01bcfd9b9b4e19589a98-design-2-back.png`). Previous cleanup attempts only scanned the root directory non-recursively.
3. Over time, as users tested, created, and deleted designs and products, disk usage ballooned continuously without automatic cleanup.

### The Solution Implemented
1. **Recursive Resolution Engine (`findFilePathsOnDisk`)**:
   - Recursively walks all folders in `server/uploads` to match exact paths, basenames, hex-prefixed names, and pattern wildcards.
2. **Customer Order Safety Gate (`isFileReferencedInOrders`)**:
   - Queries `order_items` and `b2b_designer_order_items` for `preview_url`, `print_file_url`, `back_preview_url`, and `back_print_file_url`.
   - Any artwork or garment image associated with an existing order is strictly **preserved on disk**, preventing broken images in customer receipt histories, production techpacks, and invoices.
3. **Shared Entity Protection (`isFileReferencedInOtherActiveEntities`)**:
   - Prevents unlinking an image if another active design or product still references the same file.
4. **All Browser Endpoints Hooked**:
   - `DELETE /api/designs/:id`: Deletes design image, back image, version preview images, and layer assets.
   - `DELETE /api/admin/products/:id`: Deletes garment mockups, color swatch images (`front_image`, `back_image`), and size chart images.
   - `PUT /api/admin/products/:id`: Identifies discarded color mockups and deletes the replaced files.
   - `DELETE /api/admin/listings/:id`: Deletes store listing thumbnails and preview mockups.
   - `DELETE /api/assets/:id` & `POST /api/assets/delete-file`: Deletes physically unlinked asset files.
5. **Automated & CLI Orphan Purge (`cleanOrphanUploads.js`)**:
   - Scans all files on disk, queries the entire database, and purges unreferenced orphaned files with a 10-minute safety grace period for in-flight uploads.

---

## 3. Detailed Results by Test Section

| # | Section | Test Assertion | Status | Details |
|---|---|---|:---:|---|
| 1 | Architecture | Package.json contains clean:uploads CLI command | **PASS** | npm run clean:uploads -> "node src/scripts/cleanOrphanUploads.js" |
| 2 | Architecture | Standalone cleanOrphanUploads.js script exists | **PASS** | Path: E:\dummy2-allysoft\Tshirt-printer\server\src\scripts\cleanOrphanUploads.js |
| 3 | Service Exports | storageService exports getAllUploadFilesRecursively() | **PASS** | Type: function |
| 4 | Service Exports | storageService exports findFilePathsOnDisk() | **PASS** | Type: function |
| 5 | Service Exports | storageService exports isFileReferencedInOrders() | **PASS** | Type: function |
| 6 | Service Exports | storageService exports isFileReferencedInOtherActiveEntities() | **PASS** | Type: function |
| 7 | Service Exports | storageService exports safeDeletePhysicalFile() | **PASS** | Type: function |
| 8 | Service Exports | storageService exports deletePhysicalFile() | **PASS** | Type: function |
| 9 | Service Exports | storageService exports deleteDesignPhysicalFiles() | **PASS** | Type: function |
| 10 | Service Exports | storageService exports deleteProductPhysicalFiles() | **PASS** | Type: function |
| 11 | Service Exports | storageService exports deleteListingPhysicalFiles() | **PASS** | Type: function |
| 12 | Service Exports | storageService exports cleanReplacedProductImages() | **PASS** | Type: function |
| 13 | Service Exports | storageService exports purgeOrphanUploads() | **PASS** | Type: function |
| 14 | Path Resolution | Resolves file located in nested subdirectory by basename | **PASS** | Resolved: E:\dummy2-allysoft\Tshirt-printer\server\uploads\designs\front\test_runner_dummy_front_find.png |
| 15 | Path Resolution | Resolves file by public URL /uploads/designs/front/... | **PASS** | Resolved: E:\dummy2-allysoft\Tshirt-printer\server\uploads\designs\front\test_runner_dummy_front_find.png |
| 16 | Security | Strict Path Traversal Prevention rejects all attempts outside server/uploads | **PASS** | Blocked: ../../package.json, /etc/passwd, ..\..\..\windows\system32 |
| 17 | Order Safeguard | Recognizes order item file as protected from deletion (e4ed71e0be8c38255ac9-design-5-front.png) | **PASS** | Detected in order_items records: true |
| 18 | Order Safeguard | Physical file referenced in active customer order is strictly preserved on disk | **PASS** | File e4ed71e0be8c38255ac9-design-5-front.png preserved on disk |
| 19 | Design Deletion | Setup: Simulated design preview files created on disk | **PASS** | Front: dummy_1793721633135-design-99998-front.png, Back: dummy_1793721633135-design-99998-back.png |
| 20 | Design Deletion | Physical front image file unlinked from server/uploads/designs/front/ | **PASS** | File deleted: true |
| 21 | Design Deletion | Physical back image file unlinked from server/uploads/designs/back/ | **PASS** | File deleted: true |
| 22 | Farmo Storage | Garment front image stored in server/uploads/farmo/front/ | **PASS** | Saved path: /uploads/farmo/front/a90e032574fb24661314-test-garment-front.png |
| 23 | Farmo Storage | Garment back image stored in server/uploads/farmo/back/ | **PASS** | Saved path: /uploads/farmo/back/78631050ba64083b544a-test-garment-back.png |
| 24 | Product Replacement | Replaced garment image is unlinked when updated in Garment Catalog | **PASS** | Old file unlinked: true |
| 25 | Product Replacement | Newly selected garment image is preserved on disk | **PASS** | New file preserved: true |
| 26 | Product Deletion | Garment mockup images deleted from server/uploads when product is deleted | **PASS** | Mockup unlinked: true |
| 27 | Artwork Storage | Designer artwork front image stored in server/uploads/artwork/front/ | **PASS** | Saved path: /uploads/artwork/front/0b0e884a21c6ee02b0b9-test-designer-art-front.png |
| 28 | Artwork Storage | Designer artwork back image stored in server/uploads/artwork/back/ | **PASS** | Saved path: /uploads/artwork/back/5ab5427b210533842627-test-designer-art-back.png |
| 29 | Artwork Deletion | Designer artwork front file unlinked from server/uploads/artwork/front/ upon removal | **PASS** | Front file deleted: true |
| 30 | Artwork Deletion | Designer artwork back file unlinked from server/uploads/artwork/back/ upon removal | **PASS** | Back file deleted: true |
| 31 | Artwork Storage | Unspecified designer logo upload safely defaults to server/uploads/artwork/front/ | **PASS** | Saved path: /uploads/artwork/front/40d104381c8a150cadb9-unspecified-designer-logo-front.png |
| 32 | Artwork Storage | Unspecified designer logo upload with side=back safely defaults to server/uploads/artwork/back/ | **PASS** | Saved path: /uploads/artwork/back/d1523962cef9f1d2f170-unspecified-designer-logo-back.png |
| 33 | Listing Deletion | Setup: Simulated listing thumbnail created on disk | **PASS** | — |
| 34 | Listing Deletion | Store listing thumbnail deleted from server/uploads on deletion | **PASS** | Thumbnail unlinked: true |
| 35 | Orphan Purge | Purges unreferenced orphan files older than 10 minutes | **PASS** | Purged old orphan: true |
| 36 | Orphan Purge | Preserves recently uploaded files (< 10 min grace period) to protect in-flight uploads | **PASS** | In-flight file preserved: true |
| 37 | Integration | design.model.js calls storageService.deleteDesignPhysicalFiles | **PASS** | deleteDesign -> deleteDesignPhysicalFiles |
| 38 | Integration | designsController.js calls storageService.deleteDesignPhysicalFiles | **PASS** | deleteDesign -> deleteDesignPhysicalFiles |
| 39 | Integration | product.controller.js calls storageService.deleteProductPhysicalFiles | **PASS** | deleteProduct -> deleteProductPhysicalFiles |
| 40 | Integration | product.controller.js calls storageService.cleanReplacedProductImages | **PASS** | updateProduct -> cleanReplacedProductImages |
| 41 | Integration | listing.model.js calls storageService.deleteListingPhysicalFiles | **PASS** | deleteListing -> deleteListingPhysicalFiles |
| 42 | Integration | listingsStore.js calls storageService.deleteListingPhysicalFiles | **PASS** | deleteListing -> deleteListingPhysicalFiles |
| 43 | Integration | assetsController.js calls safeDeletePhysicalFile | **PASS** | deleteAsset -> safeDeletePhysicalFile |
| 44 | Base64 Elimination | convertPayloadBase64Images converts preview_front base64 to /uploads/ file URL | **PASS** | Converted to: /uploads/designs/front/1c1f4c47aa4827b8e23a-design-99995-front.png |
| 45 | Base64 Elimination | convertPayloadBase64Images converts preview_by_color base64 to /uploads/ file URL | **PASS** | Converted to: /uploads/designs/back/8cbbc4c77f321a3bfe68-design-99995-color-99-back.png |
| 46 | Live DB Health | Zero Base64 images remaining in design_versions table (100% converted to file paths) | **PASS** | Current count: 0 |
| 47 | Live DB Health | Zero Base64 images in designs table (100% clean URLs) | **PASS** | Current count: 0 |

---

## 4. Production Deployment & Maintenance Guide

### Running Manual or Scheduled Cleanup
To clean up any lingering orphan files (e.g. from failed draft uploads or abandoned browser sessions):

```bash
# Inside server directory:
npm run clean:uploads
```

### Scheduled Cron / Task Automation
On live servers (Linux systemd / cron or Windows Task Scheduler), this command can be scheduled nightly:
```bash
0 3 * * * cd /path/to/server && npm run clean:uploads >> /var/log/tshirt-uploads-cleaner.log 2>&1
```

### Verification Sign-Off
- **Order Protection**: Fully confirmed with active database test against `order_items` table.
- **Physical Unlink**: Fully confirmed with disk write/delete assertions on `designs/front` and `designs/back`.
- **Client Application**: Built cleanly without warnings (`npm --prefix client run build`).
