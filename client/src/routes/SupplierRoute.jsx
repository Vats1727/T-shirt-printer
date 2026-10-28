import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Route, Redirect } from 'wouter';
import { DesignerLayout } from '@/layouts/DesignerLayout';

export default function SupplierRoute({ path, component: Component }) {
  return (
    <Route path={path}>
      {(params) => {
        const { user } = useAuth();
        if (!user) {
          return <Redirect to="/supplier/login" />;
        }
        if (user.role === 'print_provider' || user.role === 'admin') {
          return <Redirect to="/admin/orders" />;
        }
        if (user.role !== 'designer' && user.role !== 'supplier') {
          return <Redirect to="/supplier/login" />;
        }

        return (
          <DesignerLayout>
            <Component {...params} />
          </DesignerLayout>
        );
      }}
    </Route>
  );
}
