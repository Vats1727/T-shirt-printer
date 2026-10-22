import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Route, Redirect } from 'wouter';
import { DashboardLayout } from '@/layouts/DashboardLayout';

export default function SupplierRoute({ path, component: Component }) {
  return (
    <Route path={path}>
      {(params) => {
        const { user } = useAuth();
        if (!user || (user.role !== 'designer' && user.role !== 'supplier')) {
          return <Redirect to="/supplier/login" />;
        }
        return (
          <DashboardLayout>
            <Component {...params} />
          </DashboardLayout>
        );
      }}
    </Route>
  );
}
