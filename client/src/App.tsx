import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminClothes from '@/pages/admin/Clothes';
import AdminRoute from '@/components/AdminRoute';
import SupplierDashboard from '@/pages/supplier/Dashboard';
import SupplierOrder from '@/pages/supplier/Order';
import SupplierRoute from '@/components/SupplierRoute';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin/login" component={Login} />
      <AdminRoute path="/admin/dashboard" component={AdminDashboard} />
      <AdminRoute path="/admin/clothes" component={AdminClothes} />
      <Route path="/supplier/login" component={Login} />
      <SupplierRoute path="/supplier/dashboard" component={SupplierDashboard} />
      <SupplierRoute path="/supplier/order" component={SupplierOrder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
