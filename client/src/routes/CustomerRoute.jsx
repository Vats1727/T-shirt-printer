import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Route, Redirect } from 'wouter';
import { CustomerLayout } from '@/layouts/CustomerLayout.jsx';

export default function CustomerRoute({ path, component: Component }) {
  return (
    <Route path={path}>
      {(params) => {
        const { user } = useAuth();
        if (!user) {
          return <Redirect to="/login" />;
        }
        if (user.role === 'portal_admin') {
          return <Redirect to="/portal/dashboard" />;
        }
        if (user.role === 'print_provider' || user.role === 'admin') {
          return <Redirect to="/admin/dashboard" />;
        }
        if (user.role === 'designer' || user.role === 'supplier') {
          return <Redirect to="/supplier/dashboard" />;
        }
        if (user.role !== 'customer') {
          return <Redirect to="/login" />;
        }

        return (
          <CustomerLayout>
            <Component {...params} />
          </CustomerLayout>
        );
      }}
    </Route>
  );
}

