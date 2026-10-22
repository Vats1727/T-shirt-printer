import React from 'react';
import { queryClient } from './lib/queryClient.js';
import { QueryClientProvider, useIsFetching } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster.jsx';
import { TooltipProvider } from '@/components/ui/tooltip.jsx';
import { AuthProvider } from '@/context/AuthContext.jsx';
import { LoadingProvider, useLoading } from '@/context/LoadingContext.jsx';
import Loader from '@/components/ui/Loader.jsx';
import { useLocation } from 'wouter';
import AppRoutes from '@/routes/AppRoutes.jsx';

function RouteChangeListener() {
  const [, location] = useLocation();
  const { show, hide } = useLoading();
  const isFetching = useIsFetching();

  React.useEffect(() => {
    show();
    const t = setTimeout(() => {
      if (isFetching > 0) return;
      hide();
    }, 250);
    return () => clearTimeout(t);
  }, [location, show, hide, isFetching]);

  React.useEffect(() => {
    if (isFetching > 0) show();
    else hide();
  }, [isFetching, show, hide]);

  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <RouteChangeListener />
            <AppRoutes />
            <Loader />
          </TooltipProvider>
        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
