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
  Check,
  ShieldCheck
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

  // Listen for query params from Amazon Top Search Bar
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get("q");
      const cat = sp.get("cat");
      if (q !== null) setSearchTerm(q);
      if (cat !== null) setSelectedCategory(cat);
    } catch {}
  }, [window.location.search]);

  const isBusy = loading || ordersLoading || designersLoading;

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
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

      {/* Executive Metric Cards (4 KPIs, Clean & Non-Duplicative) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Blanks */}
        <Card className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200">
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
        <Card className={cn(
          "rounded-xl border transition-all duration-200 hover:shadow-md",
          pendingOrders.length > 0
            ? "border-amber-300 bg-gradient-to-br from-amber-50/60 to-white"
            : "border-slate-200 bg-white"
        )}>
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Active Production Queue
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
            <p className="text-[11px] text-amber-800 mt-0.5 font-medium flex items-center justify-between">
              <span>{pendingOrders.length > 0 ? "Orders awaiting print" : "Queue clear"}</span>
              <span className="text-slate-400 font-normal">({orders.length} total)</span>
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Affiliated Designers */}
        <Card className="rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md transition-all duration-200">
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
            <p className="text-[11px] text-sky-700 mt-0.5 font-medium">
              Merchandisers & Brands
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Fulfillment Revenue */}
        <Card className="rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200">
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

      {/* Main Storefront Section: Garment Blanks Catalog */}
      <div className="space-y-4">
        <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          {/* Storefront Department Navigation Ribbon */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Garment Blanks Catalog
              </h2>
              <p className="text-xs text-slate-500">
                Base apparel products offered to merchandisers for custom printing.
              </p>
            </div>

            {/* Department Tabs & Search Active Indicator */}
            <div className="flex items-center gap-2 flex-wrap">
              {searchTerm && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold">
                  <span>Search: "{searchTerm}"</span>
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="hover:text-indigo-900 cursor-pointer text-xs"
                    title="Clear search"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    selectedCategory === "all"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All Blanks ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("men")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    selectedCategory === "men"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Men's Fits ({menCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("women")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    selectedCategory === "women"
                      ? "bg-pink-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Women's Fits ({womenCount})
                </button>
              </div>
            </div>
          </div>

          {/* Storefront Product Grid */}
          <CardContent className="p-4">
            {loading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-xs font-semibold">Loading catalog blanks...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Shirt className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">No Garment Blanks Found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchTerm
                      ? "No blanks matched your filter. Try adjusting your query or category."
                      : "Your catalog has no active garment blanks."}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={blocked}
                  onClick={() => setLocation("/admin/clothes")}
                  className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Garment
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                      className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group max-w-[240px]"
                    >
                      {/* Preview Top Area */}
                      <div>
                        <div className="relative h-28 sm:h-32 flex items-center justify-center bg-slate-50/80 p-2 overflow-hidden border-b border-slate-100">
                          {/* Department Badge & Draft Badge */}
                          <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1">
                            <Badge
                              className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.2 uppercase tracking-wider shadow-2xs leading-tight",
                                cat === "women"
                                  ? "bg-pink-100 text-pink-700 border-pink-200"
                                  : "bg-blue-100 text-blue-700 border-blue-200"
                              )}
                            >
                              {cat === "women" ? "Women's Fit" : "Men's Fit"}
                            </Badge>
                            {p.status === "draft" && (
                              <Badge className="text-[8px] font-extrabold px-1.5 py-0.2 uppercase tracking-wider shadow-2xs leading-tight bg-amber-500 text-white border-transparent">
                                Draft
                              </Badge>
                            )}
                          </div>

                          {/* Front / Back Switcher */}
                          {frontImg && backImg && (
                            <div className="absolute top-1.5 right-1.5 z-10 flex bg-white/95 backdrop-blur rounded-full p-0.5 shadow-2xs border border-slate-200 text-[8px] font-medium">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCardSides((prev) => ({ ...prev, [p.id]: "front" }));
                                }}
                                className={cn(
                                  "px-1.5 py-0.2 rounded-full transition-all cursor-pointer leading-tight",
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
                                  "px-1.5 py-0.2 rounded-full transition-all cursor-pointer leading-tight",
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
                              <Shirt className="w-6 h-6 text-slate-300 stroke-1" />
                              <span className="text-[10px]">No preview</span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="p-2.5 pb-1.5">
                          <h3 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-indigo-600 transition-colors">
                            {p.name}
                          </h3>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                            SKU: {p.slug || "custom-cut"}
                          </p>

                          {/* Pricing Callout Box (Compact Side-by-Side) */}
                          <div className="mt-2 p-1.5 bg-slate-50/90 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                            <div>
                              <span className="text-slate-400 block text-[9px] font-medium leading-none mb-0.5">Single</span>
                              <span className="font-extrabold text-slate-900 text-xs leading-none">
                                ₹{formatPrice(p.single_price)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-indigo-500 block text-[9px] font-medium leading-none mb-0.5">Bulk ({p.bulk_min || 50}+)</span>
                              <span className="font-black text-indigo-700 text-xs leading-none">
                                ₹{formatPrice(p.bulk_price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Streamlined Actions Toolbar */}
                      <div className="p-2 pt-1 flex items-center gap-1.5 border-t border-slate-100 bg-white">
                        <Button
                          size="sm"
                          disabled={blocked}
                          onClick={() => setLocation("/admin/clothes?productId=" + encodeId(p.id))}
                          className="flex-1 h-7 rounded-md text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1 shadow-2xs cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit Blank
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          disabled={blocked}
                          onClick={() => setProductToDelete(p.id)}
                          className="h-7 w-7 rounded-md border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                          title="Delete Blank"
                        >
                          <Trash2 className="w-3 h-3" />
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
