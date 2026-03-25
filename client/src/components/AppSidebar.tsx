import React from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import {
    Home,
    ShoppingBag,
    User,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    HelpCircle,
    Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';

export function AppSidebar() {
    const [location] = useLocation();
    const { user, logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const isAdmin = user?.role === 'admin' || user?.role === 'print_provider';
    const isPortalAdmin = user?.role === 'portal_admin';
    const isDesigner = user?.role === 'designer' || user?.role === 'supplier';

    const menuItems = [
        {
            title: 'Dashboard',
            icon: Home,
            url: isPortalAdmin ? '/portal/dashboard' : (isAdmin ? '/admin/dashboard' : '/supplier/dashboard'),
            active: location.includes('dashboard')
        },
        {
            title: isAdmin ? 'Orders' : 'My Orders',
            icon: ShoppingBag,
            url: isAdmin ? '/admin/orders' : '/supplier/orders',
            active: location.includes('orders'),
            hidden: isPortalAdmin
        },
        {
            title: 'Products',
            icon: Package,
            url: isAdmin ? '/admin/dashboard' : '/supplier/dashboard', // Adjust as needed
            active: location.includes('products') || (isAdmin && location === '/admin/dashboard'),
            hidden: isPortalAdmin
        },
        {
            title: 'Profile',
            icon: User,
            url: isAdmin ? '/admin/profile' : (isDesigner ? '/supplier/profile' : '#'), 
            active: location.includes('profile')
        },
        {
            title: 'Help',
            icon: HelpCircle,
            url: '#',
            active: false
        }
    ].filter(item => !item.hidden);

    return (
        <Sidebar className={cn("border-r transition-all duration-300", isCollapsed ? "w-16" : "w-64")} collapsible="none">
            <SidebarHeader className="p-4 border-b">
                <div className="flex items-center gap-3 px-2">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <ShieldCheck className="size-5" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col gap-0.5 leading-none">
                            <span className="font-semibold text-sm">Print Portal</span>
                            <span className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</span>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent className="py-4">
                <SidebarMenu className="px-2">
                    {menuItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={item.active}
                                tooltip={isCollapsed ? item.title : undefined}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                                    item.active
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                <Link href={item.url} className="flex items-center gap-3 w-full">
                                    <item.icon className="size-5" />
                                    {!isCollapsed && <span className="text-sm font-medium">{item.title}</span>}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className="p-4 border-t">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => {
                                logout();
                                window.location.href = '/login';
                            }}
                            tooltip={isCollapsed ? "Logout" : undefined}
                            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground w-full transition-colors"
                        >
                            <LogOut className="size-5" />
                            {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>

                <div className="mt-4 flex justify-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="h-8 w-8 rounded-full border shadow-sm"
                    >
                        {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                    </Button>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
