import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
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
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  Paintbrush,
  ShoppingBag,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
  DollarSign
} from "lucide-react";
import { getMaskedCode } from "@/utils/idEncoder";
import { cn } from "@/utils/cn";

const PAGE_SIZE = 10;

export default function SupplierOrders() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState(null);

  // Filters & Pagination State
  const [activeTab, setActiveTab] = useState("all"); // "all" | "pending" | "confirmed" | "cancelled"
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/supplier/orders", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        const data = await res.json();
        const orderList = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
          ? data.orders
          : [];
        setOrders(orderList);

        if (viewingOrder) {
          const found = orderList.find((x) => x.id === viewingOrder.id);
          if (found) setViewingOrder(found);
        }
      }
    } catch (err) {
      console.error("Failed to load designer orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

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

  const totalSpendCents = orders.reduce(
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
    const productTitles = (o.items || [])
      .map((it) => (it.product || "").toLowerCase())
      .join(" ");

    return maskedCode.includes(term) || productTitles.includes(term);
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
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved & Unlocked
          </Badge>
        );
      case "cancelled":
      case "rejected":
      case "declined":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Order Declined
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Awaiting Approval
          </Badge>
        );
    }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 pb-12">
      {/* Top Professional Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/supplier/dashboard")}
            className="size-9 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            title="Return to Dashboard"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <span>Designer Sourcing Portal</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">Procurement History</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Blank Garment Purchase Orders
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
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
            onClick={() => setLocation("/supplier/dashboard")}
            className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Browse Blank Catalog
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Orders */}
        <Card
          onClick={() => setActiveTab("all")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "all"
              ? "border-indigo-500 bg-indigo-50/60 shadow-xs ring-2 ring-indigo-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Total Orders Placed
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{orders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Sample runs & wholesale batches
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Pending Approval */}
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
              Awaiting Approval
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
              {pendingOrders.length > 0 ? "Under review by provider" : "No orders awaiting action"}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Approved Orders */}
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
              Approved & Unlocked
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{confirmedOrders.length}</div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Ready for design customization
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Total Spend */}
        <Card
          className="rounded-xl border border-slate-200 bg-white shadow-xs"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Procurement Volume
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
              ₹
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              ₹{totalSpendCents.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Committed garment procurement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Orders Data Table Card */}
      <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        {/* Filter Tabs and Search Bar */}
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
              placeholder="Search by order ref, garment..."
              className="pl-9 h-8 rounded-lg border-slate-200 text-xs bg-white"
            />
          </div>
        </div>

        {/* Data Table Content */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading your orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">
                No orders match your filter
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Browse our print provider catalog to order garment blanks for your merchandise.
              </p>
              <Button
                onClick={() => setLocation("/supplier/dashboard")}
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl h-8 font-semibold"
              >
                Browse Blank Silhouettes
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600 pl-6">
                    Order Reference & Date
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Blank Garment Item
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Order Tier & Units
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Total Amount
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Approval Status
                  </TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-600 pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((o, idx) => {
                  const status = (o.status || "pending").toLowerCase();
                  const isApproved = [
                    "confirmed",
                    "approved",
                    "paid",
                    "completed"
                  ].includes(status);
                  const firstItem = o.items?.[0] || {};
                  const isBulk = Number(firstItem.quantity || 0) > 10;

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

                      {/* Blank Garment Item */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-bold text-xs text-slate-900">
                            {firstItem.product || "Garment Blank"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Unit Price: ₹{(firstItem.unit_price || 0).toFixed(2)}/pc
                          </div>
                        </div>
                      </TableCell>

                      {/* Tier & Units */}
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                          <span className="font-bold text-xs text-slate-900">
                            {firstItem.quantity || 1} pcs
                          </span>
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

                      {/* Approval Status Badge */}
                      <TableCell>{renderStatusBadge(o.status)}</TableCell>

                      {/* Action Buttons */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewingOrder(o)}
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="View Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {isApproved && firstItem?.product_id && (
                            <Button
                              size="sm"
                              onClick={() => setLocation(`/supplier/product/${firstItem.product_id}`)}
                              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold gap-1.5 shadow-2xs transition-colors"
                            >
                              <Paintbrush className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Design Studio</span>
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

      {/* Order Details Dialog Modal */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
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
                  Procurement Order Specifications
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Detailed breakdown of purchased garment blanks and line items.
                </DialogDescription>
              </DialogHeader>

              {/* Order Total Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Fulfillment Provider
                  </div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {viewingOrder.supplier?.name || "Assigned Print Provider"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Invoiced
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    ₹{(viewingOrder.total || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Itemized Blanks
                </div>
                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden bg-white">
                  {viewingOrder.items?.map((it, idx) => (
                    <div key={idx} className="p-4 space-y-1.5">
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
                          Rate: <strong>₹{(it.unit_price || 0).toFixed(2)}/pc</strong>
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
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <DialogFooter className="gap-2 sm:justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setViewingOrder(null)}
                  className="rounded-xl"
                >
                  Close
                </Button>

                {["confirmed", "approved", "paid", "completed"].includes(
                  (viewingOrder.status || "").toLowerCase()
                ) && viewingOrder.items?.[0]?.product_id && (
                  <Button
                    onClick={() =>
                      setLocation(`/supplier/product/${viewingOrder.items[0].product_id}`)
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs gap-1.5"
                  >
                    <Paintbrush className="w-4 h-4" />
                    Open in Design Studio
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
