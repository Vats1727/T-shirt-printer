import React from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <div className="flex h-screen w-full overflow-hidden bg-background">
                <AppSidebar />
                <SidebarInset className="flex flex-col flex-1 overflow-hidden">
                    <main className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="mx-auto max-w-7xl w-full">
                            {children}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
