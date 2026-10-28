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

export default function PortalAdminRequests() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'active' | 'rejected'
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | 'print_provider' | 'designer'
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
      if (!res.ok) throw new Error("Failed to fetch provider requests");
      return res.json();
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

  // Reset to first page when search or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, roleFilter]);

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

  // Filtered lists
  const pendingRequests = providers.filter((p) => (p.status || "pending").toLowerCase() === "pending");
  const activeRequests = providers.filter((p) => (p.status || "").toLowerCase() === "active");
  const rejectedRequests = providers.filter(
    (p) => ["rejected", "suspended", "deactivated"].includes((p.status || "").toLowerCase())
  );

  // Tab-selected list
  const currentTabList =
    activeTab === "pending"
      ? pendingRequests
      : activeTab === "active"
      ? activeRequests
      : activeTab === "rejected"
      ? rejectedRequests
      : providers;

  // Search filtering
  const filteredRequests = currentTabList.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (p.name || "").toLowerCase().includes(term);
    const emailMatch = (p.email || "").toLowerCase().includes(term);
    return nameMatch || emailMatch;
  });

  // Pagination calculation (max 10 records per page)
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Top Banner - Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Registration & Access Requests
            </h1>
            <p className="text-slate-500 text-xs">
              Review and govern onboarding requests submitted by print providers and designers seeking platform access.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {pendingRequests.length} Pending Approval
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

      {/* KPI Overview Cards */}
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
              Approved Providers
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{activeRequests.length}</div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Active and authorized to fulfill
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

      {/* Main Requests Table */}
      <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        {/* Filter and Search Bar */}
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
            {/* Role Filter Selector */}
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

        {/* Content View */}
        <CardContent className="p-0">
          {isLoading ? (
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
                    {/* Provider Info */}
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
                        </div>
                        <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {p.email}
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {status === "pending"
                            ? `Submitted on ${p.createdAt ? format(new Date(p.createdAt), "MMMM dd, yyyy") : "Recently"}`
                            : `Registered on ${p.createdAt ? format(new Date(p.createdAt), "MMMM dd, yyyy") : "Recently"}`}
                        </p>
                      </div>
                    </div>

                    {/* Small Icon-Only Action Buttons */}
                    <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setViewingProvider(p)}
                        className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {status === "pending" ? (
                        <>
                          <Button
                            size="icon"
                            disabled={updatingId === p.id}
                            onClick={() =>
                              setActionConfirm({
                                provider: p,
                                targetStatus: "active",
                                title: isDesigner ? "Approve Designer" : "Approve Print Provider",
                                description: `Approve and activate "${p.name || p.email}" for immediate platform access?`
                              })
                            }
                            className="h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                            title="Approve Request"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={updatingId === p.id}
                            onClick={() =>
                              setActionConfirm({
                                provider: p,
                                targetStatus: "rejected",
                                title: isDesigner ? "Reject Designer Application" : "Reject Application",
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

        {/* Data Table Pagination Controls (Max 10 records per page) */}
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
              className={`rounded-xl font-bold ${actionConfirm?.targetStatus === "active"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-rose-600 hover:bg-rose-700 text-white"
                }`}
            >
              Confirm Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Provider Details Dialog (NO ID NUMBER DISPLAYED) */}
      <Dialog open={viewingProvider !== null} onOpenChange={(open) => !open && setViewingProvider(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              <span>Application Details</span>
            </DialogTitle>
            <DialogDescription>
              Registered applicant credentials and information.
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
              </div>

              <div className="pt-2 text-xs text-slate-400 text-center">
                Registration submitted on {viewingProvider.createdAt ? format(new Date(viewingProvider.createdAt), "PPP") : "N/A"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
