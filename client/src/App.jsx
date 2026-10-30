import React from 'react';
import { queryClient } from './lib/queryClient.js';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster.jsx';
import { TooltipProvider } from '@/components/ui/tooltip.jsx';
import { AuthProvider } from '@/context/AuthContext.jsx';
import { LoadingProvider, useLoading } from '@/context/LoadingContext.jsx';
import { CartProvider } from '@/context/CartContext.jsx';
import CartDrawer from '@/components/cart/CartDrawer.jsx';
import Loader from '@/components/ui/Loader.jsx';
import { useLocation } from 'wouter';
import AppRoutes from '@/routes/AppRoutes.jsx';
import ErrorBoundary from '@/components/common/ErrorBoundary.jsx';

function RouteChangeListener() {
  const [location] = useLocation();
  const { show, hide } = useLoading();

  React.useEffect(() => {
    show();
    const t = setTimeout(() => {
      hide();
    }, 200);
    return () => clearTimeout(t);
  }, [location, show, hide]);

  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>
          <CartProvider>
            <TooltipProvider>
              <Toaster />
              <RouteChangeListener />
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
              <CartDrawer />
              <Loader />
            </TooltipProvider>
          </CartProvider>
        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
