import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Route, Redirect } from 'wouter';
import { DashboardLayout } from '@/layouts/DashboardLayout';

export default function AdminRoute({ path, component: Component }) {
  return (
    <Route path={path}>
      {(params) => {
        const { user } = useAuth();
        if (!user || (user.role !== 'print_provider' && user.role !== 'portal_admin' && user.role !== 'admin')) {
          return <Redirect to="/login" />;
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
