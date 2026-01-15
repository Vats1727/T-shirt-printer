import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Route, Redirect } from 'wouter';

export default function SupplierRoute({ path, component: Component }: { path: string; component: any }) {
  return (
    <Route path={path}>
      {(params: any) => {
        const { user } = useAuth();
        if (!user || user.role !== 'supplier') return <Redirect to="/supplier/login" />;
        return <Component {...params} />;
      }}</Route>
  );
}
