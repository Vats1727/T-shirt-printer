import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Printer,
  Truck,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Building2,
  CreditCard
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getMaskedCode } from "@/utils/idEncoder";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/dateFormatter";

const PAGE_SIZE = 10;

export default function AdminOrders() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [updatingId, setUpdatingId] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);

  // Dispatch / Shipping Modal State
  const [shippingModalOrder, setShippingModalOrder] = useState(null);
  const [courierName, setCourierName] = useState("Blue Dart");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [shippingSubmitting, setShippingSubmitting] = useState(false);

  // Filters & Pagination State
  const [activeTab, setActiveTab] = useState("all"); // "all" | "pending" | "confirmed" | "in_printing" | "shipped" | "delivered" | "cancelled"
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Real-time Query Hook with Auto 5s Polling & Instant Fresh Cache
  const {
    data: rawOrdersData,
    isLoading: loading,
    refetch: fetchOrders
  } = useQuery({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load production orders");
      return res.json();
    },
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5000
  });

  // Assign guaranteed unique key to every order to prevent React DOM reconciliation collisions
  const orders = useMemo(() => {
    const list = Array.isArray(rawOrdersData)
      ? rawOrdersData
      : Array.isArray(rawOrdersData?.orders)
        ? rawOrdersData.orders
        : [];
    return list.map((o, idx) => ({
      ...o,
      _uniqueKey: `${o.is_b2b_order ? "b2b" : o.is_customer_order ? "cust" : "leg"}-${o.id}-${o.order_number || idx}`
    }));
  }, [rawOrdersData]);

  // Keep viewingOrder in sync when orders refresh
  useEffect(() => {
    if (viewingOrder && orders.length > 0) {
      const found = orders.find(
        (x) =>
          x._uniqueKey === viewingOrder._uniqueKey ||
          (x.id === viewingOrder.id && x.is_customer_order === viewingOrder.is_customer_order)
      );
      if (found) {
        setViewingOrder(found);
      }
    }
  }, [orders]);

  // Synchronous Filter and Page Switch Handlers for Instant UI Response
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setCurrentPage(1);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleUpdateStatus = async (orderOrId, status, trackingPayload = null) => {
    const isObj = orderOrId && typeof orderOrId === "object";
    const orderId = isObj ? orderOrId.id : orderOrId;
    const isCustomerOrder = isObj ? Boolean(orderOrId.is_customer_order) : true;
    const isB2BOrder = isObj ? Boolean(orderOrId.is_b2b_order) : false;
    const uniqueKey = isObj ? orderOrId._uniqueKey : null;

    try {
      setUpdatingId(orderId);
      const body = {
        status,
        is_customer_order: isCustomerOrder,
        is_b2b_order: isB2BOrder,
        order_type: orderOrId?.order_type
      };
      if (trackingPayload) {
        body.tracking_info = trackingPayload;
      }

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to update order status");
      }

      // Optimistically update React Query cache immediately
      queryClient.setQueryData(["/api/admin/orders"], (oldData) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData) ? oldData : (oldData.orders || []);
        const updatedList = list.map((o) => {
          const match = uniqueKey
            ? (`${o.is_customer_order ? "cust" : "leg"}-${o.id}-${o.order_number}` === uniqueKey || o.id === orderId)
            : o.id === orderId;
          if (match) {
            return {
              ...o,
              status,
              ...(trackingPayload ? { tracking_info: trackingPayload } : {})
            };
          }
          return o;
        });

        return Array.isArray(oldData) ? updatedList : { ...oldData, orders: updatedList };
      });

      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder((prev) => ({
          ...prev,
          status,
          tracking_info: trackingPayload || prev.tracking_info
        }));
      }

      const statusLabels = {
        confirmed: "Order Approved",
        in_printing: "Order In Printing Production",
        shipped: "Order Dispatched & Tracking Added",
        delivered: "Order Marked as Delivered",
        cancelled: "Order Declined"
      };

      toast({
        title: statusLabels[status] || "Status Updated",
        description: `Order #${getMaskedCode(orderId, "ORD")} status changed to ${status.replace("_", " ")}.`
      });

      // Background refetch for full backend synchronization
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
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

  const submitShipping = async (e) => {
    e?.preventDefault();
    if (!shippingModalOrder) return;
    if (!trackingNumber.trim()) {
      toast({
        title: "Tracking Number Required",
        description: "Please enter the courier tracking / AWB number.",
        variant: "destructive"
      });
      return;
    }

    try {
      setShippingSubmitting(true);
      const trackingPayload = {
        courier: courierName,
        tracking_number: trackingNumber.trim(),
        tracking_url:
          trackingUrl.trim() ||
          `https://www.google.com/search?q=${encodeURIComponent(courierName + " tracking " + trackingNumber)}`,
        notes: shippingNotes.trim(),
        shipped_at: new Date().toISOString()
      };

      await handleUpdateStatus(shippingModalOrder, "shipped", trackingPayload);
      setShippingModalOrder(null);
      setTrackingNumber("");
      setTrackingUrl("");
      setShippingNotes("");
    } finally {
      setShippingSubmitting(false);
    }
  };

  // Grouped memoized counts for tabs
  const pendingOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return ["pending", "placed"].includes(s);
      }),
    [orders]
  );

  const confirmedOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return ["confirmed", "approved", "paid"].includes(s);
      }),
    [orders]
  );

  const printingOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return ["in_printing", "printing", "processing"].includes(s);
      }),
    [orders]
  );

  const shippedOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return ["shipped"].includes(s);
      }),
    [orders]
  );

  const deliveredOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return ["delivered", "completed"].includes(s);
      }),
    [orders]
  );

  const cancelledOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return ["cancelled", "rejected", "declined"].includes(s);
      }),
    [orders]
  );

  const b2bOrders = useMemo(
    () => orders.filter((o) => o.is_b2b_order === true),
    [orders]
  );

  const totalPayout = useMemo(
    () =>
      orders.reduce((sum, o) => {
        const cents = o.provider_earnings_cents || (o.total ? o.total * 100 : 0);
        return sum + Number(cents || 0) / 100;
      }, 0),
    [orders]
  );

  // Instant In-Memory Tab Filtering
  const currentTabOrders = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return pendingOrders;
      case "confirmed":
        return confirmedOrders;
      case "in_printing":
        return printingOrders;
      case "shipped":
        return shippedOrders;
      case "delivered":
        return deliveredOrders;
      case "cancelled":
        return cancelledOrders;
      case "b2b":
        return b2bOrders;
      case "all":
      default:
        return orders;
    }
  }, [
    activeTab,
    orders,
    pendingOrders,
    confirmedOrders,
    printingOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,
    b2bOrders
  ]);

  // Instant In-Memory Search Filtering
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return currentTabOrders;
    const term = searchTerm.toLowerCase();
    return currentTabOrders.filter((o) => {
      const orderNo = (o.order_number || getMaskedCode(o.id, "ORD")).toLowerCase();
      const customer = (o.customer_name || o.designer?.name || o.designer_name || "").toLowerCase();
      const email = (o.customer_email || o.designer?.email || o.designer_email || "").toLowerCase();
      const productTitles = (o.items || [])
        .map((it) => (it.product_title || it.product || "").toLowerCase())
        .join(" ");

      return (
        orderNo.includes(term) ||
        customer.includes(term) ||
        email.includes(term) ||
        productTitles.includes(term)
      );
    });
  }, [currentTabOrders, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

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
            In Transit / Shipped
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
            <Check className="w-3.5 h-3.5 text-indigo-600" />
            Confirmed & Ready
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
            Awaiting Confirmation
          </Badge>
        );
    }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 pb-12">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ready to Print */}
        <Card
          onClick={() => handleTabChange("confirmed")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "confirmed"
              ? "border-indigo-400 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Ready to Print
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <Printer className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{confirmedOrders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Confirmed & waiting for printing run
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: On The Press */}
        <Card
          onClick={() => handleTabChange("in_printing")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "in_printing"
              ? "border-amber-400 bg-amber-50/70 shadow-xs ring-2 ring-amber-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              On The Press
            </span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{printingOrders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Actively printing & curing
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: In Transit */}
        <Card
          onClick={() => handleTabChange("shipped")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            activeTab === "shipped"
              ? "border-blue-400 bg-blue-50/70 shadow-xs ring-2 ring-blue-300/40"
              : "border-slate-200 bg-white"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Dispatched & En Route
            </span>
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{shippedOrders.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              With courier tracking assigned
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Total Payout Volume */}
        <Card
          onClick={() => handleTabChange("all")}
          className="rounded-xl border border-slate-200 bg-white shadow-xs cursor-pointer hover:shadow-md transition-all duration-200"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Fulfillment Volume
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
              ₹
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              ₹{totalPayout.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Print manufacturing revenue
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
              onClick={() => handleTabChange("all")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
                activeTab === "all"
                  ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              All Orders ({orders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "b2b" ? "default" : "outline"}
              onClick={() => handleTabChange("b2b")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
                activeTab === "b2b"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              )}
            >
              <Package className="w-3.5 h-3.5" />
              B2B Wholesale ({b2bOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "pending" ? "default" : "outline"}
              onClick={() => handleTabChange("pending")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
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
              onClick={() => handleTabChange("confirmed")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
                activeTab === "confirmed"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Printer className="w-3.5 h-3.5" />
              Ready to Print ({confirmedOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "in_printing" ? "default" : "outline"}
              onClick={() => handleTabChange("in_printing")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
                activeTab === "in_printing"
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              In Printing ({printingOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "shipped" ? "default" : "outline"}
              onClick={() => handleTabChange("shipped")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
                activeTab === "shipped"
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              Dispatched ({shippedOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "delivered" ? "default" : "outline"}
              onClick={() => handleTabChange("delivered")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
                activeTab === "delivered"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Delivered ({deliveredOrders.length})
            </Button>

            <Button
              size="sm"
              variant={activeTab === "cancelled" ? "default" : "outline"}
              onClick={() => handleTabChange("cancelled")}
              className={cn(
                "h-8 rounded-lg text-xs font-bold px-3 gap-1.5 transition-all",
                activeTab === "cancelled"
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelled ({cancelledOrders.length})
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
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
              <p className="text-xs font-medium">Loading production queue...</p>
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
                All production jobs in this category are up to date.
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
                    Channel & Client
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Garment Specs
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Volume & Value
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Fulfillment Status
                  </TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-600 pr-6">
                    Actions & Pipeline
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((o, idx) => {
                  const status = (o.status || "pending").toLowerCase();
                  const isCustomerOrder = Boolean(o.is_customer_order || o.customer_email || o.order_number);
                  const orderCode = o.order_number || getMaskedCode(o.id || idx + 1, "ORD");
                  const clientName = o.customer_name || o.designer?.name || o.designer_name || "Direct Customer";
                  const clientEmail = o.customer_email || o.designer?.email || o.designer_email || "";
                  const firstItem = o.items?.[0] || {};
                  const garmentTitle = firstItem.product_title || firstItem.product || "Custom Printed Garment";
                  const totalUnits = (o.items || []).reduce((acc, it) => acc + Number(it.quantity || 1), 0);
                  const orderTotal = o.total_cents ? o.total_cents / 100 : Number(o.total || 0);
                  const providerPayout = o.provider_earnings_cents ? o.provider_earnings_cents / 100 : orderTotal;

                  return (
                    <TableRow key={o._uniqueKey} className="hover:bg-slate-50/70 transition-colors">
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

                      {/* Channel & Client Info */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                                o.is_b2b_order
                                  ? o.order_type === "sample"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                  : isCustomerOrder
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                              )}
                            >
                              {o.is_b2b_order
                                ? o.order_type === "sample"
                                  ? "B2B Designer Sample"
                                  : "B2B Wholesale Batch"
                                : isCustomerOrder
                                  ? "Customer Storefront"
                                  : "Designer Batch"}
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {clientName}
                          </div>
                          {clientEmail && (
                            <div className="text-[11px] text-slate-400 font-mono leading-tight">
                              {clientEmail}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Garment Specification */}
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
                            <div className="font-bold text-xs text-slate-900 truncate max-w-[180px]">
                              {garmentTitle}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              {firstItem.color_hex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block shrink-0"
                                  style={{ backgroundColor: firstItem.color_hex }}
                                  title={firstItem.color_name || "Color"}
                                />
                              )}
                              <span>{firstItem.color_name || firstItem.color || "Standard"}</span>
                              <span>•</span>
                              <span className="font-semibold">{firstItem.size_label || firstItem.size || "M"}</span>
                              {o.items?.length > 1 && (
                                <span className="text-slate-400">+{o.items.length - 1} more</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Volume & Payout */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-xs text-slate-900 font-mono">
                            ₹{providerPayout.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {totalUnits} unit{totalUnits > 1 ? "s" : ""}
                          </div>
                        </div>
                      </TableCell>

                      {/* Fulfillment Status */}
                      <TableCell>{renderStatusBadge(o.status)}</TableCell>

                      {/* Actions & Pipeline Buttons */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Inspector */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewingOrder(o)}
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Inspect Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* Quick Pipeline Status Actions */}
                          {(status === "confirmed" || status === "approved" || status === "paid") && (
                            <Button
                              size="sm"
                              disabled={updatingId === o.id}
                              onClick={() => handleUpdateStatus(o, "in_printing")}
                              className="h-8 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold gap-1 shadow-2xs transition-colors"
                              title="Start Printing Job"
                            >
                              {updatingId === o.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Printer className="w-3.5 h-3.5" />
                              )}
                              <span>Start Printing</span>
                            </Button>
                          )}

                          {(status === "in_printing" || status === "printing" || status === "processing") && (
                            <Button
                              size="sm"
                              disabled={updatingId === o.id}
                              onClick={() => {
                                setShippingModalOrder(o);
                                setTrackingNumber(o.tracking_info?.tracking_number || "");
                                setCourierName(o.tracking_info?.courier || "Blue Dart");
                              }}
                              className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold gap-1 shadow-2xs transition-colors"
                              title="Mark Shipped & Assign Courier"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch</span>
                            </Button>
                          )}

                          {status === "shipped" && (
                            <Button
                              size="sm"
                              disabled={updatingId === o.id}
                              onClick={() => handleUpdateStatus(o, "delivered")}
                              className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold gap-1 shadow-2xs transition-colors"
                              title="Confirm Delivery to Customer"
                            >
                              {updatingId === o.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Delivered</span>
                            </Button>
                          )}

                          {(status === "pending" || status === "placed") && (
                            <>
                              <Button
                                size="sm"
                                disabled={updatingId === o.id}
                                onClick={() => handleUpdateStatus(o, "confirmed")}
                                className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold gap-1 shadow-2xs"
                                title="Confirm Order for Printing"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Confirm</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingId === o.id}
                                onClick={() => handleUpdateStatus(o, "cancelled")}
                                className="h-8 px-2 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold"
                                title="Decline Order"
                              >
                                <X className="w-3.5 h-3.5" />
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

        {/* Data Table Pagination Controls */}
        {filteredOrders.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of{" "}
              {filteredOrders.length} production orders
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

      {/* Dispatch / Shipping Tracking Modal */}
      <Dialog open={!!shippingModalOrder} onOpenChange={(open) => !open && setShippingModalOrder(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
              <Truck className="w-4 h-4" />
              <span>Fulfillment Dispatch</span>
            </div>
            <DialogTitle className="text-lg font-black text-slate-900 mt-1">
              Dispatch & Enter Tracking Info
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provide courier details and tracking number. The customer will be able to track this shipment directly.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitShipping} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Courier / Shipping Carrier</Label>
              <select
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="w-full mt-1.5 h-9 rounded-xl border border-slate-200 px-3 text-xs font-medium bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Blue Dart">Blue Dart Express</option>
                <option value="Delhivery">Delhivery</option>
                <option value="DTDC">DTDC Courier</option>
                <option value="Ekart">Ekart Logistics</option>
                <option value="India Post Speed Post">India Post (Speed Post)</option>
                <option value="FedEx India">FedEx India</option>
                <option value="Shadowfax">Shadowfax</option>
                <option value="Other Carrier">Other Standard Courier</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Tracking / AWB Number *</Label>
              <Input
                required
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. BD789456123IN"
                className="mt-1.5 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Tracking URL (Optional)</Label>
              <Input
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://track.bluedart.com/..."
                className="mt-1.5 text-xs font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                If omitted, an automatic direct search link will be generated.
              </span>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Dispatch Notes (Optional)</Label>
              <Input
                value={shippingNotes}
                onChange={(e) => setShippingNotes(e.target.value)}
                placeholder="e.g. Packed in reinforced garment polybag"
                className="mt-1.5 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShippingModalOrder(null)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={shippingSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1.5"
              >
                {shippingSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Truck className="w-3.5 h-3.5" />
                )}
                Mark Shipped
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full Order Details Inspection Modal */}
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
                  Production Order & Customer Shipping Manifest
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Inspect printing specifications, delivery destination address, and update workflow status.
                </DialogDescription>
              </DialogHeader>

              {/* Customer & Delivery Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Client / Buyer Info */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Customer Information</span>
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    {viewingOrder.customer_name || viewingOrder.designer?.name || viewingOrder.designer_name || "Direct Customer"}
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {(viewingOrder.customer_email || viewingOrder.designer_email) && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{viewingOrder.customer_email || viewingOrder.designer_email}</span>
                      </div>
                    )}
                    {viewingOrder.customer_phone && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{viewingOrder.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipping Destination */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Shipping Destination</span>
                  </div>
                  {viewingOrder.shipping_address ? (
                    <div className="text-xs text-slate-700 leading-relaxed">
                      <div className="font-semibold text-slate-900">
                        {viewingOrder.shipping_address.street || viewingOrder.shipping_address.address}
                      </div>
                      <div>
                        {[
                          viewingOrder.shipping_address.city,
                          viewingOrder.shipping_address.state,
                          viewingOrder.shipping_address.postal_code || viewingOrder.shipping_address.pincode || viewingOrder.shipping_address.zip
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      <div>{viewingOrder.shipping_address.country || "India"}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No physical delivery address recorded</div>
                  )}
                </div>
              </div>

              {/* Courier Tracking Box if shipped */}
              {viewingOrder.tracking_info && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <span>Shipment Dispatched with {viewingOrder.tracking_info.courier}</span>
                    </div>
                    <div className="text-sm font-mono font-bold text-slate-900">
                      Tracking / AWB: {viewingOrder.tracking_info.tracking_number}
                    </div>
                    {viewingOrder.tracking_info.notes && (
                      <div className="text-xs text-slate-600 italic">
                        Notes: {viewingOrder.tracking_info.notes}
                      </div>
                    )}
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
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Garments to Print & Fulfill ({viewingOrder.items?.length || 0})
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {viewingOrder.items?.map((it, idx) => (
                    <div key={idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        {(it.preview_url || it.custom_mockup_url) ? (
                          <a
                            href={it.preview_url || it.custom_mockup_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block"
                            title="Click to view full size design"
                          >
                            <img
                              src={it.preview_url || it.custom_mockup_url}
                              alt="Garment Preview"
                              className="w-16 h-16 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1 group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                if (!e.target.src.includes('/templates/tshirt.png')) {
                                  e.target.src = '/templates/tshirt.png';
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                              Zoom
                            </div>
                          </a>
                        ) : (
                          <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm text-slate-900">
                            {it.product_title || it.product || "Custom Apparel"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
                            <span className="font-bold text-slate-900">Qty: {it.quantity} pcs</span>
                            <span>•</span>
                            <span className="font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                              Size: {it.size_label || it.size || it.garment_size || "M"}
                            </span>
                            {it.color_hex && it.color_name && it.color_name !== "Standard" && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 font-semibold">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                    style={{ backgroundColor: it.color_hex }}
                                  />
                                  <span>Color: {it.color_name}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right sm:self-center">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          ₹{(it.line_total_cents ? it.line_total_cents / 100 : (it.total_price_cents ? it.total_price_cents / 100 : (it.line_total || (it.unit_price || 0) * (it.quantity || 1)))).toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ₹{(it.unit_price_cents ? it.unit_price_cents / 100 : (it.unit_price || 0)).toFixed(2)} / pc
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payout & Financial Breakdown */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-700">Payment Channel:</span>{" "}
                  <span className="uppercase font-semibold text-indigo-700">
                    {viewingOrder.payment_method || "Online"}
                  </span>{" "}
                  • Status:{" "}
                  <span className="font-bold text-emerald-700 capitalize">
                    {viewingOrder.payment_status || "Paid"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-700">Provider Payout:</span>{" "}
                  <span className="text-base font-black text-slate-900 font-mono">
                    ₹{(viewingOrder.provider_earnings_cents ? viewingOrder.provider_earnings_cents / 100 : Number(viewingOrder.total || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons in Modal Footer */}
              <DialogFooter className="gap-2 sm:justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setViewingOrder(null)}
                  className="rounded-xl text-xs"
                >
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  {(viewingOrder.status === "confirmed" || viewingOrder.status === "paid") && (
                    <Button
                      disabled={updatingId === viewingOrder.id}
                      onClick={() => handleUpdateStatus(viewingOrder, "in_printing")}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Start Printing Run</span>
                    </Button>
                  )}

                  {(viewingOrder.status === "in_printing" || viewingOrder.status === "printing" || viewingOrder.status === "processing") && (
                    <Button
                      disabled={updatingId === viewingOrder.id}
                      onClick={() => {
                        setShippingModalOrder(viewingOrder);
                        setTrackingNumber(viewingOrder.tracking_info?.tracking_number || "");
                        setCourierName(viewingOrder.tracking_info?.courier || "Blue Dart");
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Dispatch & Ship Order</span>
                    </Button>
                  )}

                  {viewingOrder.status === "shipped" && (
                    <Button
                      disabled={updatingId === viewingOrder.id}
                      onClick={() => handleUpdateStatus(viewingOrder, "delivered")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Delivered</span>
                    </Button>
                  )}

                  {viewingOrder.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        disabled={updatingId === viewingOrder.id}
                        onClick={() => handleUpdateStatus(viewingOrder, "cancelled")}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Decline
                      </Button>
                      <Button
                        disabled={updatingId === viewingOrder.id}
                        onClick={() => handleUpdateStatus(viewingOrder, "confirmed")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                    </>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
