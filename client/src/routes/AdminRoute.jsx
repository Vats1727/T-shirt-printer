import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Route, Redirect } from 'wouter';
import { PrintProviderLayout } from '@/layouts/PrintProviderLayout';

export default function AdminRoute({ path, component: Component }) {
  return (
    <Route path={path}>
      {(params) => {
        const { user } = useAuth();
        if (!user) {
          return <Redirect to="/login" />;
        }
        if (user.role === 'designer' || user.role === 'supplier') {
          return <Redirect to="/supplier/orders" />;
        }
        if (user.role !== 'print_provider' && user.role !== 'portal_admin' && user.role !== 'admin') {
          return <Redirect to="/login" />;
        }
        return (
          <PrintProviderLayout>
            <Component {...params} />
          </PrintProviderLayout>
        );
      }}
    </Route>
  );
}
