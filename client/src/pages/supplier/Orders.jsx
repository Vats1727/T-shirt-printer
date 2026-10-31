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
  ShoppingBag,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
  TrendingUp,
  Truck,
  Printer,
  Download,
  ExternalLink,
  Store,
  DollarSign,
  User,
  MapPin
} from "lucide-react";
import { getMaskedCode } from "@/utils/idEncoder";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/dateFormatter";
import { exportTransparentPrintAsset } from "@/utils/printAssetExporter";
import { viewMockupPreview } from "@/utils/mockupViewer";

const PAGE_SIZE = 10;

export default function SupplierOrders() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState(null);

  // Filters & Pagination State
  const [activeTab, setActiveTab] = useState("all"); // "all" | "sales" | "in_production" | "shipped" | "samples"
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

  // Tab categorization
  const storeSalesOrders = orders.filter((o) => o.is_customer_order || o.order_type === "customer_sale");
  const sampleOrders = orders.filter((o) => !o.is_customer_order && o.order_type !== "customer_sale");

  const inProductionOrders = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return ["in_printing", "printing", "confirmed", "approved", "processing"].includes(s);
  });

  const shippedOrders = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return ["shipped", "delivered"].includes(s);
  });

  // Designer Net Earnings from Store Sales
  const totalDesignerEarnings = storeSalesOrders.reduce((sum, o) => {
    return sum + (Number(o.designer_earnings_cents || 0) / 100);
  }, 0);

  // Filtered dataset based on tab
  const currentTabOrders = (() => {
    switch (activeTab) {
      case "sales":
        return storeSalesOrders;
      case "in_production":
        return inProductionOrders;
      case "shipped":
        return shippedOrders;
      case "samples":
        return sampleOrders;
      default:
        return orders;
    }
  })();

  // Search Filtering
  const filteredOrders = currentTabOrders.filter((o) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const orderCode = (o.order_number || getMaskedCode(o.id, "ORD")).toLowerCase();
    const customer = (o.customer_name || "").toLowerCase();
    const productTitles = (o.items || [])
      .map((it) => (it.product_title || it.product || "").toLowerCase())
      .join(" ");

    return orderCode.includes(term) || customer.includes(term) || productTitles.includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const renderStatusBadge = (status) => {
    const s = String(status || "pending").toLowerCase();
    switch (s) {
      case "in_printing":
      case "printing":
      case "processing":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs animate-pulse">
            <Printer className="w-3.5 h-3.5 text-amber-600" />
            In Printing
          </Badge>
        );
      case "shipped":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            Shipped
          </Badge>
        );
      case "delivered":
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered
          </Badge>
        );
      case "confirmed":
      case "approved":
      case "paid":
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            Confirmed
          </Badge>
        );
      case "cancelled":
      case "rejected":
      case "declined":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Cancelled
          </Badge>
        );
      case "pending":
      case "placed":
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-bold gap-1.5 px-2.5 py-0.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 pb-12">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Net Earnings */}
        <Card className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Net Designer Profit
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{totalDesignerEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Accumulated earnings from customer sales
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Customer Sales Orders */}
        <Card
          onClick={() => setActiveTab("sales")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "sales"
              ? "border-indigo-500 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Retail Store Orders
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{storeSalesOrders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Orders placed by customers on your store
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: In Production */}
        <Card
          onClick={() => setActiveTab("in_production")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "in_production"
              ? "border-amber-400 bg-amber-50/70 shadow-xs ring-2 ring-amber-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              In Production
            </span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Printer className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{inProductionOrders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Being printed by fulfillment partner
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Dispatched & Delivered */}
        <Card
          onClick={() => setActiveTab("shipped")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "shipped"
              ? "border-blue-400 bg-blue-50/70 shadow-xs ring-2 ring-blue-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Shipped / Delivered
            </span>
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{shippedOrders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Dispatched with courier tracking
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
              All ({orders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "sales" ? "default" : "outline"}
              onClick={() => setActiveTab("sales")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                activeTab === "sales"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Store className="w-3.5 h-3.5" />
              Customer Sales ({storeSalesOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "in_production" ? "default" : "outline"}
              onClick={() => setActiveTab("in_production")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                activeTab === "in_production"
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Printer className="w-3.5 h-3.5" />
              In Production ({inProductionOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "shipped" ? "default" : "outline"}
              onClick={() => setActiveTab("shipped")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                activeTab === "shipped"
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              Shipped ({shippedOrders.length})
            </Button>

            {sampleOrders.length > 0 && (
              <Button
                size="sm"
                variant={activeTab === "samples" ? "default" : "outline"}
                onClick={() => setActiveTab("samples")}
                className={cn(
                  "h-8 rounded-lg text-xs font-bold px-3 gap-1.5",
                  activeTab === "samples"
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                <Package className="w-3.5 h-3.5" />
                Wholesale & Samples ({sampleOrders.length})
              </Button>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order #, customer, garment..."
              className="pl-9 h-8 rounded-lg border-slate-200 text-xs bg-white"
            />
          </div>
        </div>

        {/* Data Table Content */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading your designer orders...</p>
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
                Publish your custom garment designs to your public storefront to start receiving customer orders!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600 pl-6">
                    Order Ref & Date
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Order Type & Buyer
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Garment Creation
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Selling Price
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-emerald-700">
                    Designer Margin
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Fulfillment Status
                  </TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-600 pr-6">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((o, idx) => {
                  const isCustomerOrder = Boolean(o.is_customer_order || o.customer_email || o.order_number);
                  const orderCode = o.order_number || getMaskedCode(o.id || idx + 1, "ORD");
                  const clientName = o.customer_name || (isCustomerOrder ? "Customer" : "Designer Sample Run");
                  const firstItem = o.items?.[0] || {};
                  const garmentTitle = firstItem.product_title || firstItem.product || "Custom Printed Tee";
                  const totalUnits = (o.items || []).reduce((acc, it) => acc + Number(it.quantity || 1), 0);
                  const orderTotal = o.total_cents ? o.total_cents / 100 : Number(o.total || 0);
                  const designerEarnings = o.designer_earnings_cents ? o.designer_earnings_cents / 100 : 0;

                  return (
                    <TableRow key={o.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* Order Ref & Placed Date */}
                      <TableCell className="py-3.5 pl-6">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 text-xs font-mono">
                            {orderCode}
                          </span>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {o.created_at ? formatDate(o.created_at) : "Recent"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Order Type & Buyer */}
                      <TableCell>
                        <div className="space-y-1">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block",
                              o.is_b2b_order
                                ? o.order_type === "sample"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                                : isCustomerOrder
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                            )}
                          >
                            {o.is_b2b_order
                              ? o.order_type === "sample"
                                ? "Sample Purchase (1-4 pcs)"
                                : "Wholesale Bulk Order"
                              : isCustomerOrder
                                ? "Storefront Sale"
                                : "Sample Batch"}
                          </span>
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {o.is_b2b_order ? `Provider: ${o.provider_name || 'Print Provider'}` : clientName}
                          </div>
                        </div>
                      </TableCell>

                      {/* Garment Creation */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {(firstItem.preview_url || firstItem.custom_mockup_url) ? (
                            <img
                              src={firstItem.preview_url || firstItem.custom_mockup_url}
                              alt="Garment Preview"
                              className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-slate-50 shrink-0"
                              onError={(e) => {
                                if (!e.target.src.includes('/templates/tshirt.png')) {
                                  e.target.src = '/templates/tshirt.png';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate max-w-[170px]">
                              {garmentTitle}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              {firstItem.color_hex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block shrink-0"
                                  style={{ backgroundColor: firstItem.color_hex }}
                                />
                              )}
                              <span>{firstItem.color_name || firstItem.color || "Standard"}</span>
                              <span>•</span>
                              <span className="font-semibold">{firstItem.size_label || firstItem.size || "M"}</span>
                              <span>•</span>
                              <span className="font-bold text-slate-700">{totalUnits} pc{totalUnits > 1 ? "s" : ""}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell>
                        <span className="font-bold text-xs text-slate-900 font-mono">
                          ₹{orderTotal.toFixed(2)}
                        </span>
                      </TableCell>

                      {/* Designer Profit Margin */}
                      <TableCell>
                        {isCustomerOrder ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-black font-mono text-xs bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg w-fit">
                            <span>+₹{designerEarnings.toFixed(2)}</span>
                          </div>
                        ) : o.is_b2b_order ? (
                          <span className="text-indigo-600 text-[11px] font-bold">B2B Purchase</span>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">-</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>{renderStatusBadge(o.status)}</TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-6">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setViewingOrder(o)}
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination Controls */}
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

      {/* Designer Order Inspection Modal */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingOrder && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-slate-900">
                      {viewingOrder.order_number || getMaskedCode(viewingOrder.id, "ORD")}
                    </span>
                    {renderStatusBadge(viewingOrder.status)}
                  </div>
                  <span className="text-xs text-slate-400">
                    Placed: {formatDate(viewingOrder.created_at)}
                  </span>
                </div>
                <DialogTitle className="text-sm text-slate-700 font-semibold mt-1">
                  Creator Storefront Order Details & Profit Split
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Inspect retail buyer delivery specs, manufacturing partner assignment, and your net earnings.
                </DialogDescription>
              </DialogHeader>

              {/* Financial Split Highlights Card */}
              {viewingOrder.is_customer_order && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2 bg-white rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Retail Price
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900 mt-0.5 block">
                      ₹{((viewingOrder.total_cents || 0) / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Print Base Cost
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-700 mt-0.5 block">
                      ₹{((viewingOrder.provider_earnings_cents || 0) / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Platform Fee
                    </span>
                    <span className="font-mono font-medium text-sm text-slate-500 mt-0.5 block">
                      ₹{((viewingOrder.platform_fee_cents || 0) / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 block">
                      Your Margin
                    </span>
                    <span className="font-mono font-black text-sm text-white mt-0.5 block">
                      +₹{((viewingOrder.designer_earnings_cents || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Partner Fulfillment & Customer Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Print Provider Partner</span>
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    {viewingOrder.provider_name || "Official Print Provider Hub"}
                  </div>
                  <div className="text-xs text-slate-600 font-mono">
                    {viewingOrder.provider_email || "Direct Facility Fulfillment"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Customer & Delivery Destination</span>
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    {viewingOrder.customer_name || "Retail Customer"}
                  </div>
                  {viewingOrder.shipping_address ? (
                    <div className="text-xs text-slate-600">
                      {[
                        viewingOrder.shipping_address.city,
                        viewingOrder.shipping_address.state,
                        viewingOrder.shipping_address.country || "India"
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Courier Tracking Details */}
              {viewingOrder.tracking_info && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <span>Shipped with {viewingOrder.tracking_info.courier}</span>
                    </div>
                    <div className="text-sm font-mono font-bold text-slate-900">
                      Tracking / AWB: {viewingOrder.tracking_info.tracking_number}
                    </div>
                  </div>

                  {viewingOrder.tracking_info.tracking_url && (
                    <a
                      href={viewingOrder.tracking_info.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>Track Package</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Garment Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Printer className="size-3.5 text-indigo-600" />
                    <span>Custom Creations & Print Techpack ({viewingOrder.items?.length || 0})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Factory Direct Specs</span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {viewingOrder.items?.map((it, idx) => {
                    const printDims = it.print_dimensions || {
                      width_in: 11.0,
                      height_in: 13.5,
                      top_offset_in: 2.5,
                      location: "Center Front Chest",
                      underbase_required: it.color_name && !["white", "pure white", "standard"].includes(String(it.color_name).toLowerCase().trim())
                    };

                    const backPrintDims = it.back_print_dimensions || {
                      width_in: 11.0,
                      height_in: 13.5,
                      top_offset_in: 3.0,
                      location: "Center Upper Back",
                      underbase_required: it.color_name && !["white", "pure white", "standard"].includes(String(it.color_name).toLowerCase().trim())
                    };

                    const hasBackPrint = Boolean(it.has_back_artwork);

                    return (
                      <div key={idx} className="p-4 space-y-3 bg-white">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="flex items-center gap-1.5 shrink-0">
                              {(it.preview_url || it.custom_mockup_url) ? (
                                <button
                                  type="button"
                                  onClick={() => viewMockupPreview(it.preview_url || it.custom_mockup_url, `${it.title || 'Product'} - Front Proof Mockup`)}
                                  className="group relative block shrink-0 cursor-pointer border-0 p-0 bg-transparent"
                                  title="Inspect Front QA mockup"
                                >
                                  <img
                                    src={it.preview_url || it.custom_mockup_url}
                                    alt="Front QA Preview"
                                    className="w-16 h-16 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1 group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      if (!e.target.src.includes('/templates/tshirt.png')) {
                                        e.target.src = '/templates/tshirt.png';
                                      }
                                    }}
                                  />
                                  <span className="absolute bottom-1 right-1 px-1 py-0.2 text-[8px] font-bold bg-slate-900/80 text-white rounded shadow-2xs">
                                    Front
                                  </span>
                                </button>
                              ) : null}

                              {hasBackPrint && (
                                <button
                                  type="button"
                                  onClick={() => viewMockupPreview(it.back_preview_url || it.back_print_file_url, `${it.title || 'Product'} - Back Proof Mockup`)}
                                  className="group relative block shrink-0 cursor-pointer border-0 p-0 bg-transparent"
                                  title="Inspect Back QA mockup"
                                >
                                  <img
                                    src={it.back_preview_url || it.back_print_file_url}
                                    alt="Back QA Preview"
                                    className="w-16 h-16 object-contain rounded-xl border border-indigo-200 bg-indigo-50/40 p-1 group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      if (!e.target.src.includes('/templates/tshirt.png')) {
                                        e.target.src = '/templates/tshirt.png';
                                      }
                                    }}
                                  />
                                  <span className="absolute bottom-1 right-1 px-1 py-0.2 text-[8px] font-bold bg-indigo-900/80 text-white rounded shadow-2xs">
                                    Back
                                  </span>
                                </button>
                              )}

                              {!it.preview_url && !it.custom_mockup_url && !hasBackPrint && (
                                <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <ShoppingBag className="w-6 h-6" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm text-slate-900 flex items-center gap-2 min-w-0">
                                <span className="break-all [overflow-wrap:anywhere] line-clamp-1 min-w-0" title={it.product_title || it.product || "Custom Apparel"}>
                                  {it.product_title || it.product || "Custom Apparel"}
                                </span>
                                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                                  {it.print_method || "DTF Printing"}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
                                <span className="font-semibold text-slate-900">Qty: {it.quantity} pcs</span>
                                <span>•</span>
                                <span className="font-semibold">Size: {it.size_label || it.size || it.garment_size || "M"}</span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  {it.color_hex && (
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                      style={{ backgroundColor: it.color_hex }}
                                    />
                                  )}
                                  <span>Color: {it.color_name || it.color || "Standard"}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right sm:self-center shrink-0">
                            <div className="font-mono font-bold text-sm text-slate-900">
                              ₹{(it.line_total_cents ? it.line_total_cents / 100 : (it.total_price_cents ? it.total_price_cents / 100 : (it.line_total || (it.unit_price || 0) * (it.quantity || 1)))).toFixed(2)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              ₹{(it.unit_price_cents ? it.unit_price_cents / 100 : (it.unit_price || 0)).toFixed(2)} / pc
                            </div>
                          </div>
                        </div>

                        {/* Front Machine Operator Print Techpack Strip */}
                        <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 text-xs space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <Printer className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Front Print Techpack (Production Ready)</span>
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await exportTransparentPrintAsset(it, 'front', viewingOrder.order_number);
                                    toast({ title: "Print Asset Ready", description: "Exported 100% transparent PNG at 300 DPI for RIP software." });
                                  } catch (err) {
                                    toast({ variant: "destructive", title: "Export Error", description: err.message || "Failed to export print asset" });
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition cursor-pointer"
                                title="Download 100% Transparent PNG Artwork (No T-shirt outline) for RIP Machine"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download Transparent Artwork (300 DPI)</span>
                              </button>
                              {(it.preview_url || it.custom_mockup_url) && (
                                <button
                                  type="button"
                                  onClick={() => viewMockupPreview(it.preview_url || it.custom_mockup_url, `${it.title || 'Product'} - Front Proof Mockup`)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                  title="View Visual Mockup Proof on Garment"
                                >
                                  <Eye className="w-3 h-3 text-slate-400" />
                                  <span>Proof Mockup</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Print Area</span>
                              <span className="font-bold text-slate-800">
                                {printDims.width_in ? `${printDims.width_in}" × ${printDims.height_in}"` : '11.0" × 13.5"'}
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Collar Offset</span>
                              <span className="font-bold text-slate-800">
                                {printDims.top_offset_in ? `${printDims.top_offset_in}" below seam` : '2.5" below seam'}
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Placement Zone</span>
                              <span className="font-bold text-slate-800">
                                {printDims.location || "Center Front Chest"}
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Ink / Underbase</span>
                              <span className="font-bold text-slate-800">
                                {printDims.underbase_required ? "White Underbase Required" : "Standard Direct Ink"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Back Techpack: Print Spec OR Clean Blank Banner */}
                        {hasBackPrint ? (
                          <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200/80 text-xs space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                                <Printer className="w-3.5 h-3.5 text-indigo-700" />
                                <span>Back Print Techpack (Production Ready)</span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await exportTransparentPrintAsset(it, 'back', viewingOrder.order_number);
                                      toast({ title: "Back Print Ready", description: "Exported 100% transparent PNG at 300 DPI for RIP software." });
                                    } catch (err) {
                                      toast({ variant: "destructive", title: "Export Error", description: err.message || "Failed to export back print asset" });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition cursor-pointer"
                                  title="Download 100% Transparent PNG Back Artwork (No T-shirt outline) for RIP Machine"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download Transparent Artwork (300 DPI)</span>
                                </button>
                                {(it.back_preview_url || it.back_print_file_url) && (
                                  <button
                                    type="button"
                                    onClick={() => viewMockupPreview(it.back_preview_url || it.back_print_file_url, `${it.title || 'Product'} - Back Proof Mockup`)}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                    title="View Visual Mockup Proof on Garment"
                                  >
                                    <Eye className="w-3 h-3 text-slate-400" />
                                    <span>Proof Mockup</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                                <span className="text-indigo-400 block text-[10px] font-semibold uppercase">Print Area</span>
                                <span className="font-bold text-slate-800">
                                  {backPrintDims.width_in ? `${backPrintDims.width_in}" × ${backPrintDims.height_in}"` : '11.0" × 13.5"'}
                                </span>
                              </div>

                              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                                <span className="text-indigo-400 block text-[10px] font-semibold uppercase">Collar Offset</span>
                                <span className="font-bold text-slate-800">
                                  {backPrintDims.top_offset_in ? `${backPrintDims.top_offset_in}" below seam` : '3.0" below seam'}
                                </span>
                              </div>

                              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                                <span className="text-indigo-400 block text-[10px] font-semibold uppercase">Placement Zone</span>
                                <span className="font-bold text-slate-800">
                                  {backPrintDims.location || "Center Upper Back"}
                                </span>
                              </div>

                              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                                <span className="text-indigo-400 block text-[10px] font-semibold uppercase">Ink / Underbase</span>
                                <span className="font-bold text-slate-800">
                                  {backPrintDims.underbase_required ? "White Underbase Required" : "Standard Direct Ink"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-500">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                              <span className="font-semibold text-slate-700">Garment Back: Blank / Unprinted</span>
                              <span className="text-[11px] text-slate-400">• Single-sided garment (No back print file required)</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-white border-slate-200 text-slate-500 font-semibold uppercase tracking-wider self-start sm:self-auto">
                              Front Only
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  onClick={() => setViewingOrder(null)}
                  className="rounded-xl text-xs bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
