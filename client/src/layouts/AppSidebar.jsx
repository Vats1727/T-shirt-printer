import React from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { encodeId } from '@/utils/idEncoder';
import {
  Home,
  ShoppingBag,
  Store,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  Package,
  Paintbrush,
  LayoutTemplate,
  UserCheck,
  Users,
  DollarSign,
  FileText
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, token, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'print_provider';
  const isPortalAdmin = user?.role === 'portal_admin';
  const isDesigner = user?.role === 'designer' || user?.role === 'supplier';

  // Real-time query for Portal Admin to track pending provider registration requests
  const { data: providersRaw } = useQuery({
    queryKey: ['/api/portal/providers'],
    queryFn: async () => {
      const res = await fetch('/api/portal/providers', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isPortalAdmin && !!token,
    refetchInterval: 10000 // Automatically poll every 10s for incoming registration requests
  });

  const providers = Array.isArray(providersRaw) ? providersRaw : providersRaw?.providers || [];
  const pendingRequestsCount = providers.filter(
    (p) => (p.role === 'print_provider' || p.role === 'admin' || p.role === 'designer') && (p.status || 'pending').toLowerCase() === 'pending'
  ).length;

  // Real-time query for Print Provider to track pending orders requiring fulfillment
  const { data: adminOrdersRaw } = useQuery({
    queryKey: ['/api/admin/orders'],
    queryFn: async () => {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin && !!token,
    refetchInterval: 10000 // Automatically poll every 10s for incoming orders
  });

  const adminOrders = Array.isArray(adminOrdersRaw)
    ? adminOrdersRaw
    : (Array.isArray(adminOrdersRaw?.orders) ? adminOrdersRaw.orders : []);

  const pendingOrdersCount = adminOrders.filter((o) => {
    const s = (o.status || '').toLowerCase();
    return !s || ['pending', 'placed', 'processing', 'in_production'].includes(s);
  }).length;

  const menuItems = [
    {
      title: 'Dashboard',
      icon: Home,
      url: isPortalAdmin ? '/portal/dashboard' : (isAdmin ? '/admin/dashboard' : '/supplier/dashboard'),
      active: isPortalAdmin ? location === '/portal/dashboard' : (isAdmin ? location === '/admin/dashboard' : location === '/supplier/dashboard')
    },
    {
      title: 'Requests',
      icon: UserCheck,
      url: '/portal/requests',
      active: location.startsWith('/portal/requests'),
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
      hidden: !isPortalAdmin
    },
    {
      title: 'Financial Governance',
      icon: DollarSign,
      url: '/portal/financials',
      active: location.startsWith('/portal/financials'),
      hidden: !isPortalAdmin
    },
    {
      title: 'Partner Ledger',
      icon: FileText,
      url: '/portal/ledger',
      active: location.startsWith('/portal/ledger'),
      hidden: !isPortalAdmin
    },
    {
      title: 'Blank Garments',
      icon: Package,
      url: '/admin/clothes',
      active: location.includes('clothes'),
      hidden: !isAdmin
    },
{
      title: 'Designer Designs',
      icon: LayoutTemplate,
      url: '/admin/designer-designs',
      active: location.includes('designer-designs'),
      hidden: !isAdmin
    },
    {
      title: 'Store Listings',
      icon: Store,
      url: '/admin/listings',
      active: location.includes('/admin/listings'),
      hidden: !isAdmin
    },
    {
      title: 'Customize Store',
      icon: Paintbrush,
      url: '/admin/customize-store',
      active: location.includes('/admin/customize-store') || location.includes('/admin/store-settings'),
      hidden: !isAdmin
    },
    {
      title: 'Saved Designs',
      icon: LayoutTemplate,
      url: `/supplier/saved-designs/${encodeId(user?.id || user?.sub)}`,
      active: location.includes('saved-designs'),
      hidden: !isDesigner
    },
    {
      title: 'Store Listings',
      icon: Store,
      url: '/supplier/listings',
      active: location.includes('/supplier/listings'),
      hidden: !isDesigner
    },
    {
      title: 'Customize Store',
      icon: Paintbrush,
      url: '/supplier/customize-store',
      active: location.includes('customize-store') || location.includes('store-settings'),
      hidden: !isDesigner
    },
    {
      title: isAdmin ? 'Orders' : 'My Orders',
      icon: ShoppingBag,
      url: isAdmin ? '/admin/orders' : '/supplier/orders',
      active: location.startsWith('/admin/orders') || location.startsWith('/supplier/order') || location.startsWith('/orders') || location === '/order',
      badge: isAdmin && pendingOrdersCount > 0 ? pendingOrdersCount : null,
      hidden: isPortalAdmin
    },
    {
      title: 'Profile',
      icon: User,
      url: isPortalAdmin ? '/portal/profile' : (isAdmin ? '/admin/profile' : (isDesigner ? '/supplier/profile' : '#')),
      active: location.includes('profile')
    },
    {
      title: 'Help',
      icon: HelpCircle,
      url: '#',
      active: false,
      hidden: isPortalAdmin
    }
  ].filter((item) => !item.hidden);

  return (
    <Sidebar className={cn('border-r transition-all duration-300', isCollapsed ? 'w-16' : 'w-64')} collapsible="none">
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
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm',
                  item.active
                    ? '!bg-indigo-600 !text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Link
                  href={item.url}
                  onClick={() => setLocation(item.url)}
                  className={cn(
                    'flex items-center gap-3 w-full relative',
                    item.active ? '!text-white' : ''
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <item.icon className={cn('size-5 shrink-0', item.active ? 'text-white' : 'text-slate-500')} />
                    {isCollapsed && item.badge != null && (
                      <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
                    )}
                  </div>
                  {!isCollapsed && (
                    <>
                      <span className={cn('text-sm flex-1 text-left', item.active ? 'font-bold text-white' : 'font-medium text-slate-700')}>
                        {item.title}
                      </span>
                      {item.badge != null && (
                        <span className={cn(
                          'px-2 py-0.5 text-[11px] font-bold rounded-full animate-pulse shadow-xs',
                          item.active ? 'bg-amber-400 text-amber-950 font-black' : 'bg-amber-500 text-white'
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
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
              tooltip={isCollapsed ? 'Logout' : undefined}
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

export default AppSidebar;
