import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Package,
  Sparkles,
  Info,
  Loader2,
  TrendingDown,
  Building2,
  Send,
  Truck,
  Award,
  Palette,
  Ruler,
  ChevronRight,
  Store
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { decodeId } from "@/utils/idEncoder";

function normalizeGarmentImage(raw) {
  if (!raw) return null;
  let img =
    raw?.image ||
    raw?.image_data ||
    raw?.image_url ||
    raw?.image_src ||
    raw?.filename ||
    raw?.file_name ||
    raw?.back_image ||
    null;
  if (!img && typeof raw === "string") img = raw;
  if (!img) return null;
  img = String(img).trim();
  if (
    img.startsWith("data:") ||
    img.startsWith("http://") ||
    img.startsWith("https://") ||
    img.startsWith("/")
  ) {
    return img;
  }
  return `/attached_assets/${img}`;
}

function getGarmentImages(prod) {
  if (!prod) return { front: null, back: null };

  let frontImg = null;
  let backImg = null;

  const rawDesigns = prod.designs;
  if (Array.isArray(rawDesigns)) {
    const frontObj = rawDesigns.find(
      (d) => d && String(d.side || "").toLowerCase() === "front"
    );
    const backObj = rawDesigns.find(
      (d) => d && String(d.side || "").toLowerCase() === "back"
    );
    frontImg =
      normalizeGarmentImage(frontObj) ||
      (rawDesigns[0] ? normalizeGarmentImage(rawDesigns[0]) : null);
    backImg =
      normalizeGarmentImage(backObj) ||
      (rawDesigns[1] ? normalizeGarmentImage(rawDesigns[1]) : null);
  } else if (rawDesigns && typeof rawDesigns === "object") {
    frontImg =
      normalizeGarmentImage(rawDesigns.front) ||
      normalizeGarmentImage(rawDesigns[0]) ||
      null;
    backImg =
      normalizeGarmentImage(rawDesigns.back) ||
      normalizeGarmentImage(rawDesigns[1]) ||
      null;
  }

  if (!frontImg && prod.front_image) frontImg = normalizeGarmentImage(prod.front_image);
  if (!backImg && prod.back_image) backImg = normalizeGarmentImage(prod.back_image);
  if (!frontImg && prod.image) frontImg = normalizeGarmentImage(prod.image);

  if (!frontImg && prod.designs_list && prod.designs_list[0]) {
    frontImg = normalizeGarmentImage(prod.designs_list[0]);
  }
  if (!backImg && prod.designs_list && prod.designs_list[1]) {
    backImg = normalizeGarmentImage(prod.designs_list[1]);
  }

  return { front: frontImg, back: backImg };
}

export default function SupplierProductPurchase() {
  const [match, params] = useRoute("/supplier/product/:id/order");
  const rawParamId = params?.id;
  const id = rawParamId ? decodeId(rawParamId) : null;
  const [, setLocation] = useLocation();
  const { token, user } = useAuth();

  const [product, setProduct] = useState(null);
  const [catalogMeta, setCatalogMeta] = useState({ sizes: [], colors: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSide, setSelectedSide] = useState("front");

  const [purchaseStatus, setPurchaseStatus] = useState({
    status: "none",
    canSave: false,
    order: null
  });

  const [pricingTier, setPricingTier] = useState("single"); // "single" | "bulk"
  const [quantity, setQuantity] = useState(1);

  const fetchPurchaseStatus = async () => {
    if (!id || user?.role !== "designer") {
      setPurchaseStatus({ status: "approved", canSave: true });
      return;
    }
    try {
      const res = await fetch(`/api/supplier/products/${id}/purchase-status`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        const js = await res.json();
        setPurchaseStatus(js);
      }
    } catch (e) {
      console.error("Failed to fetch purchase status", e);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        let prod = null;

        // 1. Authoritative direct product fetch
        try {
          const pRes = await fetch(`/api/supplier/products/${id}`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          });
          if (pRes.ok) {
            prod = await pRes.json();
          }
        } catch (e) {
          console.warn("Direct product fetch failed, trying catalog fallback", e);
        }

        // 2. Fetch catalog metadata (colors, sizes) & fallback product
        try {
          const res = await fetch("/api/supplier/catalog", {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          });
          if (res.ok) {
            const catalog = await res.json();
            setCatalogMeta({
              sizes: catalog.sizes || [],
              colors: catalog.colors || []
            });
            const catalogProd = catalog.products?.find((p) => Number(p.id) === Number(id));
            if (catalogProd) {
              prod = prod ? { ...catalogProd, ...prod } : catalogProd;
            }
          }
        } catch (e) {}

        setProduct(prod || null);
        await fetchPurchaseStatus();
      } catch (err) {
        console.error("Failed to load product", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      load();
    }
  }, [id, token]);

  const garmentImages = getGarmentImages(product);
  const activeGarmentImage =
    selectedSide === "back" && garmentImages.back
      ? garmentImages.back
      : garmentImages.front || garmentImages.back;

  const singlePrice = Number(product?.single_price || 0);
  const bulkPrice = Number(
    product?.bulk_price && Number(product.bulk_price) > 0
      ? product.bulk_price
      : product?.single_price || 0
  );
  const bulkMin = Math.max(2, Number(product?.bulk_min) || 10);
  const activeUnitPrice = pricingTier === "bulk" && bulkPrice > 0 ? bulkPrice : singlePrice;
  const calculatedTotal = activeUnitPrice * (Number(quantity) || 1);
  const bulkSavingsPerUnit = Math.max(0, singlePrice - bulkPrice);
  const totalSavings = pricingTier === "bulk" ? bulkSavingsPerUnit * (Number(quantity) || 1) : 0;

  const handleSelectTier = (tier) => {
    setPricingTier(tier);
    if (tier === "bulk") {
      setQuantity((prev) => Math.max(bulkMin, Number(prev) || bulkMin));
    } else {
      setQuantity((prev) => (Number(prev) >= bulkMin ? 1 : Math.max(1, Number(prev) || 1)));
    }
  };

  const handlePlaceOrder = async (e) => {
    e?.preventDefault();
    if (!product) return;

    try {
      setSubmitting(true);
      const providerId = product.owner_id || user?.associated_provider_id;
      const isBulk = pricingTier === "bulk";
      const finalQty = isBulk ? Math.max(bulkMin, Number(quantity) || bulkMin) : Math.max(1, Number(quantity) || 1);
      const finalRate = isBulk && bulkPrice > 0 ? bulkPrice : singlePrice;

      const res = await fetch("/api/supplier/orders/purchase-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          productId: product.id,
          productSku: product.slug || product.template || "garment",
          providerId,
          size: null,
          color: null,
          quantity: finalQty,
          unitPrice: finalRate,
          shipping: {
            customer_name: user?.name || "Designer",
            customer_email: user?.email || "",
            shipping_address: null
          }
        })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to submit purchase order");
      }

      toast({
        title: "Order Submitted Successfully",
        description: `Order notice for ${finalQty} pcs at ₹${finalRate.toFixed(2)}/pc (${isBulk ? "Bulk Wholesale" : "Unit Sample"}) sent to your Print Provider.`
      });

      await fetchPurchaseStatus();

      // Return to studio after brief confirmation
      setTimeout(() => {
        setLocation(`/supplier/product/${rawParamId}`);
      }, 1200);
    } catch (err) {
      toast({
        title: "Order Submission Failed",
        description: err.message || "Could not place purchase order",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 flex flex-col items-center justify-center min-h-[500px] gap-4">
        <div className="relative">
          <div className="size-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <Package className="size-5 text-indigo-600 absolute inset-0 m-auto" />
        </div>
        <p className="text-sm font-semibold text-slate-600 animate-pulse">
          Loading garment procurement details...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center space-y-5">
        <div className="size-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Package className="size-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Garment Product Not Found</h2>
          <p className="text-sm text-slate-500 mt-1">
            The blank garment product requested could not be located in your provider's catalog.
          </p>
        </div>
        <Button
          onClick={() => setLocation("/supplier/dashboard")}
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl gap-2 font-medium"
        >
          <ArrowLeft className="size-4" /> Return to Catalog
        </Button>
      </div>
    );
  }

  // Extract garment colors and sizes from catalog metadata if available
  const productSizes = Array.isArray(product.sizes)
    ? product.sizes.map((s) => {
        const sid = typeof s === "object" && s !== null ? s.id || s.label : s;
        const matched = catalogMeta.sizes.find(
          (cs) => cs.id === Number(sid) || String(cs.id) === String(sid)
        );
        return matched?.label || (typeof sid === "string" ? sid : `Size ${sid}`);
      })
    : [];

  const productColors = Array.isArray(product.colors)
    ? product.colors.map((c) => {
        const cid = typeof c === "object" && c !== null ? c.id || c.hex : c;
        const matched = catalogMeta.colors.find(
          (cc) => cc.id === Number(cid) || String(cc.id) === String(cid)
        );
        return {
          name: matched?.name || "Color",
          hex: matched?.hex || (typeof cid === "string" && cid.startsWith("#") ? cid : "#000000")
        };
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Professional Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/supplier/product/${rawParamId}`)}
              className="size-9 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              title="Return to Customizer Studio"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span
                onClick={() => setLocation("/supplier/dashboard")}
                className="hover:text-slate-900 cursor-pointer font-medium transition-colors"
              >
                Catalog
              </span>
              <ChevronRight className="size-3 text-slate-400" />
              <span className="capitalize text-slate-600 font-medium">{product.category || "Apparel"}</span>
              <ChevronRight className="size-3 text-slate-400" />
              <span className="font-semibold text-slate-900 truncate max-w-[180px] sm:max-w-none">
                {product.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {purchaseStatus.status === "approved" ? (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 gap-1.5 shadow-2xs">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Purchased & Unlocked
              </Badge>
            ) : purchaseStatus.status === "pending" ? (
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 gap-1.5 shadow-2xs">
                <Clock className="size-3.5 text-amber-600 animate-spin" />
                Awaiting Approval
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-50 text-slate-700 text-xs font-semibold px-2.5 py-1">
                Blank Procurement
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/supplier/product/${rawParamId}`)}
              className="rounded-xl text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-100 h-9 hidden sm:flex items-center gap-1.5"
            >
              Design Studio
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Status Callout if previously approved */}
        {purchaseStatus.status === "approved" && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900">Garment Order Approved & Active</h4>
                <p className="text-xs text-emerald-800/90 mt-0.5">
                  Your Print Provider approved blank garment stock. You have full permission to customize and save artwork. You can order additional units anytime below.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setLocation(`/supplier/product/${rawParamId}`)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shrink-0 shadow-xs"
            >
              Go to Design Studio
            </Button>
          </div>
        )}

        {/* 2-Column High-End Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Visual Showcase & Garment Specifications */}
          <div className="lg:col-span-7 space-y-6">
            {/* Photorealistic Product Showcase Container */}
            <div className="relative rounded-3xl bg-white border border-slate-200/90 shadow-sm overflow-hidden p-6 sm:p-8">
              {/* Floating Header Badges */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize">
                    {product.category || "Apparel"}
                  </Badge>
                  <span className="text-xs font-medium text-slate-400">
                    SKU: {product.slug || product.template}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="size-3.5" />
                  <span>Print Provider Verified</span>
                </div>
              </div>

              {/* Main Garment Mockup Image Stage */}
              <div className="relative aspect-square max-h-[460px] w-full rounded-2xl bg-radial from-slate-50 via-slate-100/60 to-slate-100/90 flex items-center justify-center p-6 sm:p-10 group overflow-hidden border border-slate-100 shadow-inner">
                {activeGarmentImage ? (
                  <img
                    src={activeGarmentImage}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain filter drop-shadow-md transition-all duration-300 group-hover:scale-105"
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
                  />
                ) : (
                  <DesignCanvas
                    side={selectedSide}
                    template={product.template || "tshirt"}
                    color="#000"
                    showTemplate={true}
                    templateColor="#ffffff"
                    readonly
                    width={280}
                    height={280}
                  />
                )}

                {/* Garment Side Switcher Pill */}
                {garmentImages.front && garmentImages.back && (
                  <div className="absolute bottom-4 inset-x-0 flex justify-center">
                    <div className="inline-flex p-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-md">
                      <button
                        type="button"
                        onClick={() => setSelectedSide("front")}
                        className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
                          selectedSide === "front"
                            ? "bg-slate-900 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        Front View
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSide("back")}
                        className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
                          selectedSide === "back"
                            ? "bg-slate-900 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        Back View
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Garment Title and Spec Sheet Below Image */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {product.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Premium quality blank garment substrate ready for DTG, screen printing, and heat transfer.
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center min-w-[90px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Template</span>
                    <span className="text-xs font-bold text-slate-800 capitalize">{product.template || "Standard"}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center min-w-[90px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fulfillment</span>
                    <span className="text-xs font-bold text-slate-800">Direct PP</span>
                  </div>
                </div>
              </div>

              {/* Available Sizes & Colors Pill Displays */}
              {(productSizes.length > 0 || productColors.length > 0) && (
                <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {productSizes.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Ruler className="size-3.5 text-slate-400" />
                        <span>Available Garment Sizes</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {productSizes.map((sizeLabel, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200/80"
                          >
                            {sizeLabel}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {productColors.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Palette className="size-3.5 text-slate-400" />
                        <span>Fabric Colors</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {productColors.map((c, idx) => (
                          <div
                            key={idx}
                            title={c.name}
                            className="size-6 rounded-full border-2 border-white shadow-xs ring-1 ring-slate-300"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trust Badges */}
              <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50/70">
                  <Award className="size-4 text-indigo-600 mx-auto mb-1" />
                  <span className="text-[11px] font-bold text-slate-800 block">Combed Cotton</span>
                  <span className="text-[10px] text-slate-500">Premium blanks</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50/70">
                  <Truck className="size-4 text-indigo-600 mx-auto mb-1" />
                  <span className="text-[11px] font-bold text-slate-800 block">Quick Dispatch</span>
                  <span className="text-[10px] text-slate-500">Direct provider stock</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50/70">
                  <ShieldCheck className="size-4 text-indigo-600 mx-auto mb-1" />
                  <span className="text-[11px] font-bold text-slate-800 block">Quality Assured</span>
                  <span className="text-[10px] text-slate-500">Inspected garments</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: High-Conversion Purchase Configurator */}
          <div className="lg:col-span-5 sticky top-24 space-y-6">
            <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Select Procurement Pricing</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose between individual sample pricing or wholesale bulk pricing set by your Print Provider.
                </p>
              </div>

              {/* Pricing Tier Selectable Cards */}
              <div className="grid grid-cols-1 gap-3.5">
                {/* Sample / Unit Rate Card */}
                <div
                  onClick={() => handleSelectTier("single")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative ${
                    pricingTier === "single"
                      ? "border-indigo-600 bg-indigo-50/30 ring-3 ring-indigo-500/10 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          pricingTier === "single" ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                        }`}
                      >
                        {pricingTier === "single" && <div className="size-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Sample / Unit Rate</span>
                        <span className="text-[11px] text-slate-500">Ideal for physical prototyping & test runs</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900">₹{singlePrice.toFixed(2)}</div>
                      <span className="text-[10px] text-slate-400 font-semibold block">per piece</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Minimum order: 1 unit</span>
                    <Badge variant="outline" className="text-[10px] bg-white font-semibold text-slate-700 py-0">
                      Standard Tier
                    </Badge>
                  </div>
                </div>

                {/* Bulk Wholesale Rate Card */}
                <div
                  onClick={() => handleSelectTier("bulk")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative ${
                    pricingTier === "bulk"
                      ? "border-emerald-600 bg-emerald-50/30 ring-3 ring-emerald-500/10 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          pricingTier === "bulk" ? "border-emerald-600 bg-emerald-600" : "border-slate-300"
                        }`}
                      >
                        {pricingTier === "bulk" && <div className="size-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 block">Bulk Wholesale Rate</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                            Best Value
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">Discounted batch inventory rates</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-700">₹{bulkPrice.toFixed(2)}</div>
                      <span className="text-[10px] text-emerald-600 font-semibold block">per piece</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-semibold">Min. volume: {bulkMin} units</span>
                    {bulkSavingsPerUnit > 0 && (
                      <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                        Save ₹{bulkSavingsPerUnit.toFixed(2)} / pc
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity Stepper Adjuster */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Order Quantity
                  </label>
                  <span className="text-xs text-slate-400 font-medium">
                    {pricingTier === "bulk" ? `Min. ${bulkMin} units required` : "Min. 1 unit"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const step = pricingTier === "bulk" ? 5 : 1;
                      const min = pricingTier === "bulk" ? bulkMin : 1;
                      setQuantity((prev) => Math.max(min, (Number(prev) || min) - step));
                    }}
                    disabled={pricingTier === "bulk" ? Number(quantity) <= bulkMin : Number(quantity) <= 1}
                    className="size-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center font-bold text-lg text-slate-700 transition-colors shadow-2xs"
                  >
                    -
                  </button>
                  <div className="flex-grow relative">
                    <Input
                      type="number"
                      min={pricingTier === "bulk" ? bulkMin : 1}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setQuantity(isNaN(val) ? "" : val);
                      }}
                      onBlur={() => {
                        const min = pricingTier === "bulk" ? bulkMin : 1;
                        if (!quantity || Number(quantity) < min) {
                          setQuantity(min);
                        }
                      }}
                      className="h-11 text-center font-black text-lg focus-visible:ring-indigo-600 rounded-xl bg-slate-50/70 border-slate-200"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      pieces
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const step = pricingTier === "bulk" ? 5 : 1;
                      const min = pricingTier === "bulk" ? bulkMin : 1;
                      setQuantity((prev) => (Number(prev) || min) + step);
                    }}
                    className="size-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center font-bold text-lg text-slate-700 transition-colors shadow-2xs"
                  >
                    +
                  </button>
                </div>

                {/* Quick Preset Pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-semibold mr-1">Presets:</span>
                  {(pricingTier === "bulk"
                    ? [bulkMin, bulkMin + 25, bulkMin * 2, bulkMin * 5]
                    : [1, 5, 10, 25]
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuantity(preset)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-all ${
                        Number(quantity) === preset
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Cost Breakdown Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Selected Garment:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">{product.name}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Applied Rate:</span>
                  <span className="font-bold text-slate-900">
                    ₹{activeUnitPrice.toFixed(2)} / piece
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Total Quantity:</span>
                  <span className="font-bold text-slate-900">{Number(quantity) || 1} pieces</span>
                </div>

                {pricingTier === "bulk" && totalSavings > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-emerald-700 font-bold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="size-3 text-emerald-600" /> Bulk Volume Savings:
                    </span>
                    <span>-₹{totalSavings.toFixed(2)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Total Order Amount
                    </span>
                    <span className="text-[10px] text-slate-400">Taxes & shipping invoiced by provider</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    ₹{calculatedTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Action Button & Disclaimer */}
              <div className="space-y-3 pt-1">
                <Button
                  disabled={submitting}
                  onClick={handlePlaceOrder}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 gap-2 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {submitting ? "Submitting Order Request..." : `Place Blank Garment Order (₹${calculatedTotal.toFixed(2)})`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
