import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Route, Redirect } from 'wouter';
import { DashboardLayout } from '@/layouts/DashboardLayout';

export default function PortalAdminRoute({ path, component: Component }) {
  return (
    <Route path={path}>
      {(params) => {
        const { user } = useAuth();
        if (!user || user.role !== 'portal_admin') {
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
