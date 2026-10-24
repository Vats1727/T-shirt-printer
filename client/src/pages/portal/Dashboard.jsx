import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Check,
  X,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Users,
  Package,
  Search,
  RefreshCw,
  Eye,
  Store,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  ArrowRight,
  ChevronLeft,
  ChevronRight
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

export default function PortalAdminDashboard() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'active' | 'restricted'
  const [currentPage, setCurrentPage] = useState(1);
  const [actionConfirm, setActionConfirm] = useState(null); // { provider, targetStatus, title, description }
  const [viewingProvider, setViewingProvider] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const { data: providersRaw, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["/api/portal/providers"],
    queryFn: async () => {
      const res = await fetch("/api/portal/providers", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to fetch print providers");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  const providers = (Array.isArray(providersRaw) ? providersRaw : providersRaw?.providers || []).filter(
    (p) => p.role === "print_provider" || p.role === "admin"
  );

  // Reset to first page when search or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

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
        active: "Approved & Activated",
        rejected: "Rejected",
        suspended: "Suspended",
        pending: "Moved to Pending"
      };

      toast({
        title: `Provider ${statusLabels[newStatus] || "Updated"}`,
        description:
          newStatus === "active"
            ? "Provider account has been approved and activated."
            : newStatus === "rejected"
            ? "Provider account has been rejected."
            : `Provider status set to ${newStatus}.`
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

  // Filtered counts
  const pendingProviders = providers.filter((p) => (p.status || "pending").toLowerCase() === "pending");
  const activeProviders = providers.filter((p) => (p.status || "").toLowerCase() === "active");
  const restrictedProviders = providers.filter(
    (p) => ["rejected", "suspended", "deactivated"].includes((p.status || "").toLowerCase())
  );

  // Directory only contains processed/approved providers (pending requests are excluded from Dashboard)
  const directoryProviders = providers.filter(
    (p) => (p.status || "pending").toLowerCase() !== "pending"
  );

  const totalGarments = directoryProviders.reduce((acc, p) => acc + (p.products_count || 0), 0);
  const totalDesigners = directoryProviders.reduce((acc, p) => acc + (p.designers_count || 0), 0);

  // Tab filtering + Search filtering (strictly by name and email, NO ID, NO PENDING REQUESTS)
  const filteredProviders = directoryProviders.filter((p) => {
    const status = (p.status || "").toLowerCase();
    if (activeTab === "active" && status !== "active") return false;
    if (activeTab === "restricted" && !["rejected", "suspended", "deactivated"].includes(status)) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (p.name || "").toLowerCase().includes(term);
    const emailMatch = (p.email || "").toLowerCase().includes(term);
    return nameMatch || emailMatch;
  });

  // Pagination calculation (max 10 records per page)
  const totalPages = Math.max(1, Math.ceil(filteredProviders.length / PAGE_SIZE));
  const paginatedProviders = filteredProviders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Top Banner / Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Portal Governance & Provider Hub
            </h1>
            <p className="text-slate-500 text-xs">
              Superadmin console to govern provider directory, monitor network capacity, and inspect accounts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Superadmin Active
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Governed Providers Card */}
        <Card
          onClick={() => setActiveTab("all")}
          className={`cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md ${
            activeTab === "all"
              ? "border-slate-900 bg-slate-50/70 shadow-xs ring-2 ring-slate-300/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Total Providers
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Users className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{directoryProviders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Governed provider directory
            </p>
          </CardContent>
        </Card>

        {/* Active Providers Card */}
        <Card
          onClick={() => setActiveTab("active")}
          className={`cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md ${
            activeTab === "active"
              ? "border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-300/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Active Providers
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{activeProviders.length}</div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Approved & fulfilling production
            </p>
          </CardContent>
        </Card>

        {/* Restricted / Suspended Card */}
        <Card
          onClick={() => setActiveTab("restricted")}
          className={`cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md ${
            activeTab === "restricted"
              ? "border-rose-400 bg-rose-50/70 shadow-xs ring-2 ring-rose-300/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Rejected / Suspended
            </span>
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{restrictedProviders.length}</div>
            <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
              Restricted or declined access
            </p>
          </CardContent>
        </Card>

        {/* Network Blank Products & Designers */}
        <Card
          onClick={() => setActiveTab("all")}
          className={`cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md ${
            activeTab === "all"
              ? "border-indigo-400 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-300/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Network Capacity
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
              <Store className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{directoryProviders.length}</div>
            <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">
              {totalGarments} blank products · {totalDesigners} designers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Governance Directory Table */}
      <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "all" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Providers ({directoryProviders.length})
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "active" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({activeProviders.length})
            </button>
            <button
              onClick={() => setActiveTab("restricted")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "restricted" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Rejected/Suspended ({restrictedProviders.length})
            </button>
          </div>

          {/* Search Box (strictly name and email, NO ID) */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9 pr-4 h-8 text-xs rounded-lg bg-white border-slate-200"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading providers...</p>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Building2 className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="font-semibold text-slate-700 text-sm">No print providers match current filters</p>
              <p className="text-xs text-slate-400">Try changing your search terms or active tab filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600 pl-6">
                    Provider Organization
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Approval Status
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Network Capacity
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Registration Date
                  </TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-600 pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProviders.map((p) => {
                  const status = (p.status || "pending").toLowerCase();
                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Provider Info (NO ID DISPLAYED) */}
                      <TableCell className="py-3.5 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                            {(p.name || p.email || "P").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{p.name || "Print Provider"}</span>
                            </div>
                            <span className="text-xs text-slate-500 font-mono">{p.email}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Approval Status Badge */}
                      <TableCell>
                        {status === "active" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold gap-1 px-2.5 py-0.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Active / Approved
                          </Badge>
                        ) : status === "pending" ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold gap-1 px-2.5 py-0.5 text-xs animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" /> Pending Review
                          </Badge>
                        ) : status === "rejected" ? (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold gap-1 px-2.5 py-0.5 text-xs">
                            <X className="w-3 h-3 text-rose-600" /> Rejected
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-bold gap-1 px-2.5 py-0.5 text-xs">
                            <AlertTriangle className="w-3 h-3 text-slate-500" /> Suspended
                          </Badge>
                        )}
                      </TableCell>

                      {/* Network & Blank Garments */}
                      <TableCell>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <Package className="w-3.5 h-3.5 text-indigo-500" />
                            <strong>{p.products_count ?? 0}</strong> blanks
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <Users className="w-3.5 h-3.5 text-sky-500" />
                            <strong>{p.designers_count ?? 0}</strong> designers
                          </span>
                        </div>
                      </TableCell>

                      {/* Registration Date */}
                      <TableCell className="text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.createdAt ? format(new Date(p.createdAt), "MMM dd, yyyy") : "N/A"}</span>
                        </div>
                      </TableCell>

                      {/* Governance Action Buttons (Small Icon Buttons Only) */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details Icon Button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewingProvider(p)}
                            className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {status === "active" ? (
                            <Button
                              size="icon"
                              variant="outline"
                              disabled={updatingId === p.id}
                              onClick={() =>
                                setActionConfirm({
                                  provider: p,
                                  targetStatus: "suspended",
                                  title: "Suspend Print Provider",
                                  description: `Are you sure you want to suspend "${p.name || p.email}"? They will not be able to log in or fulfill orders until reactivated.`
                                })
                              }
                              className="h-8 w-8 border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-lg transition-colors"
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
                                  title: "Reactivate & Approve Provider",
                                  description: `Reactivate "${p.name || p.email}"? Their account will be set to active and they can resume normal operations.`
                                })
                              }
                              className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-colors"
                              title="Reactivate Provider"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Data Table Pagination Controls (Max 10 records per page) */}
        {filteredProviders.length > 0 && (
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
                    className={`h-7 w-7 p-0 text-xs rounded-md ${
                      currentPage === num
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

      {/* Confirmation Alert Dialog */}
      <AlertDialog open={actionConfirm !== null} onOpenChange={(open) => !open && setActionConfirm(null)}>
        <AlertDialogContent className="rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">
              {actionConfirm?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 leading-relaxed mt-2">
              {actionConfirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionConfirm) {
                  executeStatusUpdate(actionConfirm.provider.id, actionConfirm.targetStatus);
                }
              }}
              className={`rounded-xl font-bold ${
                actionConfirm?.targetStatus === "active"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              Confirm Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Provider Details Dialog (NO ID NUMBER SHOWN) */}
      <Dialog open={viewingProvider !== null} onOpenChange={(open) => !open && setViewingProvider(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <span>Provider Profile Details</span>
            </DialogTitle>
            <DialogDescription>
              Organization information and registered credentials.
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
                  <span className="text-slate-500 font-medium">Account Status:</span>
                  <Badge className="capitalize font-bold">
                    {viewingProvider.status || "active"}
                  </Badge>
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-400 text-center">
                Member registered on {viewingProvider.createdAt ? format(new Date(viewingProvider.createdAt), "PPP") : "N/A"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
