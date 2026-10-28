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
  ChevronLeft,
  ChevronRight,
  Palette,
  Mail
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
      if (!res.ok) throw new Error("Failed to fetch portal accounts");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  // Include both print_providers and designers
  const allAccounts = (Array.isArray(providersRaw) ? providersRaw : providersRaw?.providers || []).filter(
    (p) => p.role === "print_provider" || p.role === "admin" || p.role === "designer"
  );

  // Directory contains processed accounts (pending requests are managed under the Requests page)
  const directoryAccounts = allAccounts.filter(
    (p) => (p.status || "pending").toLowerCase() !== "pending"
  );

  const printProvidersList = directoryAccounts.filter((p) => p.role === "print_provider" || p.role === "admin");
  const designersList = directoryAccounts.filter((p) => p.role === "designer");

  const activeAccounts = directoryAccounts.filter((p) => (p.status || "").toLowerCase() === "active");
  const restrictedAccounts = directoryAccounts.filter((p) =>
    ["rejected", "suspended", "deactivated"].includes((p.status || "").toLowerCase())
  );

  const totalGarments = printProvidersList.reduce((acc, p) => acc + (p.products_count || 0), 0);
  const totalDesignersCount = designersList.length;

  // Filter accounts by role
  const roleFilteredAccounts = directoryAccounts.filter((p) => {
    if (roleFilter === "all") return true;
    if (roleFilter === "print_provider") return p.role === "print_provider" || p.role === "admin";
    return p.role === roleFilter;
  });

  // Filter by status tab & search term
  const filteredAccounts = roleFilteredAccounts.filter((p) => {
    const status = (p.status || "").toLowerCase();
    if (activeTab === "active" && status !== "active") return false;
    if (activeTab === "restricted" && !["rejected", "suspended", "deactivated"].includes(status)) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (p.name || "").toLowerCase().includes(term);
    const emailMatch = (p.email || "").toLowerCase().includes(term);
    const providerMatch = (p.associated_provider_name || "").toLowerCase().includes(term);
    return nameMatch || emailMatch || providerMatch;
  });

  // Reset to first page when search, tab, or role filter changes
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
        throw new Error(js.message || "Failed to update account status");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/portal/providers"] });

      const statusLabels = {
        active: "Approved & Activated",
        rejected: "Rejected",
        suspended: "Suspended",
        pending: "Moved to Pending"
      };

      const isDesigner = actionConfirm?.provider?.role === "designer";
      const targetLabel = isDesigner ? "Designer" : "Provider";

      toast({
        title: `${targetLabel} ${statusLabels[newStatus] || "Updated"}`,
        description:
          newStatus === "active"
            ? `${targetLabel} account has been approved and activated.`
            : newStatus === "rejected"
            ? `${targetLabel} account has been rejected.`
            : `${targetLabel} status set to ${newStatus}.`
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

  // Pagination calculation (max 10 records per page)
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const paginatedAccounts = filteredAccounts.slice(
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
              Portal Governance & Directory
            </h1>
            <p className="text-slate-500 text-xs">
              Superadmin console to govern print providers and designers, monitor network capacity, and inspect accounts.
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
        {/* Total Governed Accounts Card */}
        <Card
          onClick={() => {
            setActiveTab("all");
            setRoleFilter("all");
          }}
          className={`cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md ${
            activeTab === "all" && roleFilter === "all"
              ? "border-slate-900 bg-slate-50/70 shadow-xs ring-2 ring-slate-300/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Total Accounts
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Users className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{directoryAccounts.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {printProvidersList.length} Providers · {designersList.length} Designers
            </p>
          </CardContent>
        </Card>

        {/* Print Providers Card */}
        <Card
          onClick={() => {
            setRoleFilter("print_provider");
            setActiveTab("all");
          }}
          className={`cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md ${
            roleFilter === "print_provider"
              ? "border-blue-500 bg-blue-50/70 shadow-xs ring-2 ring-blue-300/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Print Providers
            </span>
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
              <Store className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{printProvidersList.length}</div>
            <p className="text-[11px] text-blue-700 mt-0.5 font-medium">
              {printProvidersList.filter((p) => (p.status || "").toLowerCase() === "active").length} active · {totalGarments} blank garments
            </p>
          </CardContent>
        </Card>

        {/* Designers Card */}
        <Card
          onClick={() => {
            setRoleFilter("designer");
            setActiveTab("all");
          }}
          className={`cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md ${
            roleFilter === "designer"
              ? "border-purple-500 bg-purple-50/70 shadow-xs ring-2 ring-purple-300/40"
              : "border-slate-200 bg-white"
          }`}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
              Designers
            </span>
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
              <Palette className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{totalDesignersCount}</div>
            <p className="text-[11px] text-purple-700 mt-0.5 font-medium">
              {designersList.filter((p) => (p.status || "").toLowerCase() === "active").length} active designers in network
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
            <div className="text-2xl font-black text-slate-900">{restrictedAccounts.length}</div>
            <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
              Restricted or declined access
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Directory Table Card */}
      <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          {/* Status Tabs & Role Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "all" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({roleFilteredAccounts.length})
              </button>
              <button
                onClick={() => setActiveTab("active")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "active" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Active ({roleFilteredAccounts.filter((p) => (p.status || "").toLowerCase() === "active").length})
              </button>
              <button
                onClick={() => setActiveTab("restricted")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "restricted" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Rejected/Suspended ({roleFilteredAccounts.filter((p) => ["rejected", "suspended", "deactivated"].includes((p.status || "").toLowerCase())).length})
              </button>
            </div>

            {/* Role Filter Selector */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  roleFilter === "all" ? "bg-slate-800 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Roles
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("print_provider")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  roleFilter === "print_provider" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Providers ({printProvidersList.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("designer")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  roleFilter === "designer" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Designers ({designersList.length})
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, provider..."
              className="pl-9 pr-4 h-8 text-xs rounded-lg bg-white border-slate-200"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading directory accounts...</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Building2 className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="font-semibold text-slate-700 text-sm">No accounts match current filters</p>
              <p className="text-xs text-slate-400">Try changing your search terms, role filter, or active tab.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600 pl-6">
                    Account / User
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Role
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Approval Status
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Affiliation / Capacity
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
                {paginatedAccounts.map((p) => {
                  const status = (p.status || "pending").toLowerCase();
                  const isDesigner = p.role === "designer";
                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Account Info */}
                      <TableCell className="py-3.5 pl-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-sm border shrink-0 ${
                              isDesigner
                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                : "bg-indigo-100 text-indigo-700 border-indigo-200"
                            }`}
                          >
                            {(p.name || p.email || (isDesigner ? "D" : "P")).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {p.name || (isDesigner ? "Designer" : "Print Provider")}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 font-mono">{p.email}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Role Badge */}
                      <TableCell>
                        {isDesigner ? (
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-bold gap-1 px-2.5 py-0.5 text-xs">
                            <Palette className="w-3 h-3" /> Designer
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold gap-1 px-2.5 py-0.5 text-xs">
                            <Building2 className="w-3 h-3" /> Print Provider
                          </Badge>
                        )}
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

                      {/* Capacity / Affiliation */}
                      <TableCell>
                        {isDesigner ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Store className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            {p.associated_provider_name ? (
                              <span>
                                Under: <strong className="text-slate-800">{p.associated_provider_name}</strong>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Independent</span>
                            )}
                          </div>
                        ) : (
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
                        )}
                      </TableCell>

                      {/* Registration Date */}
                      <TableCell className="text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.createdAt ? format(new Date(p.createdAt), "MMM dd, yyyy") : "N/A"}</span>
                        </div>
                      </TableCell>

                      {/* Governance Action Buttons */}
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
                                  title: isDesigner ? "Suspend Designer" : "Suspend Print Provider",
                                  description: `Are you sure you want to suspend "${p.name || p.email}"? They will not be able to log in until reactivated.`
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
                                  title: isDesigner ? "Reactivate Designer" : "Reactivate Provider",
                                  description: `Reactivate "${p.name || p.email}"? Their account will be set to active and they can resume normal operations.`
                                })
                              }
                              className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-colors"
                              title="Reactivate Account"
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

        {/* Pagination Controls */}
        {filteredAccounts.length > 0 && (
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

      {/* Account Details Dialog */}
      <Dialog open={viewingProvider !== null} onOpenChange={(open) => !open && setViewingProvider(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {viewingProvider?.role === "designer" ? (
                <>
                  <Palette className="w-5 h-5 text-purple-600" />
                  <span>Designer Profile Details</span>
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <span>Provider Profile Details</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {viewingProvider?.role === "designer"
                ? "Creative team member credentials and platform affiliation."
                : "Organization information, registered credentials, and network capacity."}
            </DialogDescription>
          </DialogHeader>

          {viewingProvider && (
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Name / Organization:</span>
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
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Account Status:</span>
                  <Badge className="capitalize font-bold">
                    {viewingProvider.status || "active"}
                  </Badge>
                </div>

                {viewingProvider.role === "designer" ? (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Associated Provider:</span>
                    <strong className="text-slate-900">
                      {viewingProvider.associated_provider_name
                        ? `${viewingProvider.associated_provider_name}${viewingProvider.associated_provider_email ? ` (${viewingProvider.associated_provider_email})` : ""}`
                        : "Independent / Unassigned"}
                    </strong>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Blank Garments:</span>
                      <strong className="text-slate-900">{viewingProvider.products_count ?? 0} items</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium block mb-1.5">
                        Associated Designers ({allAccounts.filter((u) => u.role === "designer" && Number(u.associated_provider_id) === Number(viewingProvider.id)).length}):
                      </span>
                      {(() => {
                        const associated = allAccounts.filter(
                          (u) => u.role === "designer" && Number(u.associated_provider_id) === Number(viewingProvider.id)
                        );
                        if (associated.length === 0) {
                          return <span className="text-xs text-slate-400 italic">No designers associated with this provider yet.</span>;
                        }
                        return (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {associated.map((d) => (
                              <div
                                key={d.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-slate-900">{d.name || "Designer"}</span>
                                  <span className="text-slate-400 block font-mono text-[11px]">{d.email}</span>
                                </div>
                                <Badge className="text-[10px] capitalize font-bold">
                                  {d.status || "active"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
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
