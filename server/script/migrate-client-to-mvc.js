import fs from 'fs/promises';
import path from 'path';
import esbuild from 'esbuild';

const clientDir = path.resolve('..', 'client');
const srcDir = path.join(clientDir, 'src');

async function transformFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const isTsx = filePath.endsWith('.tsx');
  const res = await esbuild.transform(content, {
    loader: isTsx ? 'tsx' : 'ts',
    jsx: 'preserve'
  });
  return res.code;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function convertFile(srcPath, destPath, replaceImports = true) {
  await ensureDir(path.dirname(destPath));
  let code = await transformFile(srcPath);

  if (replaceImports) {
    // Update import paths to new MVC structure
    code = code.replace(/@\/contexts\//g, '@/context/');
    code = code.replace(/@shared\/obfuscate/g, '@/utils/idEncoder');
    code = code.replace(/@shared\/routes/g, '@/services/api');
    code = code.replace(/@\/components\/layout\/Header/g, '@/layouts/Header');
    code = code.replace(/@\/components\/layout\/Footer/g, '@/layouts/Footer');
    code = code.replace(/@\/components\/AppSidebar/g, '@/layouts/AppSidebar');
    code = code.replace(/@\/components\/DashboardLayout/g, '@/layouts/DashboardLayout');
    code = code.replace(/@\/components\/AdminRoute/g, '@/routes/AdminRoute');
    code = code.replace(/@\/components\/SupplierRoute/g, '@/routes/SupplierRoute');
    code = code.replace(/@\/components\/PortalAdminRoute/g, '@/routes/PortalAdminRoute');
    code = code.replace(/@\/components\/design\/DesignCanvas/g, '@/components/common/DesignCanvas');
    code = code.replace(/@\/components\/supplier\/SavedDesignCard/g, '@/components/common/SavedDesignCard');
  }

  await fs.writeFile(destPath, code, 'utf8');
  console.log(`Converted: ${path.relative(clientDir, destPath)}`);
}

async function run() {
  console.log('--- Starting Client MVC Migration ---');

  // 1. Convert Layouts
  await convertFile(path.join(srcDir, 'components/layout/Header.tsx'), path.join(srcDir, 'layouts/Header.jsx'));
  await convertFile(path.join(srcDir, 'components/layout/Footer.tsx'), path.join(srcDir, 'layouts/Footer.jsx'));

  // 2. Convert Common Components
  await convertFile(path.join(srcDir, 'components/design/DesignCanvas.tsx'), path.join(srcDir, 'components/common/DesignCanvas.jsx'));
  await convertFile(path.join(srcDir, 'components/supplier/SavedDesignCard.tsx'), path.join(srcDir, 'components/common/SavedDesignCard.jsx'));

  // 3. Convert Routes / Route Guards
  await convertFile(path.join(srcDir, 'components/AdminRoute.tsx'), path.join(srcDir, 'routes/AdminRoute.jsx'));
  await convertFile(path.join(srcDir, 'components/SupplierRoute.tsx'), path.join(srcDir, 'routes/SupplierRoute.jsx'));
  await convertFile(path.join(srcDir, 'components/PortalAdminRoute.tsx'), path.join(srcDir, 'routes/PortalAdminRoute.jsx'));

  // 4. Convert Pages to new MVC folders
  await convertFile(path.join(srcDir, 'pages/Home.tsx'), path.join(srcDir, 'pages/Home/index.jsx'));
  await convertFile(path.join(srcDir, 'pages/not-found.tsx'), path.join(srcDir, 'pages/NotFound/index.jsx'));
  await convertFile(path.join(srcDir, 'pages/Login.tsx'), path.join(srcDir, 'pages/Auth/Login.jsx'));
  await convertFile(path.join(srcDir, 'pages/Register.tsx'), path.join(srcDir, 'pages/Auth/Register.jsx'));

  // Admin pages
  const adminPages = ['Clothes.tsx', 'Dashboard.tsx', 'Designers.tsx', 'Orders.tsx', 'Profile.tsx'];
  for (const page of adminPages) {
    const srcPage = path.join(srcDir, 'pages/admin', page);
    const destPage = path.join(srcDir, 'pages/Admin', page.replace('.tsx', '.jsx'));
    try {
      await convertFile(srcPage, destPage);
    } catch (e) {
      console.warn(`Skipping missing ${page}`);
    }
  }

  // Portal pages
  await convertFile(path.join(srcDir, 'pages/portal/Dashboard.tsx'), path.join(srcDir, 'pages/Portal/Dashboard.jsx'));

  // Supplier pages
  const supplierPages = ['Dashboard.tsx', 'Order.tsx', 'ProductOrder.tsx', 'Profile.tsx', 'SavedDesigns.tsx', 'StoreCustomizer.tsx'];
  for (const page of supplierPages) {
    const srcPage = path.join(srcDir, 'pages/supplier', page);
    const destPage = path.join(srcDir, 'pages/Supplier', page.replace('.tsx', '.jsx'));
    try {
      await convertFile(srcPage, destPage);
    } catch (e) {
      console.warn(`Skipping missing ${page}`);
    }
  }
  await convertFile(path.join(srcDir, 'pages/supplier/listings/CreateListing.tsx'), path.join(srcDir, 'pages/Supplier/CreateListing.jsx'));

  // Store pages
  const storePages = ['Product.tsx', 'Store.tsx'];
  for (const page of storePages) {
    const srcPage = path.join(srcDir, 'pages/store', page);
    const destPage = path.join(srcDir, 'pages/Store', page.replace('.tsx', '.jsx'));
    try {
      await convertFile(srcPage, destPage);
    } catch (e) {
      console.warn(`Skipping missing ${page}`);
    }
  }

  // 5. Convert all UI components in src/components/ui/
  const uiDir = path.join(srcDir, 'components/ui');
  const uiFiles = await fs.readdir(uiDir);
  for (const file of uiFiles) {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const srcPath = path.join(uiDir, file);
      const destPath = path.join(uiDir, file.replace(/\.tsx?$/, file.endsWith('.tsx') ? '.jsx' : '.js'));
      await convertFile(srcPath, destPath);
    }
  }

  console.log('--- Client MVC Migration Finished ---');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
