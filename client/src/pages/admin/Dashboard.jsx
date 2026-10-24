import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Clock,
  AlertTriangle,
  Users,
  Package,
  ShoppingBag,
  IndianRupee,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Copy,
  Edit3,
  Trash2,
  Layers,
  Shirt,
  Sparkles,
  Factory,
  Store,
  ChevronRight,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { encodeId } from "@/utils/idEncoder";
import { cn } from "@/utils/cn";
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
import { format } from "date-fns";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { token, user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [productToDelete, setProductToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [designersLoading, setDesignersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [cardSides, setCardSides] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const blocked = !!(userData && userData.status && userData.status !== "active");
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);

  useEffect(() => {
    if (userData && userData.status && userData.status !== "active") {
      setShowBlockedDialog(true);
    }
  }, [userData]);

  async function fetchUserStatus() {
    if (!user?.id && !user?.sub) return;
    try {
      const res = await fetch(`/api/admin/profile`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        const me = await res.json();
        if (me) setUserData(me);
      }
    } catch (e) {
      console.error("fetchUserStatus error", e);
    }
  }

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrders() {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        const js = await res.json();
        const orderList = Array.isArray(js) ? js : (Array.isArray(js?.orders) ? js.orders : []);
        setOrders(orderList);
      }
    } catch (e) {
      console.error("fetchOrders error", e);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function fetchDesigners() {
    setDesignersLoading(true);
    try {
      const res = await fetch("/api/admin/designers", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        const js = await res.json();
        const desList = Array.isArray(js) ? js : (Array.isArray(js?.designers) ? js.designers : []);
        setDesigners(desList);
      }
    } catch (e) {
      console.error("fetchDesigners error", e);
    } finally {
      setDesignersLoading(false);
    }
  }

  function refreshAll() {
    fetchProducts();
    fetchOrders();
    fetchDesigners();
    fetchUserStatus();
  }

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchDesigners();
    fetchUserStatus();
  }, [token]);

  async function executeDeleteProduct(id) {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        toast({
          title: "Delete Failed",
          description: js.message || "Failed to delete product",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Product Deleted",
          description: "Garment blank removed from your catalog."
        });
        fetchProducts();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Failed to delete",
        variant: "destructive"
      });
    } finally {
      setProductToDelete(null);
    }
  }

  const copyProductLink = (p) => {
    const url = `${window.location.origin}/listing/${p.slug || p.id}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(p.id);
    toast({
      title: "Link Copied",
      description: "Product URL copied to your clipboard."
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics computation
  const menCount = products.filter(
    (p) => (p.category || (p.slug?.includes("women") ? "women" : "men")) === "men"
  ).length;
  const womenCount = products.filter(
    (p) => (p.category || (p.slug?.includes("women") ? "women" : "men")) === "women"
  ).length;

  const pendingOrders = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return !s || ["pending", "placed", "processing", "in_production"].includes(s);
  });

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Filter products by category and search term
  const filteredProducts = products.filter((p) => {
    const cat = p.category || (p.slug?.includes("women") ? "women" : "men");
    if (selectedCategory !== "all" && cat !== selectedCategory) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (p.name || "").toLowerCase().includes(term);
      const matchSlug = (p.slug || "").toLowerCase().includes(term);
      return matchName || matchSlug;
    }
    return true;
  });

  const formatPrice = (v) => {
    const n = Number(v);
    return isNaN(n) ? "0.00" : n.toFixed(2);
  };

  const normalizeImage = (raw) => {
    if (!raw) return null;
    let img =
      raw.image ||
      raw.image_data ||
      raw.file_name ||
      raw.filename ||
      raw.image_url ||
      raw.image_src ||
      raw.back_image ||
      null;
    if (!img && typeof raw === "string") img = raw;
    if (!img) return null;
    img = String(img);
    if (!img.startsWith("data:") && !img.startsWith("http") && !img.startsWith("/")) {
      img = `/uploads/${img}`;
    }
    return img;
  };

  const isBusy = loading || ordersLoading || designersLoading;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Production Facility Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Print Provider Production Hub
              </h1>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] font-bold">
                {user?.name || "Facility Console"}
              </Badge>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Manage your garment catalog, monitor production orders, and govern connected designers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Fulfillment Active
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isBusy}
            className="h-9 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            disabled={blocked}
            onClick={() => setLocation("/admin/clothes")}
            className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Garment Blank
          </Button>
        </div>
      </div>

      {/* Account Status Notice (if not active) */}
      {userData?.status === "pending" && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3.5 shadow-xs animate-in slide-in-from-top-2">
          <div className="bg-amber-100 p-2 rounded-lg text-amber-700 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-amber-900 font-bold text-sm">Provider Registration Pending Review</h3>
            <p className="text-amber-800 text-xs mt-0.5">
              Your account is currently being reviewed by portal administrators. Some public production features may be restricted until approval.
            </p>
          </div>
        </div>
      )}

      {userData?.status === "suspended" && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex items-start gap-3.5 shadow-xs animate-in slide-in-from-top-2">
          <div className="bg-rose-100 p-2 rounded-lg text-rose-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-rose-900 font-bold text-sm">Provider Account Restricted</h3>
            <p className="text-rose-800 text-xs mt-0.5">
              Your fulfillment privileges are temporarily suspended. Please reach out to portal administration for resolution.
            </p>
          </div>
        </div>
      )}

      {/* Executive Metric Cards (4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Blanks */}
        <Card
          onClick={() => setSelectedCategory("all")}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Garment Blanks
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Shirt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{products.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium flex items-center gap-1.5">
              <span className="text-blue-600 font-semibold">{menCount} Men's</span>
              <span>·</span>
              <span className="text-pink-600 font-semibold">{womenCount} Women's</span>
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Production Queue */}
        <Card
          onClick={() => setLocation("/admin/orders")}
          className={cn(
            "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md",
            pendingOrders.length > 0
              ? "border-amber-300 bg-gradient-to-br from-amber-50/70 to-white hover:border-amber-400"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Production Queue
            </span>
            <div className={cn(
              "p-2 rounded-lg",
              pendingOrders.length > 0 ? "bg-amber-500 text-white animate-pulse" : "bg-amber-100 text-amber-700"
            )}>
              <ShoppingBag className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{pendingOrders.length}</div>
            <p className="text-[11px] text-amber-700 mt-0.5 font-medium flex items-center justify-between">
              <span>{pendingOrders.length > 0 ? "Orders awaiting print" : "Queue clear"}</span>
              <span className="text-slate-400 font-normal">({orders.length} total)</span>
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Affiliated Designers */}
        <Card
          onClick={() => setLocation("/admin/designers")}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md transition-all duration-200"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
              Connected Designers
            </span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{designers.length}</div>
            <p className="text-[11px] text-sky-700 mt-0.5 font-medium flex items-center gap-1">
              <span>Merchandisers & Brands</span>
              <ArrowRight className="w-3 h-3" />
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Fulfillment Revenue */}
        <Card
          onClick={() => setLocation("/admin/orders")}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Fulfillment Volume
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Across all supplier runs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Split Section: Catalog on Left (8 cols) + Operations Rail on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Garment Blanks Catalog Management (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            {/* Catalog Control Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  Garment Blanks & Cut Catalog
                </h2>
                <p className="text-xs text-slate-500">
                  Base apparel products supplied for print customization.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all",
                    selectedCategory === "all"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All ({products.length})
                </button>
                <button
                  onClick={() => setSelectedCategory("men")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all",
                    selectedCategory === "men"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Men's ({menCount})
                </button>
                <button
                  onClick={() => setSelectedCategory("women")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all",
                    selectedCategory === "women"
                      ? "bg-pink-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Women's ({womenCount})
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter blanks by garment name or slug..."
                  className="pl-9 h-8 text-xs bg-slate-50/60 border-slate-200 rounded-lg"
                />
              </div>
              <span className="text-xs font-medium text-slate-500 shrink-0">
                {filteredProducts.length} {filteredProducts.length === 1 ? "blank" : "blanks"}
              </span>
            </div>

            {/* Products Grid */}
            <CardContent className="p-4">
              {loading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-xs font-medium">Loading catalog blanks...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                    <Shirt className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">No Garment Blanks Found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {searchTerm
                        ? "No products matched your search term. Try adjusting your query."
                        : "You haven't added any garment blanks to your catalog yet."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={blocked}
                    onClick={() => setLocation("/admin/clothes")}
                    className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Blank
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map((p) => {
                    const currentSide = cardSides[p.id] || "front";
                    const cat = p.category || (p.slug?.includes("women") ? "women" : "men");

                    const rawDesigns = p.designs;
                    let frontImg = null;
                    let backImg = null;

                    if (Array.isArray(rawDesigns)) {
                      const frontObj = rawDesigns.find(
                        (d) => d && String(d.side || "").toLowerCase() === "front"
                      );
                      const backObj = rawDesigns.find(
                        (d) => d && String(d.side || "").toLowerCase() === "back"
                      );
                      frontImg =
                        normalizeImage(frontObj) || (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
                      backImg =
                        normalizeImage(backObj) || (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
                    } else if (rawDesigns && typeof rawDesigns === "object") {
                      frontImg =
                        normalizeImage(rawDesigns.front) ||
                        (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
                      backImg =
                        normalizeImage(rawDesigns.back) ||
                        (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
                    }

                    if (!frontImg && p.front_image) frontImg = normalizeImage(p.front_image);
                    if (!backImg && p.back_image) backImg = normalizeImage(p.back_image);
                    if (!frontImg && p.image) frontImg = normalizeImage(p.image);

                    const activeImg = currentSide === "back" && backImg ? backImg : frontImg || backImg;

                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group"
                      >
                        {/* Preview Top Area */}
                        <div>
                          <div className="relative h-44 flex items-center justify-center bg-slate-50/70 p-3 overflow-hidden border-b border-slate-100">
                            {/* Category Badge */}
                            <div className="absolute top-2.5 left-2.5 z-10">
                              <Badge
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider shadow-2xs",
                                  cat === "women"
                                    ? "bg-pink-100 text-pink-700 border-pink-200"
                                    : "bg-blue-100 text-blue-700 border-blue-200"
                                )}
                              >
                                {cat === "women" ? "Women's Fit" : "Men's Fit"}
                              </Badge>
                            </div>

                            {/* Front / Back Switcher */}
                            {frontImg && backImg && (
                              <div className="absolute top-2.5 right-2.5 z-10 flex bg-white/90 backdrop-blur rounded-full p-0.5 shadow-2xs border border-slate-200 text-[10px] font-medium">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCardSides((prev) => ({ ...prev, [p.id]: "front" }));
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full transition-all",
                                    currentSide === "front"
                                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                                      : "text-slate-600 hover:text-slate-900"
                                  )}
                                >
                                  Front
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCardSides((prev) => ({ ...prev, [p.id]: "back" }));
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full transition-all",
                                    currentSide === "back"
                                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                                      : "text-slate-600 hover:text-slate-900"
                                  )}
                                >
                                  Back
                                </button>
                              </div>
                            )}

                            {/* Garment Image */}
                            {activeImg ? (
                              <img
                                src={activeImg}
                                alt={p.name}
                                className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  if (e.currentTarget.dataset.retried) return;
                                  e.currentTarget.dataset.retried = "true";
                                  if (activeImg.startsWith("/uploads/")) {
                                    e.currentTarget.src = activeImg.replace("/uploads/", "/attached_assets/");
                                  } else if (activeImg.startsWith("/attached_assets/")) {
                                    e.currentTarget.src = activeImg.replace("/attached_assets/", "/uploads/");
                                  }
                                }}
                              />
                            ) : (
                              <div className="text-xs text-slate-400 flex flex-col items-center gap-1">
                                <Shirt className="w-8 h-8 text-slate-300 stroke-1" />
                                <span>No preview</span>
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="p-3.5 pb-2">
                            <h3 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">
                              {p.name}
                            </h3>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {p.slug || "custom-cut"}
                            </p>

                            {/* Pricing Tiers Card */}
                            <div className="mt-2.5 p-2 bg-slate-50/80 rounded-lg border border-slate-100 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Single Piece:</span>
                                <span className="font-bold text-slate-800">₹{formatPrice(p.single_price)}</span>
                              </div>
                              <div className="flex items-center justify-between text-indigo-700">
                                <span className="flex items-center gap-1 font-medium">
                                  <span>Bulk Tier:</span>
                                  <span className="text-[10px] text-slate-400">({p.bulk_min || 50}+ pcs)</span>
                                </span>
                                <span className="font-extrabold">₹{formatPrice(p.bulk_price)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="p-3 pt-0 flex items-center gap-1.5 border-t border-slate-100 bg-white">
                          <Button
                            size="sm"
                            disabled={blocked}
                            onClick={() => setLocation("/admin/clothes?productId=" + encodeId(p.id))}
                            className="flex-1 h-8 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1 shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </Button>

                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => copyProductLink(p)}
                            className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                            title="Copy Catalog Link"
                          >
                            {copiedId === p.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>

                          <Button
                            size="icon"
                            variant="outline"
                            disabled={blocked}
                            onClick={() => setProductToDelete(p.id)}
                            className="h-8 w-8 rounded-lg border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                            title="Delete Blank"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Production Queue & Operations Rail (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Recent Orders Queue Card */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Live Production Queue
                  </CardTitle>
                  <p className="text-[11px] text-slate-500">Orders requiring printing & fulfillment</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/admin/orders")}
                className="h-7 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2"
              >
                View Board
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                  <p className="text-xs">Loading queue...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1.5">
                  <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                  <p className="text-xs font-semibold text-slate-600">No Orders in Queue</p>
                  <p className="text-[11px] text-slate-400">
                    Customer orders placed with affiliated designers will stream here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.slice(0, 4).map((o, idx) => {
                    const status = (o.status || "pending").toLowerCase();
                    const isPending = ["pending", "placed", "processing", "in_production"].includes(status);
                    return (
                      <div
                        key={o.id || o.created_at || idx}
                        onClick={() => setLocation("/admin/orders")}
                        className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              Order #{o.id || idx + 101}
                            </span>
                            <Badge
                              className={cn(
                                "text-[10px] font-bold py-0 px-1.5",
                                isPending
                                  ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                              )}
                            >
                              {o.status || "Pending"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {o.supplier?.name || o.supplier?.email || "Direct Merchandiser"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {o.created_at ? format(new Date(o.created_at), "MMM dd, h:mm a") : "Recent"}
                            {" · "}
                            {o.items?.length || 1} {o.items?.length === 1 ? "item" : "items"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-slate-900 text-sm">
                            ₹{formatPrice(o.total)}
                          </span>
                          <span className="block text-[10px] text-indigo-600 font-semibold flex items-center justify-end gap-0.5 mt-0.5">
                            Inspect
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Facility Shortcuts & Tools */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-4 pb-2 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-600" />
                Facility Operations & Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              <button
                disabled={blocked}
                onClick={() => setLocation("/admin/clothes")}
                className="w-full p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Shirt className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Blank Studio & Presets</h4>
                    <p className="text-[11px] text-slate-500">Configure sizing charts & color variants</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                disabled={blocked}
                onClick={() => setLocation("/admin/orders")}
                className="w-full p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Orders Fulfillment Board</h4>
                    <p className="text-[11px] text-slate-500">View print files and mark shipments</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                disabled={blocked}
                onClick={() => setLocation("/admin/designers")}
                className="w-full p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Designers Directory</h4>
                    <p className="text-[11px] text-slate-500">Inspect affiliated brands & designers</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => setLocation("/admin/profile")}
                className="w-full p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                    <Factory className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Facility Profile & Settings</h4>
                    <p className="text-[11px] text-slate-500">Contact information & credentials</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Blocking Dialog for Restricted Accounts */}
      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent className="rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {userData?.status === "pending"
                ? "Registration Pending Review"
                : userData?.status === "suspended"
                ? "Account Access Restricted"
                : "Account Access Restricted"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-slate-600 space-y-2">
            {userData?.status === "pending" && (
              <p>
                Your print provider account is currently under review by our governance administrators. Full catalog publishing will unlock once approved.
              </p>
            )}
            {userData?.status === "suspended" && (
              <p>
                Your account is currently suspended. Please contact the portal administration team for assistance.
              </p>
            )}
            {userData && !["pending", "suspended"].includes(userData.status) && (
              <p>
                Your account status is currently '{userData.status}'. Certain actions are restricted.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setShowBlockedDialog(false)}>
              Close
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 text-white"
              onClick={() => {
                try {
                  window.open("mailto:portaladmin@gmail.com");
                } catch {}
              }}
            >
              Contact Support
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation Alert Dialog */}
      <AlertDialog
        open={productToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Delete Garment Blank
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 mt-1.5">
              Are you sure you want to remove this garment blank from your catalog? Designers will no longer be able to create new merchandise listings with this blank cut.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (productToDelete !== null) executeDeleteProduct(productToDelete);
              }}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
            >
              Delete Blank
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
