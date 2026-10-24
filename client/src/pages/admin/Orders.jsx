import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Check,
  X,
  Clock,
  ArrowLeft,
  Loader2,
  ShoppingBag,
  UserCheck,
  Package,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getMaskedCode } from "@/utils/idEncoder";
import { cn } from "@/utils/cn";

const PAGE_SIZE = 10;

export default function AdminOrders() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);

  // Filters & Pagination State
  const [activeTab, setActiveTab] = useState("all"); // "all" | "pending" | "confirmed" | "cancelled"
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) return;
      const js = await res.json();
      const orderList = Array.isArray(js)
        ? js
        : Array.isArray(js?.orders)
        ? js.orders
        : [];
      setOrders(orderList);

      // Keep viewingOrder refreshed if open
      if (viewingOrder) {
        const found = orderList.find((x) => x.id === viewingOrder.id);
        if (found) setViewingOrder(found);
      }
    } catch (e) {
      console.error("Failed to load orders", e);
      toast({
        title: "Load Error",
        description: "Failed to load garment orders.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  // Reset page when switching tabs or typing search
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const handleUpdateStatus = async (orderId, status) => {
    try {
      setUpdatingId(orderId);
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to update order status");
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );

      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder((prev) => ({ ...prev, status }));
      }

      toast({
        title: status === "confirmed" ? "Order Approved" : "Order Declined",
        description:
          status === "confirmed"
            ? "Production order approved. Designer is authorized to design and save this product."
            : "Purchase request has been declined."
      });
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update order status",
        variant: "destructive"
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Grouped status lists for KPI calculation
  const pendingOrders = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return !s || ["pending", "placed", "processing", "in_production"].includes(s);
  });

  const confirmedOrders = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return ["confirmed", "approved", "paid", "completed"].includes(s);
  });

  const cancelledOrders = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return ["cancelled", "rejected", "declined"].includes(s);
  });

  const totalFulfillmentCents = orders.reduce(
    (sum, o) => sum + Number(o.total || 0),
    0
  );

  // Tab Filtering
  const currentTabOrders =
    activeTab === "pending"
      ? pendingOrders
      : activeTab === "confirmed"
      ? confirmedOrders
      : activeTab === "cancelled"
      ? cancelledOrders
      : orders;

  // Search Filtering
  const filteredOrders = currentTabOrders.filter((o) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const maskedCode = getMaskedCode(o.id, "ORD").toLowerCase();
    const designerName = (o.designer?.name || o.designer_name || o.customer_name || "").toLowerCase();
    const designerEmail = (o.designer?.email || o.designer_email || o.customer_email || "").toLowerCase();
    const productTitles = (o.items || [])
      .map((it) => (it.product || "").toLowerCase())
      .join(" ");

    return (
      maskedCode.includes(term) ||
      designerName.includes(term) ||
      designerEmail.includes(term) ||
      productTitles.includes(term)
    );
  });

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const renderStatusBadge = (status) => {
    const s = String(status || "pending").toLowerCase();
    switch (s) {
      case "confirmed":
      case "approved":
      case "paid":
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Approved
          </Badge>
        );
      case "cancelled":
      case "rejected":
      case "declined":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <X className="w-3 h-3 text-rose-600" />
            Declined
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs animate-pulse">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Approval
          </Badge>
        );
    }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Top Header - Compact Enterprise Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <span>Print Provider Production Hub</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">Order Management</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Garment Purchase Requests & Orders
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {pendingOrders.length} Pending Approval
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin/dashboard")}
            className="h-8 gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pending Orders */}
        <Card
          onClick={() => setActiveTab("pending")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "pending"
              ? "border-amber-400 bg-amber-50/70 shadow-xs ring-2 ring-amber-300/40"
              : pendingOrders.length > 0
              ? "border-amber-300 bg-gradient-to-br from-amber-50/60 to-white shadow-xs"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Pending Approval
            </span>
            <div
              className={`p-1.5 rounded-lg ${
                pendingOrders.length > 0
                  ? "bg-amber-500 text-white animate-pulse"
                  : "bg-amber-100 text-amber-600"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{pendingOrders.length}</div>
            <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
              {pendingOrders.length > 0 ? "Requires review & action" : "Queue is clear"}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Approved Orders */}
        <Card
          onClick={() => setActiveTab("confirmed")}
          className={cn(
            "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
            activeTab === "confirmed"
              ? "border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Approved Orders
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{confirmedOrders.length}</div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Authorized for production
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Declined Orders */}
        <Card
          onClick={() => setActiveTab("cancelled")}
          className={cn(
            "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
            activeTab === "cancelled"
              ? "border-rose-500 bg-rose-50/70 shadow-xs ring-2 ring-rose-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Declined Requests
            </span>
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{cancelledOrders.length}</div>
            <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
              Rejected or cancelled
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Total Volume */}
        <Card
          onClick={() => setActiveTab("all")}
          className={cn(
            "cursor-pointer transition-all duration-200 rounded-xl border hover:shadow-md",
            activeTab === "all"
              ? "border-indigo-500 bg-indigo-50/60 shadow-xs ring-2 ring-indigo-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Total Order Volume
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs">
              ₹
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              ₹{totalFulfillmentCents.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Across {orders.length} total orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Orders Data Table Card */}
      <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        {/* Filter Tabs and Search Bar (matching portal admin) */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={activeTab === "all" ? "default" : "outline"}
              onClick={() => setActiveTab("all")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                activeTab === "all"
                  ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              All Orders ({orders.length})
            </Button>

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
              Pending ({pendingOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "confirmed" ? "default" : "outline"}
              onClick={() => setActiveTab("confirmed")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                activeTab === "confirmed"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved ({confirmedOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "cancelled" ? "default" : "outline"}
              onClick={() => setActiveTab("cancelled")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                activeTab === "cancelled"
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <XCircle className="w-3.5 h-3.5" />
              Declined ({cancelledOrders.length})
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order ref, designer, garment..."
              className="pl-9 h-8 rounded-lg border-slate-200 text-xs bg-white"
            />
          </div>
        </div>

        {/* Data Table Content */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading garment orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">
                No orders found in this view
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Try adjusting your search query or selecting a different status tab above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600 pl-6">
                    Order Reference & Date
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Designer / Creative Client
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Blank Garment Specification
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Total Volume
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Status
                  </TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-600 pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((o, idx) => {
                  const status = (o.status || "pending").toLowerCase();
                  const isPending = [
                    "pending",
                    "placed",
                    "processing",
                    "in_production"
                  ].includes(status);
                  const firstItem = o.items?.[0] || {};
                  const isBulk = Number(firstItem.quantity || 0) > 10;
                  const designerName =
                    o.designer?.name || o.designer_name || o.customer_name || "Designer Client";
                  const designerEmail =
                    o.designer?.email || o.designer_email || o.customer_email || "designer@platform.com";

                  return (
                    <TableRow key={o.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* Order Ref & Placed Date */}
                      <TableCell className="py-3.5 pl-6">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 text-xs font-mono">
                            {getMaskedCode(o.id || idx + 1, "ORD")}
                          </span>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {o.created_at
                                ? new Date(o.created_at).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric"
                                  })
                                : "Recent"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Designer Contact Info */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {designerName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate">
                              {designerName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate">
                              {designerEmail}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Requested Garment & Quantity */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">
                              {firstItem.product || "Garment Blank"}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                isBulk
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              )}
                            >
                              {isBulk ? "Bulk Wholesale" : "Unit Sample"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            <strong>{firstItem.quantity || 1}</strong> pcs @ ₹
                            {(firstItem.unit_price || 0).toFixed(2)}/pc
                          </div>
                        </div>
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell>
                        <span className="font-extrabold text-sm text-slate-900 font-mono">
                          ₹
                          {(o.total || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell>{renderStatusBadge(o.status)}</TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewingOrder(o)}
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Inspect Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                disabled={updatingId === o.id}
                                onClick={() => handleUpdateStatus(o.id, "confirmed")}
                                className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold gap-1 shadow-2xs transition-colors"
                                title="Approve Production Order"
                              >
                                {updatingId === o.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                )}
                                <span className="hidden xl:inline">Approve</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingId === o.id}
                                onClick={() => handleUpdateStatus(o.id, "cancelled")}
                                className="h-8 px-2 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 rounded-lg text-xs font-semibold gap-1 transition-colors"
                                title="Decline Order"
                              >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span className="hidden xl:inline">Decline</span>
                              </Button>
                            </>
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
        {filteredOrders.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of{" "}
              {filteredOrders.length} orders
            </span>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0 rounded-lg border-slate-200"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                  <Button
                    key={num}
                    size="icon"
                    variant={currentPage === num ? "default" : "ghost"}
                    onClick={() => setCurrentPage(num)}
                    className={cn(
                      "h-8 w-8 p-0 rounded-lg text-xs font-semibold",
                      currentPage === num
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {num}
                  </Button>
                ))}
              </div>

              <Button
                size="icon"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 p-0 rounded-lg border-slate-200"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Order Details Modal (View Details Dialog) */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingOrder && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-slate-900">
                      {getMaskedCode(viewingOrder.id, "ORD")}
                    </span>
                    {renderStatusBadge(viewingOrder.status)}
                  </div>
                  <span className="text-xs text-slate-400">
                    Placed: {new Date(viewingOrder.created_at).toLocaleString()}
                  </span>
                </div>
                <DialogTitle className="text-base text-slate-700 font-semibold mt-1">
                  Garment Purchase Order Specifications
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Inspect buyer contact details, garment batch sizing, and line item financial totals.
                </DialogDescription>
              </DialogHeader>

              {/* Designer Card */}
              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                    Purchasing Designer Client
                  </div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {viewingOrder.designer?.name || viewingOrder.designer_name || viewingOrder.customer_name || "Designer"}
                  </div>
                  <div className="text-xs text-slate-600 font-mono">
                    {viewingOrder.designer?.email || viewingOrder.designer_email || viewingOrder.customer_email}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Order Total
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    ₹{(viewingOrder.total || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Line Items List */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Garment Line Items
                </div>
                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden bg-white">
                  {viewingOrder.items?.map((it, idx) => (
                    <div key={idx} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">
                          {it.product}
                        </span>
                        <span className="font-bold text-sm text-slate-900 font-mono">
                          ₹{(it.line_total || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                        <div>
                          Quantity: <strong>{it.quantity} pcs</strong>
                        </div>
                        <div>
                          Rate: <strong>₹{(it.unit_price || 0).toFixed(2)}</strong>
                        </div>
                        {it.size && (
                          <div>
                            Size: <strong>{it.size}</strong>
                          </div>
                        )}
                        {it.color && (
                          <div>
                            Color: <strong>{it.color?.name || it.color}</strong>
                          </div>
                        )}
                      </div>

                      {it.design_snapshot && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4">
                          <div className="w-20 h-20 rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                            <DesignCanvas
                              width={80}
                              height={80}
                              readonly
                              showTemplate={true}
                              slogan={it.design_snapshot.front?.slogan || ""}
                              color={it.design_snapshot.front?.color || "#000"}
                              template={it.design_snapshot.front?.template || "tshirt"}
                              templateColor={it.design_snapshot.front?.templateColor}
                              templateImage={it.design_snapshot.front?.templateImage}
                              image={it.design_snapshot.front?.image}
                              imageScale={it.design_snapshot.front?.imageScale || 100}
                              imageRotation={it.design_snapshot.front?.imageRotation || 0}
                              imagePosition={it.design_snapshot.front?.imagePosition || { x: 150, y: 150 }}
                              tintImage={false}
                            />
                          </div>
                          <div className="text-xs text-slate-500">
                            <div className="font-semibold text-slate-700">Design Mockup Snapshot</div>
                            <div>Attached graphics and typography embedded with purchase.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions in Dialog */}
              <DialogFooter className="gap-2 sm:justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setViewingOrder(null)}
                  className="rounded-xl"
                >
                  Close
                </Button>

                {viewingOrder.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={updatingId === viewingOrder.id}
                      onClick={() => handleUpdateStatus(viewingOrder.id, "cancelled")}
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl"
                    >
                      <X className="w-4 h-4 mr-1.5" /> Decline Request
                    </Button>
                    <Button
                      disabled={updatingId === viewingOrder.id}
                      onClick={() => handleUpdateStatus(viewingOrder.id, "confirmed")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                    >
                      <Check className="w-4 h-4 mr-1.5" /> Approve Production
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
