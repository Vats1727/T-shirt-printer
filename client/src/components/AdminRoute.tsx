import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Route, Redirect } from 'wouter';
import { DashboardLayout } from './DashboardLayout';

export default function AdminRoute({ path, component: Component }: { path: string; component: any }) {
  return (
    <Route path={path}>
      {(params: any) => {
        const { user } = useAuth();
        if (!user || (user.role !== 'print_provider' && user.role !== 'portal_admin' && user.role !== 'admin')) return <Redirect to="/login" />;
        return (
          <DashboardLayout>
            <Component {...params} />
          </DashboardLayout>
        );
      }}</Route>
  );
}
