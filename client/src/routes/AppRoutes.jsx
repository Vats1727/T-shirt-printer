import React from 'react';
import { Switch, Route } from 'wouter';

import Home from '@/pages/Home/index.jsx';
import NotFound from '@/pages/NotFound/index.jsx';
import Login from '@/pages/Auth/Login.jsx';
import Register from '@/pages/Auth/Register.jsx';

import AdminDashboard from '@/pages/Admin/Dashboard.jsx';
import AdminClothes from '@/pages/Admin/Clothes.jsx';
import AdminOrders from '@/pages/Admin/Orders.jsx';
import AdminProfile from '@/pages/Admin/Profile.jsx';
import AdminDesigners from '@/pages/Admin/Designers.jsx';
import AdminRoute from '@/routes/AdminRoute.jsx';

import SupplierDashboard from '@/pages/Supplier/Dashboard.jsx';
import SupplierOrder from '@/pages/Supplier/Order.jsx';
import SupplierProductOrder from '@/pages/Supplier/ProductOrder.jsx';
import SupplierSavedDesigns from '@/pages/Supplier/SavedDesigns.jsx';
import SupplierCreateListing from '@/pages/Supplier/CreateListing.jsx';
import SupplierStoreCustomizer from '@/pages/Supplier/StoreCustomizer.jsx';
import SupplierProfile from '@/pages/Supplier/Profile.jsx';
import SupplierRoute from '@/routes/SupplierRoute.jsx';

import StorePage from '@/pages/Store/Store.jsx';
import StoreProduct from '@/pages/Store/Product.jsx';

import PortalAdminDashboard from '@/pages/Portal/Dashboard.jsx';
import PortalAdminRoute from '@/routes/PortalAdminRoute.jsx';

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/home" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin/login" component={Login} />

      {/* Admin / Print Provider Protected Routes */}
      <AdminRoute path="/admin/dashboard" component={AdminDashboard} />
      <AdminRoute path="/admin/clothes" component={AdminClothes} />
      <Route path="/admin/orders" component={AdminOrders} />
      <AdminRoute path="/admin/profile" component={AdminProfile} />
      <AdminRoute path="/admin/designers" component={AdminDesigners} />

      {/* Supplier / Designer Protected Routes */}
      <Route path="/supplier/login" component={Login} />
      <SupplierRoute path="/supplier/dashboard" component={SupplierDashboard} />
      <SupplierRoute path="/supplier/saved-designs/:designerId?" component={SupplierSavedDesigns} />
      <SupplierRoute path="/supplier/listings/create" component={SupplierCreateListing} />
      <SupplierRoute path="/supplier/customize-store" component={SupplierStoreCustomizer} />
      <SupplierRoute path="/supplier/store-settings" component={SupplierStoreCustomizer} />
      <SupplierRoute path="/supplier/order" component={SupplierOrder} />
      <SupplierRoute path="/supplier/product/:id" component={SupplierProductOrder} />
      <SupplierRoute path="/supplier/profile" component={SupplierProfile} />

      {/* Public Storefront Routes */}
      <Route path="/store/:supplierId" component={StorePage} />
      <Route path="/listing/:slug" component={StoreProduct} />
      <Route path="/listing/id/:id" component={StoreProduct} />

      {/* Portal Admin Protected Routes */}
      <PortalAdminRoute path="/portal/dashboard" component={PortalAdminDashboard} />

      {/* 404 Catch-All */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default AppRoutes;
