import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Route, Redirect } from 'wouter';
import { DashboardLayout } from './DashboardLayout';

export default function PortalAdminRoute({ path, component: Component }: { path: string; component: any }) {
    return (
        <Route path={path}>
            {(params: any) => {
                const { user } = useAuth();
                if (!user || user.role !== 'portal_admin') return <Redirect to="/login" />;
                return (
                    <DashboardLayout>
                        <Component {...params} />
                    </DashboardLayout>
                );
            }}</Route>
    );
}
