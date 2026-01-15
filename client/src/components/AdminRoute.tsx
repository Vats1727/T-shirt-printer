import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Route, Redirect } from 'wouter';

export default function AdminRoute({ path, component: Component }: { path: string; component: any }) {
  return (
    <Route path={path}>
      {(params: any) => {
        const { user } = useAuth();
        if (!user || user.role !== 'admin') return <Redirect to="/login" />;
        return <Component {...params} />;
      }}</Route>
  );
}
