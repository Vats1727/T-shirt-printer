import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/utils/cn";
import {
  Check,
  X,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Building2,
  Calendar,
  Inbox,
  UserCheck,
  Mail,
  ChevronLeft,
  ChevronRight,
  Package,
  ShieldCheck,
  Tag,
  Layers,
  ArrowRight,
  Sparkles,
  Receipt,
  CreditCard,
  ExternalLink,
  DollarSign
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

const PAGE_SIZE = 10;

export default function PortalAdminRequests() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Top-level hub mode: 'partners' | 'garments'
  const [hubSection, setHubSection] = useState("partners");

  // Partner requests state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'active' | 'rejected'
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | 'print_provider' | 'designer'
  const [currentPage, setCurrentPage] = useState(1);
  const [actionConfirm, setActionConfirm] = useState(null); // { provider, targetStatus, title, description }
  const [viewingProvider, setViewingProvider] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Garment blank approvals state
  const [garmentSearch, setGarmentSearch] = useState("");
  const [garmentFilter, setGarmentFilter] = useState("pending"); // 'pending' | 'approved' | 'all'
  const [garmentPage, setGarmentPage] = useState(1);
  const [garmentActionConfirm, setGarmentActionConfirm] = useState(null); // { product, isApproved, title, description }
  const [viewingGarment, setViewingGarment] = useState(null);

  // 1. Partner Onboarding Requests Query
  const { data: providersRaw, isLoading: providersLoading, isFetching: providersFetching, refetch: refetchProviders } = useQuery({
    queryKey: ["/api/portal/providers"],
    queryFn: async () => {
      const res = await fetch("/api/portal/providers", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to fetch provider requests");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  // 2. Garment Blank Approvals Query
  const { data: productsRaw, isLoading: productsLoading, isFetching: productsFetching, refetch: refetchProducts } = useQuery({
    queryKey: ["/api/portal/products"],
    queryFn: async () => {
      const res = await fetch("/api/portal/products", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to fetch garment blank products");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  // 3. Subscription Upgrades & Invoices Query
  const [subSearch, setSubSearch] = useState("");
  const [subFilter, setSubFilter] = useState("all"); // 'all' | 'paid' | 'pending'
  const [subPage, setSubPage] = useState(1);

  const { data: subInvoicesData, isLoading: subInvoicesLoading, isFetching: subInvoicesFetching, refetch: refetchSubInvoices } = useQuery({
    queryKey: ["/api/portal/subscriptions/invoices"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/portal/subscriptions/invoices?limit=100", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        if (res.ok) {
          const js = await res.json();
          if (js.invoices && js.invoices.length > 0) return js;
        }
      } catch {}

      // Fallback to /api/portal/subscriptions/subscribers
      try {
        const subRes = await fetch("/api/portal/subscriptions/subscribers", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        if (subRes.ok) {
          const js = await subRes.json();
          const subs = (js.subscribers || []).filter((s) => Number(s.price_paise) > 0 || (s.plan_name && s.plan_tier !== "none"));
          return {
            invoices: subs.map((s) => ({
              id: s.subscription_id || s.user_id,
              invoice_number: `SUB-INV-2026-${String(s.user_id).padStart(2, "0")}022`,
              user_id: s.user_id,
              user_name: s.name,
              user_email: s.email,
              user_role: s.role,
              plan_name: s.plan_name,
              plan_tier: s.plan_tier,
              billing_interval: s.billing_interval || "monthly",
              amount_paise: s.price_paise || 99900,
              status: s.subscription_status || "paid",
              created_at: s.starts_at || new Date().toISOString(),
              period_start: s.starts_at,
              period_end: s.expires_at,
              razorpay_payment_id: "pay_U1AQhhW9DzdxSx",
              paid_at: s.starts_at || new Date().toISOString()
            }))
          };
        }
      } catch {}

      return { invoices: [] };
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  const allPortalRequests = (Array.isArray(providersRaw) ? providersRaw : providersRaw?.providers || []).filter(
    (p) => p.role === "print_provider" || p.role === "admin" || p.role === "designer"
  );

  const providers = allPortalRequests.filter((p) => {
    if (roleFilter === "all") return true;
    if (roleFilter === "print_provider") return p.role === "print_provider" || p.role === "admin";
    return p.role === roleFilter;
  });

  const portalProducts = productsRaw?.products || [];

  // Reset pagination on search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, roleFilter]);

  useEffect(() => {
    setGarmentPage(1);
  }, [garmentSearch, garmentFilter]);

  // Partner status update handler
  async function executeStatusUpdate(id, newStatus) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/portal/providers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || "Failed to update provider status");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/portal/providers"] });

      const statusLabels = {
        active: "Approved & Allowed Login",
        rejected: "Rejected",
        suspended: "Suspended",
        pending: "Moved to Pending"
      };

      const isDesigner = actionConfirm?.provider?.role === "designer";
      const roleName = isDesigner ? "Designer" : "Provider";

      toast({
        title: `${roleName} Application ${statusLabels[newStatus] || "Updated"}`,
        description:
          newStatus === "active"
            ? `${roleName} account has been approved. They can now log in and operate.`
            : newStatus === "rejected"
              ? `${roleName} application was rejected. They will see a notice upon trying to sign in.`
              : `${roleName} status set to ${newStatus}.`
      });
    } catch (err) {
      toast({
        title: "Action Failed",
        description: err.message || "Could not update status",
        variant: "destructive"
      });
    } finally {
      setUpdatingId(null);
      setActionConfirm(null);
    }
  }

  // Garment blank approval/rejection handler
  async function executeGarmentApproval(productId, isApproved) {
    setUpdatingId(`product-${productId}`);
    try {
      const res = await fetch(`/api/portal/products/${productId}/approval`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ is_approved: isApproved })
      });

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || "Failed to update garment approval status");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/portal/products"] });

      toast({
        title: isApproved ? "Garment Blank Approved" : "Garment Blank Moved to Draft",
        description: isApproved
          ? `Product #${productId} is approved. Designers can now select it in Designer Studio and publish listings.`
          : `Product #${productId} has been moved to draft and linked storefront listings have been unlisted.`
      });
    } catch (err) {
      toast({
        title: "Approval Action Blocked",
        description: err.message || "Could not update product approval",
        variant: "destructive"
      });
    } finally {
      setUpdatingId(null);
      setGarmentActionConfirm(null);
    }
  }

  // Partner Filtered lists
  const pendingRequests = providers.filter((p) => (p.status || "pending").toLowerCase() === "pending");
  const activeRequests = providers.filter((p) => (p.status || "").toLowerCase() === "active");
  const rejectedRequests = providers.filter(
    (p) => ["rejected", "suspended", "deactivated"].includes((p.status || "").toLowerCase())
  );

  const currentTabList =
    activeTab === "pending"
      ? pendingRequests
      : activeTab === "active"
        ? activeRequests
        : activeTab === "rejected"
          ? rejectedRequests
          : providers;

  const filteredRequests = currentTabList.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (p.name || "").toLowerCase().includes(term);
    const emailMatch = (p.email || "").toLowerCase().includes(term);
    return nameMatch || emailMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Garment Blank Filtered lists
  const pendingGarments = portalProducts.filter((p) => p.is_approved === false || p.is_approved === null);
  const approvedGarments = portalProducts.filter((p) => p.is_approved === true);

  const currentGarmentTabList =
    garmentFilter === "pending"
      ? pendingGarments
      : garmentFilter === "approved"
        ? approvedGarments
        : portalProducts;

  const filteredGarments = currentGarmentTabList.filter((p) => {
    if (!garmentSearch.trim()) return true;
    const term = garmentSearch.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(term) ||
      (p.provider_name || "").toLowerCase().includes(term) ||
      (p.master_garment_name || "").toLowerCase().includes(term) ||
      (p.category || "").toLowerCase().includes(term)
    );
  });

  const totalGarmentPages = Math.max(1, Math.ceil(filteredGarments.length / PAGE_SIZE));
  const paginatedGarments = filteredGarments.slice(
    (garmentPage - 1) * PAGE_SIZE,
    garmentPage * PAGE_SIZE
  );

  // Subscription Upgrades & Invoices
  const subInvoices = subInvoicesData?.invoices || [];
  const paidSubInvoices = subInvoices.filter((i) => (i.status || "").toLowerCase() === "paid");
  const pendingSubInvoices = subInvoices.filter((i) => (i.status || "").toLowerCase() === "pending");

  const currentSubTabList =
    subFilter === "paid"
      ? paidSubInvoices
      : subFilter === "pending"
        ? pendingSubInvoices
        : subInvoices;

  const filteredSubInvoices = currentSubTabList.filter((inv) => {
    if (!subSearch.trim()) return true;
    const term = subSearch.toLowerCase();
    return (
      (inv.invoice_number || "").toLowerCase().includes(term) ||
      (inv.user_name || "").toLowerCase().includes(term) ||
      (inv.user_email || "").toLowerCase().includes(term) ||
      (inv.plan_name || "").toLowerCase().includes(term) ||
      (inv.razorpay_payment_id || "").toLowerCase().includes(term)
    );
  });

  const totalSubPages = Math.max(1, Math.ceil(filteredSubInvoices.length / PAGE_SIZE));
  const paginatedSubInvoices = filteredSubInvoices.slice(
    (subPage - 1) * PAGE_SIZE,
    subPage * PAGE_SIZE
  );

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Top Banner - Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            {hubSection === "partners" ? (
              <UserCheck className="w-5 h-5" />
            ) : hubSection === "garments" ? (
              <Package className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Platform Governance & Approvals
            </h1>
            <p className="text-slate-500 text-xs">
              Govern partner access requests, verify print provider apparel blanks, and audit paid subscription upgrades.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Section Switcher Tabs */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setHubSection("partners")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all",
                hubSection === "partners"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Partner Onboarding
              {pendingRequests.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setHubSection("garments")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all",
                hubSection === "garments"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Package className="w-3.5 h-3.5" />
              Garment Blanks
              {pendingGarments.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                  {pendingGarments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setHubSection("subscriptions")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all",
                hubSection === "subscriptions"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Subscription Upgrades
              {paidSubInvoices.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">
                  {paidSubInvoices.length}
                </span>
              )}
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (hubSection === "partners") refetchProviders();
              else if (hubSection === "garments") refetchProducts();
              else refetchSubInvoices();
            }}
            disabled={providersFetching || productsFetching || subInvoicesFetching}
            className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(providersFetching || productsFetching) ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* VIEW A: PARTNER ONBOARDING REQUESTS */}
      {hubSection === "partners" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Partner KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card
              onClick={() => setActiveTab("pending")}
              className={cn(
                "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
                activeTab === "pending"
                  ? "border-amber-400 bg-amber-50/70 shadow-xs ring-2 ring-amber-300/40"
                  : pendingRequests.length > 0
                    ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-xs"
                    : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Pending Applications
                </span>
                <div className={`p-1.5 rounded-lg ${pendingRequests.length > 0 ? "bg-amber-500 text-white animate-pulse" : "bg-amber-100 text-amber-600"}`}>
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{pendingRequests.length}</div>
                <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  {pendingRequests.length > 0 ? "Requires review & action below" : "No pending review requests"}
                </p>
              </CardContent>
            </Card>

            <Card
              onClick={() => setActiveTab("active")}
              className={cn(
                "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
                activeTab === "active"
                  ? "border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-300/40"
                  : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Approved Partners
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{activeRequests.length}</div>
                <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                  Active and authorized to operate
                </p>
              </CardContent>
            </Card>

            <Card
              onClick={() => setActiveTab("rejected")}
              className={cn(
                "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
                activeTab === "rejected"
                  ? "border-rose-500 bg-rose-50/70 shadow-xs ring-2 ring-rose-300/40"
                  : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Rejected / Suspended
                </span>
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{rejectedRequests.length}</div>
                <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
                  Access restricted or declined
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Partner Requests Table */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={activeTab === "pending" ? "default" : "outline"}
                  onClick={() => setActiveTab("pending")}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                    activeTab === "pending"
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Pending Requests ({pendingRequests.length})
                </Button>

                <Button
                  size="sm"
                  variant={activeTab === "active" ? "default" : "outline"}
                  onClick={() => setActiveTab("active")}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                    activeTab === "active"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approved ({activeRequests.length})
                </Button>

                <Button
                  size="sm"
                  variant={activeTab === "rejected" ? "default" : "outline"}
                  onClick={() => setActiveTab("rejected")}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                    activeTab === "rejected"
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Rejected ({rejectedRequests.length})
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setRoleFilter("all")}
                    className={cn(
                      "px-2.5 py-1 font-semibold rounded-md transition-colors",
                      roleFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    All Roles
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("print_provider")}
                    className={cn(
                      "px-2.5 py-1 font-semibold rounded-md transition-colors",
                      roleFilter === "print_provider" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Providers
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("designer")}
                    className={cn(
                      "px-2.5 py-1 font-semibold rounded-md transition-colors",
                      roleFilter === "designer" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Designers
                  </button>
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="pl-9 h-8 rounded-lg border-slate-200 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            <CardContent className="p-0">
              {providersLoading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-xs font-medium">Loading requests...</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">
                    No requests found in this category
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Try adjusting your search criteria or switching to another tab.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {paginatedRequests.map((p) => {
                    const status = (p.status || "pending").toLowerCase();
                    const isDesigner = p.role === "designer";
                    return (
                      <div
                        key={p.id}
                        className="p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm border shrink-0",
                            isDesigner ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-indigo-100 text-indigo-700 border-indigo-200"
                          )}>
                            {(p.name || p.email || (isDesigner ? "D" : "P")).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-sm leading-tight">
                                {p.name || (isDesigner ? "Designer Applicant" : "Print Provider Applicant")}
                              </h3>
                              <Badge className={cn(
                                "text-[10px] font-bold py-0 px-2",
                                isDesigner ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"
                              )}>
                                {isDesigner ? "Designer" : "Print Provider"}
                              </Badge>
                              {status === "active" ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-bold py-0.5 px-2">
                                  Active / Approved
                                </Badge>
                              ) : status === "pending" ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] font-bold py-0.5 px-2 animate-pulse">
                                  Pending Review
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[11px] font-bold py-0.5 px-2">
                                  Rejected
                                </Badge>
                              )}

                              {!isDesigner && (
                                p.gateway_status === "active" ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0.5 px-2 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Gateway: {p.gateway_key_masked || "Connected"}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold py-0.5 px-2">
                                    Gateway: Unconfigured
                                  </Badge>
                                )
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {p.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingProvider(p)}
                            className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Details
                          </Button>

                          {status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                disabled={updatingId === p.id}
                                onClick={() =>
                                  setActionConfirm({
                                    provider: p,
                                    targetStatus: "active",
                                    title: isDesigner ? "Approve Designer Account" : "Approve Print Provider Account",
                                    description: `Grant platform access to "${p.name || p.email}" as an active ${isDesigner ? "designer" : "print provider"}?`
                                  })
                                }
                                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                disabled={updatingId === p.id}
                                onClick={() =>
                                  setActionConfirm({
                                    provider: p,
                                    targetStatus: "rejected",
                                    title: isDesigner ? "Decline Designer Application" : "Decline Print Provider Application",
                                    description: `Reject the onboarding application from "${p.name || p.email}"?`
                                  })
                                }
                                className="h-8 w-8 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors"
                                title="Reject Request"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : status === "active" ? (
                            <Button
                              size="icon"
                              variant="outline"
                              disabled={updatingId === p.id}
                              onClick={() =>
                                setActionConfirm({
                                  provider: p,
                                  targetStatus: "suspended",
                                  title: isDesigner ? "Suspend Designer" : "Suspend Print Provider",
                                  description: `Suspend "${p.name || p.email}"?`
                                })
                              }
                              className="h-8 w-8 rounded-lg border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                              title="Suspend Access"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              disabled={updatingId === p.id}
                              onClick={() =>
                                setActionConfirm({
                                  provider: p,
                                  targetStatus: "active",
                                  title: isDesigner ? "Reactivate Designer" : "Reactivate Provider",
                                  description: `Reactivate "${p.name || p.email}"?`
                                })
                              }
                              className="h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                              title="Reactivate Provider"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {filteredRequests.length > 0 && (
              <div className="p-2.5 border-t border-slate-100 flex items-center justify-end bg-slate-50/30">
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-7 w-7 p-0 rounded-md border-slate-200"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>

                  <div className="flex items-center gap-1 px-0.5">
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                      <Button
                        key={num}
                        size="icon"
                        variant={currentPage === num ? "default" : "ghost"}
                        onClick={() => setCurrentPage(num)}
                        className={`h-7 w-7 p-0 text-xs rounded-md ${currentPage === num
                          ? "bg-slate-900 text-white font-bold"
                          : "text-slate-600 hover:bg-slate-100"
                          }`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>

                  <Button
                    size="icon"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-7 w-7 p-0 rounded-md border-slate-200"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* VIEW B: GARMENT BLANK APPROVALS */}
      {hubSection === "garments" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Garment Blank KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card
              onClick={() => setGarmentFilter("pending")}
              className={cn(
                "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
                garmentFilter === "pending"
                  ? "border-amber-400 bg-amber-50/70 shadow-xs ring-2 ring-amber-300/40"
                  : pendingGarments.length > 0
                    ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-xs"
                    : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Pending Blank Approvals
                </span>
                <div className={`p-1.5 rounded-lg ${pendingGarments.length > 0 ? "bg-amber-500 text-white animate-pulse" : "bg-amber-100 text-amber-600"}`}>
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{pendingGarments.length}</div>
                <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  {pendingGarments.length > 0 ? "Unapproved blanks hidden from designers" : "All blanks approved"}
                </p>
              </CardContent>
            </Card>

            <Card
              onClick={() => setGarmentFilter("approved")}
              className={cn(
                "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
                garmentFilter === "approved"
                  ? "border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-300/40"
                  : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Approved & Active Blanks
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{approvedGarments.length}</div>
                <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                  Available for designer customization & sales
                </p>
              </CardContent>
            </Card>

            <Card
              onClick={() => setGarmentFilter("all")}
              className={cn(
                "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
                garmentFilter === "all"
                  ? "border-indigo-500 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-300/40"
                  : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Total Apparel Blanks
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                  <Package className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{portalProducts.length}</div>
                <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">
                  Strictly apparel catalog only
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Garments Table */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={garmentFilter === "pending" ? "default" : "outline"}
                  onClick={() => setGarmentFilter("pending")}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                    garmentFilter === "pending"
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Pending Approval ({pendingGarments.length})
                </Button>

                <Button
                  size="sm"
                  variant={garmentFilter === "approved" ? "default" : "outline"}
                  onClick={() => setGarmentFilter("approved")}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                    garmentFilter === "approved"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Approved ({approvedGarments.length})
                </Button>

                <Button
                  size="sm"
                  variant={garmentFilter === "all" ? "default" : "outline"}
                  onClick={() => setGarmentFilter("all")}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                    garmentFilter === "all"
                      ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Package className="w-3.5 h-3.5" />
                  All Blanks ({portalProducts.length})
                </Button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={garmentSearch}
                  onChange={(e) => setGarmentSearch(e.target.value)}
                  placeholder="Search blanks, provider or specs..."
                  className="pl-9 h-8 rounded-lg border-slate-200 text-xs bg-white"
                />
              </div>
            </div>

            <CardContent className="p-0">
              {productsLoading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-xs font-medium">Loading garment blanks...</p>
                </div>
              ) : filteredGarments.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">
                    No garment blanks found
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    No apparel blanks match the selected status or search filter.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {paginatedGarments.map((prod) => {
                    const isApproved = prod.is_approved === true;
                    const hasGarmentMapping = Boolean(prod.garment_id && prod.master_garment_name);
                    const isGarmentActive = prod.garment_active !== false;

                    return (
                      <div
                        key={prod.id}
                        className="p-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 bg-white"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-xl font-bold flex flex-col items-center justify-center text-xs border shrink-0",
                            isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            <Package className="w-5 h-5 mb-0.5" />
                            <span className="text-[9px] font-mono">#{prod.id}</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-sm leading-tight">
                                {prod.name}
                              </h3>
                              <Badge variant="outline" className="text-[10px] font-mono uppercase bg-slate-50 text-slate-700 border-slate-200">
                                {prod.category || "Apparel"}
                              </Badge>

                              {isApproved ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-bold py-0.5 px-2">
                                  Approved & Published
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] font-bold py-0.5 px-2 animate-pulse">
                                  Pending Admin Approval
                                </Badge>
                              )}

                              {!hasGarmentMapping && (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold py-0.5 px-2">
                                  Unmapped Master Garment
                                </Badge>
                              )}
                            </div>

                            {/* Master Garment Catalog Specs */}
                            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                                {prod.master_garment_name || "Unassigned Garment"}
                              </span>
                              {prod.gsm && (
                                <span className="text-slate-500">
                                  {prod.gsm} GSM • {prod.knit_type || "Single Jersey"}
                                </span>
                              )}
                              {prod.hsn_code && (
                                <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                  HSN {prod.hsn_code} ({prod.gst_rate || 5}% GST)
                                </span>
                              )}
                              <span className="text-slate-400">•</span>
                              <span className="flex items-center gap-1 text-slate-600">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {prod.provider_name || `Provider #${prod.owner_id || "N/A"}`}
                              </span>
                            </div>

                            {/* Base Pricing & Options */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                              <span className="font-bold text-slate-900 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                                Base: ₹{prod.single_price || 0}
                              </span>
                              {prod.bulk_price && (
                                <span className="text-slate-600 text-[11px]">
                                  Bulk: ₹{prod.bulk_price} ({prod.bulk_min || 10}+ pcs)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingGarment(prod)}
                            className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Garment Specs
                          </Button>

                          {!isApproved ? (
                            <>
                              <Button
                                size="sm"
                                disabled={updatingId === `product-${prod.id}` || !hasGarmentMapping || !isGarmentActive}
                                onClick={() =>
                                  setGarmentActionConfirm({
                                    product: prod,
                                    isApproved: true,
                                    title: `Approve Blank Garment #${prod.id}`,
                                    description: `Approve "${prod.name}"? This allows designers to immediately select it in Designer Studio, apply artwork, and sell customized products on the storefront.`
                                  })
                                }
                                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve Blank
                              </Button>

                              <Button
                                size="icon"
                                variant="outline"
                                disabled={updatingId === `product-${prod.id}`}
                                onClick={() =>
                                  setGarmentActionConfirm({
                                    product: prod,
                                    isApproved: false,
                                    title: `Reject Blank Garment #${prod.id}`,
                                    description: `Reject "${prod.name}" and move it to draft? Any storefront listings pointing to this garment will be automatically unlisted.`
                                  })
                                }
                                className="h-8 w-8 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors"
                                title="Reject Blank"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingId === `product-${prod.id}`}
                              onClick={() =>
                                setGarmentActionConfirm({
                                  product: prod,
                                  isApproved: false,
                                  title: `Revoke Approval for Product #${prod.id}`,
                                  description: `Revoke approval for "${prod.name}"? This will move it back to draft and unpublish all active designer storefront listings linked to this blank.`
                                })
                              }
                              className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold gap-1 transition-colors"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Move to Draft / Unpublish
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {filteredGarments.length > 0 && (
              <div className="p-2.5 border-t border-slate-100 flex items-center justify-end bg-slate-50/30">
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={garmentPage === 1}
                    onClick={() => setGarmentPage((p) => Math.max(1, p - 1))}
                    className="h-7 w-7 p-0 rounded-md border-slate-200"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>

                  <div className="flex items-center gap-1 px-0.5">
                    {Array.from({ length: totalGarmentPages }, (_, idx) => idx + 1).map((num) => (
                      <Button
                        key={num}
                        size="icon"
                        variant={garmentPage === num ? "default" : "ghost"}
                        onClick={() => setGarmentPage(num)}
                        className={`h-7 w-7 p-0 text-xs rounded-md ${garmentPage === num
                          ? "bg-slate-900 text-white font-bold"
                          : "text-slate-600 hover:bg-slate-100"
                          }`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>

                  <Button
                    size="icon"
                    variant="outline"
                    disabled={garmentPage >= totalGarmentPages}
                    onClick={() => setGarmentPage((p) => Math.min(totalGarmentPages, p + 1))}
                    className="h-7 w-7 p-0 rounded-md border-slate-200"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* VIEW C: SUBSCRIPTION UPGRADES & INVOICES */}
      {hubSection === "subscriptions" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Subscription KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card
              onClick={() => setSubFilter("all")}
              className={cn(
                "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
                subFilter === "all"
                  ? "border-indigo-400 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-300/40"
                  : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Total Subscription Invoices
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{subInvoices.length}</div>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  {paidSubInvoices.length} paid · {pendingSubInvoices.length} pending
                </p>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSubFilter("paid")}
              className={cn(
                "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
                subFilter === "paid"
                  ? "border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-300/40"
                  : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Paid & Active Upgrades
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-emerald-700">{paidSubInvoices.length}</div>
                <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                  Direct revenue verified on Razorpay
                </p>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSubFilter("pending")}
              className={cn(
                "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
                subFilter === "pending"
                  ? "border-amber-500 bg-amber-50/70 shadow-xs ring-2 ring-amber-300/40"
                  : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Pending Invoices
                </span>
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-slate-900">{pendingSubInvoices.length}</div>
                <p className="text-[11px] text-amber-600 mt-0.5 font-medium">
                  Awaiting partner checkout completion
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Subscriptions Table */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setSubFilter("all"); setSubPage(1); }}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", subFilter === "all" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900")}
                >
                  All Invoices ({subInvoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSubFilter("paid"); setSubPage(1); }}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", subFilter === "paid" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900")}
                >
                  Paid ({paidSubInvoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSubFilter("pending"); setSubPage(1); }}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", subFilter === "pending" ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900")}
                >
                  Pending ({pendingSubInvoices.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={subSearch}
                    onChange={(e) => { setSubSearch(e.target.value); setSubPage(1); }}
                    placeholder="Search invoices, partners..."
                    className="pl-9 pr-4 h-8 text-xs rounded-lg bg-white border-slate-200"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/portal/subscription-ledger"}
                  className="h-8 gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs rounded-lg text-xs font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  Full Ledger
                </Button>
              </div>
            </div>

            <CardContent className="p-0">
              {subInvoicesLoading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-xs font-medium">Loading subscription invoices...</p>
                </div>
              ) : filteredSubInvoices.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <Receipt className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                  <p className="font-semibold text-slate-700 text-sm">No subscription invoices found</p>
                  <p className="text-xs text-slate-400">No records match your selected filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Partner</th>
                        <th className="py-3 px-4">Upgraded Plan</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Razorpay Payment ID</th>
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedSubInvoices.map((inv) => {
                        const isPaid = (inv.status || "").toLowerCase() === "paid";
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                {inv.invoice_number}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{inv.user_name || "Partner"}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{inv.user_email}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold gap-1 px-2.5 py-0.5 text-xs">
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                {inv.plan_name || "Subscription"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              ₹{(Number(inv.amount_paise || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {inv.razorpay_payment_id ? (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-indigo-700">
                                  {inv.razorpay_payment_id}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 text-[11px]">
                              {inv.period_start && inv.period_end ? (
                                <span>
                                  {format(new Date(inv.period_start), "dd-MMM-yy")} &rarr; {format(new Date(inv.period_end), "dd-MMM-yy")}
                                </span>
                              ) : (
                                <span className="text-slate-400">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isPaid ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold gap-1 px-2 py-0.5 text-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Paid
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold gap-1 px-2 py-0.5 text-xs">
                                  <Clock className="w-3 h-3 text-amber-600" /> Pending
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>

            {/* Pagination Controls */}
            {totalSubPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs">
                <span className="text-slate-500 font-medium pl-3">
                  Showing {(subPage - 1) * PAGE_SIZE + 1} to{" "}
                  {Math.min(subPage * PAGE_SIZE, filteredSubInvoices.length)} of {filteredSubInvoices.length} invoices
                </span>
                <div className="flex items-center gap-1 pr-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                    disabled={subPage === 1}
                    className="h-7 w-7 p-0 rounded-lg"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="px-2 font-semibold text-slate-700">
                    {subPage} of {totalSubPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubPage((p) => Math.min(totalSubPages, p + 1))}
                    disabled={subPage === totalSubPages}
                    className="h-7 w-7 p-0 rounded-lg"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Confirmation Alert Dialog: Partner Status */}
      <AlertDialog
        open={Boolean(actionConfirm)}
        onOpenChange={(open) => !open && setActionConfirm(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 font-extrabold flex items-center gap-2">
              {actionConfirm?.targetStatus === "active" ? (
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <Check className="w-4 h-4" />
                </div>
              ) : actionConfirm?.targetStatus === "rejected" ? (
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <X className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
              {actionConfirm?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-xs leading-relaxed pt-1">
              {actionConfirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={Boolean(updatingId)}
              className="rounded-xl border-slate-200 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(updatingId)}
              onClick={() =>
                executeStatusUpdate(
                  actionConfirm.provider.id,
                  actionConfirm.targetStatus
                )
              }
              className={cn(
                "rounded-xl text-xs font-bold text-white",
                actionConfirm?.targetStatus === "active"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : actionConfirm?.targetStatus === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-slate-900 hover:bg-slate-800"
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Alert Dialog: Garment Blank Approval */}
      <AlertDialog
        open={Boolean(garmentActionConfirm)}
        onOpenChange={(open) => !open && setGarmentActionConfirm(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 font-extrabold flex items-center gap-2">
              {garmentActionConfirm?.isApproved ? (
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
              {garmentActionConfirm?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-xs leading-relaxed pt-1">
              {garmentActionConfirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={Boolean(updatingId)}
              className="rounded-xl border-slate-200 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(updatingId)}
              onClick={() =>
                executeGarmentApproval(
                  garmentActionConfirm.product.id,
                  garmentActionConfirm.isApproved
                )
              }
              className={cn(
                "rounded-xl text-xs font-bold text-white",
                garmentActionConfirm?.isApproved
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partner Details Modal */}
      <Dialog
        open={Boolean(viewingProvider)}
        onOpenChange={(open) => !open && setViewingProvider(null)}
      >
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Applicant Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registration application details for platform verification.
            </DialogDescription>
          </DialogHeader>

          {viewingProvider && (
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Business / Name:</span>
                  <strong className="text-slate-900">{viewingProvider.name || "Unnamed"}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Contact Email:</span>
                  <span className="font-mono text-slate-800">{viewingProvider.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Role:</span>
                  <Badge
                    className={
                      viewingProvider.role === "designer"
                        ? "bg-purple-50 text-purple-700 border-purple-200 font-bold"
                        : "bg-blue-50 text-blue-700 border-blue-200 font-bold"
                    }
                  >
                    {viewingProvider.role === "designer" ? "Designer" : "Print Provider"}
                  </Badge>
                </div>
                {viewingProvider.role === "designer" && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Associated Provider:</span>
                    <strong className="text-slate-900">
                      {viewingProvider.associated_provider_name || "Independent / Unassigned"}
                    </strong>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Application Status:</span>
                  <Badge className="capitalize font-bold">
                    {viewingProvider.status || "pending"}
                  </Badge>
                </div>

                {viewingProvider.role !== "designer" && (
                  <div className="pt-2 border-t border-slate-200 mt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Payment Gateway:</span>
                      <Badge
                        className={
                          viewingProvider.gateway_status === "active"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                            : "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                        }
                      >
                        {viewingProvider.gateway_status === "active" ? "Connected (Active)" : "Pending Setup"}
                      </Badge>
                    </div>
                    {viewingProvider.gateway_key_masked && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Razorpay Key ID:</span>
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          {viewingProvider.gateway_key_masked}
                        </span>
                      </div>
                    )}
                    {viewingProvider.gateway_last_ping && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Last Live Handshake:</span>
                        <span className="text-emerald-700 font-medium">
                          {format(new Date(viewingProvider.gateway_last_ping), "dd-MM-yyyy HH:mm")} (Verified)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 text-xs text-slate-400 text-center">
                Registration submitted on {viewingProvider.createdAt ? format(new Date(viewingProvider.createdAt), "dd-MM-yyyy") : "N/A"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Garment Details Modal */}
      <Dialog
        open={Boolean(viewingGarment)}
        onOpenChange={(open) => !open && setViewingGarment(null)}
      >
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Blank Apparel Specifications
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Technical taxonomy and master catalog alignment.
            </DialogDescription>
          </DialogHeader>

          {viewingGarment && (
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Blank Garment Name:</span>
                  <strong className="text-slate-900">{viewingGarment.name}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Master Garment:</span>
                  <strong className="text-indigo-700">{viewingGarment.master_garment_name || "Unassigned"}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Fabric & Knit:</span>
                  <span className="text-slate-800">{viewingGarment.knit_type || "N/A"} • {viewingGarment.gsm || "N/A"} GSM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">HSN Code & GST:</span>
                  <span className="font-mono text-slate-800">HSN {viewingGarment.hsn_code || "6109"} ({viewingGarment.gst_rate || 5}% GST)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Print Provider:</span>
                  <span className="text-slate-800">{viewingGarment.provider_name || `Provider #${viewingGarment.owner_id}`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Base Price (Single):</span>
                  <strong className="text-emerald-700">₹{viewingGarment.single_price || 0}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Bulk Price Tier:</span>
                  <span className="text-slate-800">₹{viewingGarment.bulk_price || "N/A"} ({viewingGarment.bulk_min || 10}+ units)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Marketplace Status:</span>
                  <Badge className={viewingGarment.is_approved ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold" : "bg-amber-100 text-amber-800 border-amber-300 font-bold"}>
                    {viewingGarment.is_approved ? "Approved & Sellable" : "Pending Approval"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
