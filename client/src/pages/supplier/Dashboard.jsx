import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Plus,
  LayoutTemplate,
  Store,
  Copy,
  ExternalLink,
  Package,
  Check,
  ChevronRight,
  Paintbrush,
  ShoppingBag,
  Sparkles,
  Shirt,
  Search,
  RefreshCw,
  Building2,
  Factory,
  SlidersHorizontal,
  ShoppingCart
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { encodeId } from "@/utils/idEncoder";
import { cn } from "@/utils/cn";

export default function SupplierDashboard() {
  const { token, user } = useAuth();
  const CLIENT_ORIGIN =
    typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin.replace(/\/$/, "")
      : "";
  const [, setLocation] = useLocation();

  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [selectedProviderFilter, setSelectedProviderFilter] = useState("all");
  const [cardSides, setCardSides] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Stats
  const [designsCount, setDesignsCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);

  useEffect(() => {
    fetch("/api/public/providers")
      .then((res) => res.json())
      .then((data) => setProviders(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Listen for query params from top search bar
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get("q");
      if (q !== null) setSearchTerm(q);
    } catch {}
  }, []);

  useEffect(() => {
    loadCatalog();
    loadStats();
  }, [token]);

  async function loadCatalog() {
    setLoading(true);
    try {
      const res = await fetch("/api/supplier/catalog", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        setCatalog(await res.json());
      }
    } catch (err) {
      console.error("Failed to load catalog", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    if (!token) return;
    try {
      // Designs count
      const dRes = await fetch("/api/designs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (dRes.ok) {
        const dData = await dRes.json();
        setDesignsCount(Array.isArray(dData) ? dData.length : 0);
      }

      // Orders count
      const oRes = await fetch("/api/supplier/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (oRes.ok) {
        const oData = await oRes.json();
        const oList = Array.isArray(oData) ? oData : oData?.orders || [];
        setOrdersCount(oList.length);
      }
    } catch (e) {
      console.error("Failed to load designer stats", e);
    }
  }

  const normalizeImage = (raw) => {
    if (!raw) return null;
    let img =
      raw?.image ||
      raw?.image_data ||
      raw?.image_url ||
      raw?.image_src ||
      raw?.filename ||
      raw?.file_name ||
      null;
    if (!img && typeof raw === "string") img = raw;
    if (!img) return null;
    img = String(img);
    if (img.startsWith("data:") || img.startsWith("http") || img.startsWith("/")) return img;
    return `/uploads/${img}`;
  };

  const getProductPreview = (p, side = "front") => {
    if (!p) return "/templates/tshirt.png";

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
      frontImg = normalizeImage(frontObj) || (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
      backImg = normalizeImage(backObj) || (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
    } else if (rawDesigns && typeof rawDesigns === "object") {
      frontImg = normalizeImage(rawDesigns.front) || (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
      backImg = normalizeImage(rawDesigns.back) || (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
    }

    if (!frontImg && p.front_image) frontImg = normalizeImage(p.front_image);
    if (!backImg && p.back_image) backImg = normalizeImage(p.back_image);
    if (!frontImg && p.image) frontImg = normalizeImage(p.image);

    const target = side === "back" ? backImg || frontImg : frontImg || backImg;
    return target || "/templates/tshirt.png";
  };

  const copyToClipboard = (p) => {
    const url = `${window.location.origin}/listing/${p.slug || p.id}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(p.id);
    toast({
      title: "Link Copied",
      description: "Garment listing URL has been copied."
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openStore = () => {
    const sid = user && (user.id || user.sub) ? user.id || user.sub : "";
    const url = sid ? `${CLIENT_ORIGIN}/store/${encodeId(sid)}` : `${CLIENT_ORIGIN}/store`;
    window.open(url, "_blank");
  };

  const currentProvider = providers.find((p) => p.id === user?.associated_provider_id);
  const products = catalog?.products || [];

  const menCount = products.filter(
    (p) => (p.category || (p.slug?.includes("women") ? "women" : "men")) === "men"
  ).length;
  const womenCount = products.filter(
    (p) => (p.category || (p.slug?.includes("women") ? "women" : "men")) === "women"
  ).length;

  const filteredProducts = products.filter((p) => {
    const cat = p.category || (p.slug?.includes("women") ? "women" : "men");
    if (selectedCategory !== "all" && cat !== selectedCategory) return false;
    if (selectedProviderFilter !== "all" && String(p.owner_id) !== String(selectedProviderFilter)) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (p.name || "").toLowerCase().includes(term);
      const matchSlug = (p.slug || "").toLowerCase().includes(term);
      return matchName || matchSlug;
    }
    return true;
  });

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 pb-12">
      {/* Executive Metric Cards (4 KPIs matching Print Provider design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Garment Blank Catalog */}
        <Card
          className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 group"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Garment Blanks
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 truncate">
              {products.length}
            </div>
            <p className="text-[11px] text-indigo-600 mt-0.5 font-medium flex items-center gap-1">
              <span>All Print Providers Connected</span>
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Saved Designs Library */}
        <Card
          onClick={() => setLocation(`/supplier/saved-designs/${encodeId(user?.id || user?.sub)}`)}
          className="rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Saved Designs
            </span>
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600 group-hover:scale-105 transition-transform">
              <LayoutTemplate className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{designsCount}</div>
            <p className="text-[11px] text-violet-600 mt-0.5 font-medium flex items-center gap-1">
              <span>Custom mockups saved</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Orders Queue */}
        <Card
          onClick={() => setLocation("/supplier/orders")}
          className="rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              My Orders
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{ordersCount}</div>
            <p className="text-[11px] text-amber-600 mt-0.5 font-medium flex items-center gap-1">
              <span>Fulfillment & production orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Public Merchandising Storefront */}
        <Card
          onClick={openStore}
          className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white hover:border-emerald-400 hover:shadow-md transition-all duration-200 cursor-pointer group"
        >
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Storefront
            </span>
            <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform">
              <ExternalLink className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm font-bold text-emerald-900 mt-1 flex items-center gap-1 group-hover:text-emerald-700">
              Live & Open to Public
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <p className="text-[11px] text-emerald-600/90 mt-1 font-medium">
              Click to launch storefront preview
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Catalog Section: Available Garment Blanks */}
      <div className="space-y-4">
        <Card className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden bg-white">
          {/* Department Navigation Ribbon */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Available Garment Blanks
              </h2>
              <p className="text-xs text-slate-500">
                {currentProvider
                  ? `Select base apparel from ${currentProvider.name} to design and save custom mockups.`
                  : "Base apparel catalog provided by your fulfillment print hub."}
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

              {/* Optional Print Provider Filter */}
              {providers.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs text-xs">
                  <Factory className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <select
                    value={selectedProviderFilter}
                    onChange={(e) => setSelectedProviderFilter(e.target.value)}
                    className="bg-transparent text-slate-700 font-semibold text-xs py-0.5 outline-none cursor-pointer"
                  >
                    <option value="all">All Print Providers ({providers.length})</option>
                    {providers.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </select>
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

              <Button
                variant="outline"
                size="sm"
                onClick={loadCatalog}
                disabled={loading}
                className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Catalog Grid Area */}
          <div className="p-4 sm:p-5">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-64 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
                  />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white max-w-lg mx-auto my-6">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800 mb-1">No Garment Blanks Available</h3>
                <p className="text-xs text-slate-500">
                  {searchTerm
                    ? `No products match your search "${searchTerm}".`
                    : "No published blank apparel items found across print providers."}
                </p>
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
                    frontImg = normalizeImage(frontObj) || (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
                    backImg = normalizeImage(backObj) || (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
                  } else if (rawDesigns && typeof rawDesigns === "object") {
                    frontImg = normalizeImage(rawDesigns.front) || (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
                    backImg = normalizeImage(rawDesigns.back) || (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
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
                      {/* Top Preview Area */}
                      <div>
                        <div className="relative h-28 sm:h-32 flex items-center justify-center bg-slate-50/80 p-2 overflow-hidden border-b border-slate-100">
                          {/* Department Fit Badge */}
                          <div className="absolute top-1.5 left-1.5 z-10">
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
                          </div>

                          {/* Front / Back Switcher */}
                          {frontImg && backImg && (
                            <div className="absolute top-1.5 right-1.5 z-10 flex bg-white/95 backdrop-blur-2xs rounded-full p-0.5 shadow-2xs border border-slate-200 text-[8px] font-medium">
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
                                F
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
                                B
                              </button>
                            </div>
                          )}

                          {/* Mockup Garment Preview Image */}
                          <img
                            src={activeImg || "/templates/tshirt.png"}
                            alt={p.name}
                            onError={(e) => {
                              if (e.currentTarget.dataset.retried) return;
                              e.currentTarget.dataset.retried = "true";
                              const currentSrc = e.currentTarget.src || "";
                              if (currentSrc.includes("/uploads/")) {
                                e.currentTarget.src = currentSrc.replace("/uploads/", "/attached_assets/");
                              } else if (currentSrc.includes("/attached_assets/")) {
                                e.currentTarget.src = currentSrc.replace("/attached_assets/", "/uploads/");
                              } else {
                                e.currentTarget.src = "/templates/tshirt.png";
                              }
                            }}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 filter drop-shadow-xs"
                          />
                        </div>

                        {/* Card Info Area */}
                        <div className="p-2 sm:p-2.5">
                          <h3 className="font-bold text-slate-800 text-xs truncate leading-tight">
                            {p.name}
                          </h3>
                          {p.owner_id && (
                            <div className="text-[9px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                              <Factory className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {providers.find((pr) => pr.id === p.owner_id)?.name || "Print Provider"}
                              </span>
                            </div>
                          )}

                          {/* Pricing Row */}
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-xs font-black text-indigo-700">
                              ₹{Number(p.single_price || p.price || 0).toFixed(2)}
                            </span>
                            {p.bulk_price && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                Bulk: ₹{Number(p.bulk_price).toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Available Sizes Row */}
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            {p.sizes && p.sizes.length ? (
                              p.sizes.slice(0, 4).map((item, idx) => {
                                const sid =
                                  typeof item === "object" && item !== null
                                    ? item.id || item.size_id || item.label
                                    : item;
                                const sizeObj = (catalog?.sizes || []).find(
                                  (s) =>
                                    s.id === Number(sid) ||
                                    String(s.id) === String(sid) ||
                                    s.label?.toLowerCase() === String(sid).toLowerCase()
                                );
                                const label = sizeObj?.label || (typeof sid === "string" ? sid : sid);
                                return (
                                  <span
                                    key={idx}
                                    className="text-[8px] font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200/60 leading-tight"
                                  >
                                    {label}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[8px] text-slate-400 italic">Standard</span>
                            )}
                            {p.sizes && p.sizes.length > 4 && (
                              <span className="text-[8px] font-bold text-slate-400">
                                +{p.sizes.length - 4}
                              </span>
                            )}
                          </div>

                          {/* Available Colors Row */}
                          <div className="mt-1.5 flex items-center -space-x-1">
                            {p.colors && p.colors.length ? (
                              p.colors.slice(0, 5).map((item, idx) => {
                                const cid =
                                  typeof item === "object" && item !== null
                                    ? item.id || item.color_id || item.hex
                                    : item;
                                const c = (catalog?.colors || []).find(
                                  (col) =>
                                    col.id === Number(cid) ||
                                    String(col.id) === String(cid) ||
                                    col.hex === String(cid)
                                );
                                const hex =
                                  c?.hex || (typeof cid === "string" && cid.startsWith("#") ? cid : "#ccc");
                                return (
                                  <div
                                    key={idx}
                                    className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs"
                                    style={{ backgroundColor: hex }}
                                    title={c?.name || hex}
                                  />
                                );
                              })
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs bg-slate-300" />
                            )}
                            {p.colors && p.colors.length > 5 && (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs bg-slate-100 flex items-center justify-center text-[7px] font-bold text-slate-600">
                                +{p.colors.length - 5}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Button */}
                      <div className="p-2 pt-0 border-t border-slate-100 flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => setLocation(`/supplier/product/${encodeId(p.id)}`)}
                          className="flex-1 h-7 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs cursor-pointer"
                        >
                          <Paintbrush className="w-3 h-3 mr-1" />
                          Design
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/supplier/product/${encodeId(p.id)}/order`)}
                          className="h-7 px-2 text-[11px] font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded-lg shadow-2xs cursor-pointer gap-1"
                          title="Order Single Sample or Bulk Wholesale Garments"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          Order B2B
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(p)}
                          className="h-7 w-7 rounded-lg border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 shadow-2xs cursor-pointer"
                          title="Copy Listing URL"
                        >
                          {copiedId === p.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}
