import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, CheckCircle, XCircle, UserPlus, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export default function PortalAdminDashboard() {
    const { token } = useAuth();

    const queryClient = useQueryClient();

    const { data: providersRaw, isLoading } = useQuery({
        queryKey: ['/api/portal/providers'],
        queryFn: async () => {
            const res = await fetch('/api/portal/providers', {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            if (!res.ok) throw new Error('Failed to fetch providers');
            return res.json();
        },
        enabled: !!token
    });

    const providers = Array.isArray(providersRaw) ? providersRaw : (providersRaw as any)?.providers || [];

    async function updateStatus(id: number, status: string) {
        try {
            const res = await fetch(`/api/portal/providers/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error('Update failed');
            // refresh providers
            queryClient.invalidateQueries({ queryKey: ['/api/portal/providers'] });
        } catch (e) {
            // swallow; could show toast
            console.error('Failed to update provider status', e);
        }
    }

    if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Portal Console</h1>
                    <p className="text-muted-foreground mt-1">Manage print providers and platform global settings.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 border-2 border-blue-100 dark:border-blue-900 shadow-lg">
                    <CardHeader className="pb-2">
                        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Active Providers</p>
                        <h3 className="text-4xl font-black">{providers?.filter((p: any) => p.status === 'active').length || 0}</h3>
                    </CardHeader>
                </Card>
                <Card className="bg-gray-50 dark:bg-slate-900 border shadow-md">
                    <CardHeader className="pb-2">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Users</p>
                        <h3 className="text-4xl font-bold">{providers?.length || 0}</h3>
                    </CardHeader>
                </Card>
            </div>

            <Card className="shadow-xl border-0 overflow-hidden ring-1 ring-black/5">
                <CardHeader className="bg-white dark:bg-slate-950 border-b p-6">
                    <h2 className="text-2xl font-bold">Print Providers</h2>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900">
                            <TableRow>
                                <TableHead className="font-bold">Provider Info</TableHead>
                                <TableHead className="font-bold">Status</TableHead>
                                <TableHead className="font-bold">Subscription Plan</TableHead>
                                <TableHead className="text-right font-bold pr-6">Management</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {providers?.map((p: any) => (
                                <TableRow key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg">{p.name || p.username}</span>
                                            <span className="text-sm text-muted-foreground">{p.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={p.status === 'active' ? 'default' : 'outline'}
                                            className={
                                                p.status === 'active' ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200' :
                                                    p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-200' :
                                                        p.status === 'suspended' ? 'bg-orange-500/10 text-orange-600 border-orange-200' :
                                                            'bg-red-500/10 text-red-600 border-red-200'
                                            }
                                        >
                                            {p.status || 'active'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <Badge variant="secondary" className="w-fit capitalize font-semibold mb-1">
                                                {p.subscription_tier || 'Free Tier'}
                                            </Badge>
                                            {p.subscription_expiry && (
                                                <span className="text-xs text-muted-foreground flex items-center">
                                                    <Loader2 className="w-3 h-3 mr-1" />
                                                    Renewal: {format(new Date(p.subscription_expiry), 'MMM dd, yyyy')}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end items-center gap-3">
                                            <select
                                                className="h-9 w-[140px] rounded border px-2"
                                                value={p.status || 'pending'}
                                                onChange={(e) => updateStatus(p.id, e.target.value)}
                                            >
                                                <option value="active">Active</option>
                                                <option value="suspended">Suspended</option>
                                                <option value="deactivated">Deactivated</option>
                                                <option value="pending">Pending</option>
                                            </select>

                                            {/* Billing action removed */}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Subscription dialog removed */}
        </div>
    );
}
