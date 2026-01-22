import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoadingProvider, useLoading } from '@/contexts/LoadingContext';
import Loader from '@/components/ui/Loader';
import { useLocation } from 'wouter';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminClothes from '@/pages/admin/Clothes';
import AdminOrders from '@/pages/admin/Orders';
import AdminRoute from '@/components/AdminRoute';
import SupplierDashboard from '@/pages/supplier/Dashboard';
import SupplierOrder from '@/pages/supplier/Order';
import SupplierProductOrder from '@/pages/supplier/ProductOrder';
import SupplierSavedDesigns from '@/pages/supplier/SavedDesigns';
import SupplierRoute from '@/components/SupplierRoute';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin/login" component={Login} />
      <AdminRoute path="/admin/dashboard" component={AdminDashboard} />
      <AdminRoute path="/admin/clothes" component={AdminClothes} />
      <AdminRoute path="/admin/orders" component={AdminOrders} />
      <Route path="/supplier/login" component={Login} />
      <SupplierRoute path="/supplier/dashboard" component={SupplierDashboard} />
      <SupplierRoute path="/supplier/saved-designs" component={SupplierSavedDesigns} />
      <SupplierRoute path="/supplier/order" component={SupplierOrder} />
      <SupplierRoute path="/supplier/product/:id" component={SupplierProductOrder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RouteChangeListener() {
  const [, location] = useLocation();
  const { show, hide } = useLoading();
  const isFetching = useIsFetching();

  React.useEffect(() => {
    // show loader on route change
    show();
    const t = setTimeout(() => {
      // if there are ongoing queries, keep loader until they finish
      if (isFetching > 0) return;
      hide();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // react-query global fetch indicator
  React.useEffect(() => {
    if (isFetching > 0) show();
    else hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetching]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <RouteChangeListener />
            <Router />
            <Loader />
          </TooltipProvider>
        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
