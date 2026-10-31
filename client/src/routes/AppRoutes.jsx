import React from 'react';
import { Switch, Route, Redirect } from 'wouter';
import { useAuth } from '@/context/AuthContext';

import Home from '@/pages/Home/index.jsx';
import NotFound from '@/pages/NotFound/index.jsx';
import Login from '@/pages/Auth/Login.jsx';
import Register from '@/pages/Auth/Register.jsx';

import AdminDashboard from '@/pages/Admin/Dashboard.jsx';
import AdminClothes from '@/pages/Admin/Clothes.jsx';
import AdminOrders from '@/pages/Admin/Orders.jsx';
import AdminProfile from '@/pages/Admin/Profile.jsx';
import AdminDesigners from '@/pages/Admin/Designers.jsx';
import AdminDesignerDesigns from '@/pages/Admin/DesignerDesigns.jsx';
import AdminListings from '@/pages/Admin/Listings.jsx';
import AdminCreateListing from '@/pages/Admin/CreateListing.jsx';
import AdminStoreCustomizer from '@/pages/Admin/StoreCustomizer.jsx';
import AdminRoute from '@/routes/AdminRoute.jsx';

import SupplierDashboard from '@/pages/Supplier/Dashboard.jsx';
import SupplierOrders from '@/pages/Supplier/Orders.jsx';
import SupplierOrder from '@/pages/Supplier/Order.jsx';
import SupplierProductOrder from '@/pages/Supplier/ProductOrder.jsx';
import SupplierProductPurchase from '@/pages/Supplier/ProductPurchase.jsx';
import SupplierSavedDesigns from '@/pages/Supplier/SavedDesigns.jsx';
import SupplierListings from '@/pages/Supplier/Listings.jsx';
import SupplierCreateListing from '@/pages/Supplier/CreateListing.jsx';
import SupplierStoreCustomizer from '@/pages/Supplier/StoreCustomizer.jsx';
import SupplierProfile from '@/pages/Supplier/Profile.jsx';
import SupplierRoute from '@/routes/SupplierRoute.jsx';

import StorePage from '@/pages/Store/Store.jsx';
import StoreProduct from '@/pages/Store/Product.jsx';
import Checkout from '@/pages/Store/Checkout.jsx';

import PortalAdminDashboard from '@/pages/Portal/Dashboard.jsx';
import PortalAdminRequests from '@/pages/Portal/Requests.jsx';
import PortalAdminFinancials from '@/pages/Portal/FinancialSettings.jsx';
import PortalAdminLedger from '@/pages/Portal/PartnerLedger.jsx';
import PortalAdminProfile from '@/pages/Portal/Profile.jsx';
import PortalAdminRoute from '@/routes/PortalAdminRoute.jsx';

import CustomerDashboard from '@/pages/Customer/Dashboard.jsx';
import CustomerOrders from '@/pages/Customer/Orders.jsx';
import CustomerRoute from '@/routes/CustomerRoute.jsx';

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
      <AdminRoute path="/admin/orders" component={AdminOrders} />
      <AdminRoute path="/admin/profile" component={AdminProfile} />
      <AdminRoute path="/admin/designers" component={AdminDesigners} />
      <AdminRoute path="/admin/designer-designs" component={AdminDesignerDesigns} />
      <AdminRoute path="/admin/listings/create" component={AdminCreateListing} />
      <AdminRoute path="/admin/listings" component={AdminListings} />
      <AdminRoute path="/admin/customize-store" component={AdminStoreCustomizer} />
      <AdminRoute path="/admin/store-settings" component={AdminStoreCustomizer} />

      {/* Universal /orders and /order routes */}
      <Route path="/orders">
        {() => {
          const { user } = useAuth();
          if (user?.role === 'customer') {
            return <Redirect to="/customer/orders" />;
          }
          if (user?.role === 'print_provider' || user?.role === 'admin') {
            return <Redirect to="/admin/orders" />;
          }
          return <Redirect to="/supplier/orders" />;
        }}
      </Route>
      <Route path="/order">
        {() => {
          const { user } = useAuth();
          if (user?.role === 'customer') {
            return <Redirect to="/customer/orders" />;
          }
          if (user?.role === 'print_provider' || user?.role === 'admin') {
            return <Redirect to="/admin/orders" />;
          }
          return <Redirect to="/supplier/orders" />;
        }}
      </Route>

      <Route path="/supplier/login" component={Login} />
      <Route path="/supplier/providers">
        {() => <Redirect to="/supplier/dashboard" />}
      </Route>
      <SupplierRoute path="/supplier/dashboard" component={SupplierDashboard} />
      <SupplierRoute path="/supplier/saved-designs/:designerId?" component={SupplierSavedDesigns} />
      <SupplierRoute path="/supplier/listings/create" component={SupplierCreateListing} />
      <SupplierRoute path="/supplier/listings" component={SupplierListings} />
      <SupplierRoute path="/supplier/customize-store" component={SupplierStoreCustomizer} />
      <SupplierRoute path="/supplier/store-settings" component={SupplierStoreCustomizer} />
      <SupplierRoute path="/supplier/orders" component={SupplierOrders} />
      <SupplierRoute path="/supplier/order" component={SupplierOrders} />
      <SupplierRoute path="/supplier/product/:id/order" component={SupplierProductPurchase} />
      <SupplierRoute path="/supplier/order-product/:id" component={SupplierProductPurchase} />
      <SupplierRoute path="/supplier/product/:id" component={SupplierProductOrder} />
      <SupplierRoute path="/supplier/profile" component={SupplierProfile} />

      {/* Public Storefront Routes */}
      <Route path="/store/:supplierId" component={StorePage} />
      <Route path="/listing/:slug" component={StoreProduct} />
      <Route path="/listing/id/:id" component={StoreProduct} />
      <Route path="/checkout" component={Checkout} />

      {/* Customer Protected Routes */}
      <CustomerRoute path="/customer/dashboard" component={CustomerDashboard} />
      <CustomerRoute path="/customer" component={CustomerDashboard} />
      <CustomerRoute path="/customer/orders" component={CustomerOrders} />

      {/* Portal Admin Protected Routes */}
      <PortalAdminRoute path="/portal/dashboard" component={PortalAdminDashboard} />
      <PortalAdminRoute path="/portal/requests" component={PortalAdminRequests} />
      <PortalAdminRoute path="/portal/financials" component={PortalAdminFinancials} />
      <PortalAdminRoute path="/portal/ledger" component={PortalAdminLedger} />
      <PortalAdminRoute path="/portal/profile" component={PortalAdminProfile} />

      {/* 404 Catch-All */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default AppRoutes;
