import { useEffect, useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Package,
  Sparkles,
  Loader2,
  Building2,
  Send,
  Truck,
  Award,
  Palette,
  Ruler,
  ChevronRight,
  Layers,
  Percent,
  Receipt,
  RotateCcw,
  Plus,
  Minus,
  Check
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

  return { front: frontImg, back: backImg };
}

const DEFAULT_COLORS = [
  { name: "Jet Black", hex: "#111827" },
  { name: "Pure White", hex: "#FFFFFF" },
  { name: "Navy Blue", hex: "#1E3A8A" },
  { name: "Heather Grey", hex: "#9CA3AF" },
  { name: "Crimson Red", hex: "#DC2626" }
];

const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL"];

export default function SupplierProductPurchase() {
  const [, params] = useRoute("/supplier/product/:id/order");
  const rawParamId = params?.id;
  const id = rawParamId ? decodeId(rawParamId) : null;
  const [, setLocation] = useLocation();
  const { token, user } = useAuth();

  const [product, setProduct] = useState(null);
  const [catalogMeta, setCatalogMeta] = useState({ sizes: [], colors: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSide, setSelectedSide] = useState("front");

  // Purchasing Mode: "single" | "bulk"
  const [pricingTier, setPricingTier] = useState("single");

  // Single Sample Mode state (Size-only)
  const [singleSize, setSingleSize] = useState("M");

  // Multi-Size Bulk Quantity state: { [size]: quantity }
  const [sizeQuantities, setSizeQuantities] = useState({});

  // Checkout modal & address state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [shippingAddress, setShippingAddress] = useState({
    name: user?.name || "Designer Studio",
    email: user?.email || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });
  const [designerNotes, setDesignerNotes] = useState("");

  // Load Razorpay SDK script dynamically
  useEffect(() => {
    if (!document.getElementById("razorpay-sdk")) {
      const script = document.createElement("script");
      script.id = "razorpay-sdk";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Fetch Public B2B Financial Governance rules (tiers, shipping, taxes, split)
  const { data: b2bConfig } = useQuery({
    queryKey: ["/api/settings/b2b-financial"],
    queryFn: async () => {
      const res = await fetch("/api/settings/b2b-financial");
      if (!res.ok) return null;
      const js = await res.json();
      return js.settings || null;
    }
  });

  const b2bSettings = b2bConfig || {
    single_platform_fee_percent: 10.00,
    single_provider_margin_percent: 90.00,
    bulk_platform_fee_percent: 8.00,
    bulk_provider_margin_percent: 92.00,
    bulk_min_qty: 2,
    platform_fee_percent: 10.00,
    provider_margin_percent: 90.00,
    standard_shipping_charge: 120.00,
    free_shipping_threshold: 2500.00,
    shipping_enabled: true,
    tax_percent: 5.00,
    gst_enabled: true
  };

  // Fetch product & catalog meta
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        let prod = null;

        try {
          const pRes = await fetch(`/api/supplier/products/${id}`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          });
          if (pRes.ok) prod = await pRes.json();
        } catch (e) {}

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
            if (catalogProd) prod = prod ? { ...catalogProd, ...prod } : catalogProd;
          }
        } catch (e) {}

        setProduct(prod || null);
      } catch (err) {
        console.error("Failed to load product", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id, token]);

  // Extract available sizes
  const availableSizes = useMemo(() => {
    if (!product) return DEFAULT_SIZES;
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      return product.sizes.map((s) => {
        const sid = typeof s === "object" && s !== null ? s.id || s.label : s;
        const matched = catalogMeta.sizes.find(
          (cs) => cs.id === Number(sid) || String(cs.id) === String(sid)
        );
        return matched?.label || (typeof sid === "string" ? sid : `Size ${sid}`);
      });
    }
    return DEFAULT_SIZES;
  }, [product, catalogMeta]);

  // Default size selection
  useEffect(() => {
    if (availableSizes.length > 0 && !availableSizes.includes(singleSize)) {
      setSingleSize(availableSizes[0]);
    }
  }, [availableSizes]);

  // Multi-size Quantity Handlers
  const handleSizeQuantityChange = (size, val) => {
    const qty = Math.max(0, parseInt(val, 10) || 0);
    setSizeQuantities((prev) => ({
      ...prev,
      [size]: qty
    }));
  };

  const handleAddSizeQuantity = (size, addAmount) => {
    setSizeQuantities((prev) => {
      const current = Number(prev[size]) || 0;
      const next = Math.max(0, current + addAmount);
      return { ...prev, [size]: next };
    });
  };

  const handleFillAllSizes = (amount = 10) => {
    const next = {};
    availableSizes.forEach((sz) => {
      next[sz] = amount;
    });
    setSizeQuantities(next);
  };

  const handleClearAllSizes = () => {
    setSizeQuantities({});
  };

  // Pricing rates
  const singlePrice = Number(product?.single_price || 240);
  const bulkPrice = Number(
    product?.bulk_price && Number(product.bulk_price) > 0
      ? product.bulk_price
      : Math.round(singlePrice * 0.9)
  );

  // Garment mockup images
  const garmentImages = useMemo(() => getGarmentImages(product), [product]);
  const productCustomMockup = useMemo(() => {
    return (
      garmentImages.front ||
      garmentImages.back ||
      normalizeGarmentImage(product?.designs?.[0]?.image) ||
      normalizeGarmentImage(product?.image) ||
      "/templates/tshirt.png"
    );
  }, [garmentImages, product]);

  // Aggregate selected items based on active mode (Size-only)
  const selectedOrderItems = useMemo(() => {
    if (!product) return [];
    if (pricingTier === "single") {
      return [
        {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.slug || product.template || "garment",
          color_name: "Standard",
          color_hex: null,
          garment_size: singleSize || availableSizes[0] || "M",
          quantity: 1, // Single sample mode is strictly 1 piece
          unit_price_cents: Math.round(singlePrice * 100),
          custom_mockup_url: productCustomMockup
        }
      ];
    } else {
      const items = [];
      availableSizes.forEach((sz) => {
        const q = Number(sizeQuantities[sz] || 0);
        if (q > 0) {
          items.push({
            product_id: product.id,
            product_name: product.name,
            product_sku: product.slug || product.template || "garment",
            color_name: "Standard",
            color_hex: null,
            garment_size: sz,
            quantity: q,
            unit_price_cents: Math.round(bulkPrice * 100),
            custom_mockup_url: productCustomMockup
          });
        }
      });
      return items;
    }
  }, [pricingTier, singleSize, sizeQuantities, product, singlePrice, bulkPrice, availableSizes, productCustomMockup]);

  // Total Units
  const totalUnits = useMemo(() => {
    return selectedOrderItems.reduce((acc, it) => acc + it.quantity, 0);
  }, [selectedOrderItems]);

  // Live Financial Calculation (Single vs Bulk Wholesale Commission)
  const quote = useMemo(() => {
    const rawSubtotal = selectedOrderItems.reduce(
      (acc, it) => acc + (it.unit_price_cents / 100) * it.quantity,
      0
    );

    const isBulk = totalUnits > 1;
    const tierLabel = isBulk
      ? `Bulk Wholesale (${totalUnits} pcs • Bulk Commission Applied)`
      : `Single Product Sample (1 pc • Single Commission Applied)`;

    const activePlatformFeePercent = isBulk
      ? Number(b2bSettings.bulk_platform_fee_percent ?? 8.00)
      : Number(b2bSettings.single_platform_fee_percent ?? 10.00);

    const activeProviderMarginPercent = isBulk
      ? Number(b2bSettings.bulk_provider_margin_percent ?? 92.00)
      : Number(b2bSettings.single_provider_margin_percent ?? 90.00);

    const netSubtotal = rawSubtotal;

    let shippingFee = 0;
    if (b2bSettings.shipping_enabled && netSubtotal > 0) {
      if (netSubtotal < b2bSettings.free_shipping_threshold) {
        shippingFee = Number(b2bSettings.standard_shipping_charge);
      }
    }

    let gstAmount = 0;
    if (b2bSettings.gst_enabled && b2bSettings.tax_percent > 0) {
      gstAmount = (netSubtotal * Number(b2bSettings.tax_percent)) / 100;
    }

    const platformCommission = (netSubtotal * activePlatformFeePercent) / 100;
    const providerEarnings = Math.max(0, netSubtotal - platformCommission);
    const grandTotal = netSubtotal + shippingFee + gstAmount;

    return {
      rawSubtotal,
      isBulk,
      activePlatformFeePercent,
      activeProviderMarginPercent,
      tierLabel,
      discountPct: 0,
      discountAmount: 0,
      netSubtotal,
      shippingFee,
      isFreeShipping: shippingFee === 0 && netSubtotal > 0,
      gstAmount,
      platformCommission,
      providerEarnings,
      grandTotal
    };
  }, [selectedOrderItems, totalUnits, b2bSettings]);

  // Checkout submission
  const handleProceedToPayment = async () => {
    if (totalUnits <= 0) {
      toast({
        title: "No Items Selected",
        description: "Please specify quantity for at least 1 size.",
        variant: "destructive"
      });
      return;
    }

    if (!shippingAddress.name.trim() || !shippingAddress.phone.trim() || !shippingAddress.address.trim()) {
      toast({
        title: "Incomplete Address",
        description: "Please complete recipient name, phone, and delivery address.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      const providerId = product.owner_id || user?.associated_provider_id;
      if (!providerId) {
        throw new Error("Print facility partner is not linked to this garment");
      }

      // Step A: Initiate B2B Order on backend
      const res = await fetch("/api/b2b-orders/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          providerId,
          items: selectedOrderItems,
          shippingAddress,
          designerNotes,
          paymentMethod: "razorpay"
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to initiate B2B wholesale order");
      }

      const checkoutData = await res.json();
      const b2bOrder = checkoutData.order;
      const rzpOrder = checkoutData.razorpay;

      // Step B: Razorpay Modal Checkout
      const keyId = rzpOrder?.key_id || "rzp_test_SgRf2CKVk35fBy";

      const triggerVerification = async (paymentResponse) => {
        const verifyRes = await fetch("/api/b2b-orders/verify-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({
            orderId: b2bOrder.id,
            razorpay_order_id: paymentResponse.razorpay_order_id || rzpOrder?.id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature
          })
        });

        if (!verifyRes.ok) throw new Error("Payment signature verification failed");
        const verifiedData = await verifyRes.json();
        setCompletedOrder(verifiedData.order || b2bOrder);
        setShowCheckoutModal(false);

        toast({
          title: "Order Placed Successfully!",
          description: `B2B Order ${b2bOrder.order_number} confirmed! Dispatched to your Print Provider.`
        });
      };

      if (window.Razorpay && rzpOrder) {
        const rzp = new window.Razorpay({
          key: keyId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency || "INR",
          name: "Print Portal B2B Wholesale",
          description: `Order ${b2bOrder.order_number} (${totalUnits} pcs)`,
          image: "/templates/tshirt.png",
          order_id: rzpOrder.id,
          prefill: {
            name: shippingAddress.name,
            email: shippingAddress.email,
            contact: shippingAddress.phone
          },
          theme: { color: "#4f46e5" },
          handler: triggerVerification,
          modal: {
            ondismiss: () => {
              setSubmitting(false);
              toast({ title: "Payment Cancelled", description: "You can resume checkout anytime." });
            }
          }
        });
        rzp.open();
      } else {
        // Dev fallback if Razorpay script is blocked or in offline sandbox
        await triggerVerification({
          razorpay_order_id: rzpOrder?.id || `sim_${Date.now()}`,
          razorpay_payment_id: `pay_test_b2b_${Date.now()}`,
          razorpay_signature: "simulated_valid_signature"
        });
      }
    } catch (err) {
      console.error("B2B Checkout Error:", err);
      toast({
        title: "Checkout Failed",
        description: err.message || "Failed to process B2B purchase",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 flex flex-col items-center justify-center min-h-[500px] gap-4">
        <div className="size-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600 animate-pulse">Loading procurement catalog & options...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center space-y-5">
        <Package className="size-10 text-slate-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Garment Product Not Found</h2>
        <Button onClick={() => setLocation("/supplier/dashboard")} className="bg-slate-900 text-white rounded-xl">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const activeGarmentImage =
    selectedSide === "back" && garmentImages.back
      ? garmentImages.back
      : garmentImages.front || garmentImages.back;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/supplier/product/${rawParamId}`)}
            className="size-9 rounded-xl hover:bg-slate-100 text-slate-600"
            title="Return to Studio"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{product.name}</h1>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                B2B Procurement
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct manufacturer ordering with separate B2B commission governance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/supplier/orders")}
            className="h-8 rounded-xl text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            My Orders
          </Button>
          <Button
            size="sm"
            onClick={() => setLocation(`/supplier/product/${rawParamId}`)}
            className="h-8 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
          >
            Design Studio
          </Button>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Visual Showcase & Specifications */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-3">
              <Badge className="bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize">
                {product.category || "Apparel"}
              </Badge>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                <ShieldCheck className="size-3.5" />
                <span>Verified Facility Stock</span>
              </div>
            </div>

            {/* Garment Image */}
            <div className="relative aspect-square max-h-[380px] w-full rounded-2xl bg-radial from-slate-50 to-slate-100/80 flex items-center justify-center p-6 border border-slate-100 shadow-inner overflow-hidden">
              {activeGarmentImage ? (
                <img
                  src={activeGarmentImage}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain filter drop-shadow-md"
                />
              ) : (
                <DesignCanvas
                  side={selectedSide}
                  template={product.template || "tshirt"}
                  color={singleColor?.hex || "#111827"}
                  showTemplate={true}
                  templateColor="#ffffff"
                  readonly
                  width={240}
                  height={240}
                />
              )}

              {garmentImages.front && garmentImages.back && (
                <div className="absolute bottom-3 inset-x-0 flex justify-center">
                  <div className="inline-flex p-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 shadow-md">
                    <button
                      type="button"
                      onClick={() => setSelectedSide("front")}
                      className={`text-xs font-bold px-3.5 py-1 rounded-full transition-all ${
                        selectedSide === "front" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSide("back")}
                      className={`text-xs font-bold px-3.5 py-1 rounded-full transition-all ${
                        selectedSide === "back" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Available Sizes List */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Ruler className="size-3.5 text-indigo-600" />
                <span>Available Garment Sizes ({availableSizes.length}):</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableSizes.map((sz, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200/80 shadow-2xs"
                  >
                    {sz}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Mode & Interactive Color × Size Matrix */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Step 1: Choose Order Type</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select between single piece sample testing or batch bulk wholesale.
              </p>
            </div>

            {/* Mode Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option A: Sample */}
              <div
                onClick={() => setPricingTier("single")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  pricingTier === "single"
                    ? "border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/10 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center ${pricingTier === "single" ? "border-indigo-600 bg-indigo-600" : "border-slate-300"}`}>
                      {pricingTier === "single" && <div className="size-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">Single Sample (1 pc)</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold">1 Pc Testing</Badge>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 font-medium">Sample Unit Rate</span>
                  <span className="text-base font-black text-slate-900">₹{singlePrice.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Single Commission: Admin {b2bSettings.single_platform_fee_percent}% • Provider {b2bSettings.single_provider_margin_percent}%
                </div>
              </div>

              {/* Option B: Bulk Wholesale */}
              <div
                onClick={() => setPricingTier("bulk")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  pricingTier === "bulk"
                    ? "border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/10 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center ${pricingTier === "bulk" ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                      {pricingTier === "bulk" && <div className="size-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">Bulk Wholesale (&gt; 1 pc)</span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold border-none">Bulk Commission</Badge>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 font-medium">Wholesale Rate</span>
                  <span className="text-base font-black text-emerald-700">₹{bulkPrice.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-[10px] text-emerald-600 font-medium">
                  Bulk Commission: Admin {b2bSettings.bulk_platform_fee_percent}% • Provider {b2bSettings.bulk_provider_margin_percent}%
                </div>
              </div>
            </div>

            {/* Mode-Specific Size & Bulk Breakdown */}
            {pricingTier === "single" ? (
              /* Single Sample Selection Mode */
              <div className="space-y-4 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Step 2: Pick Garment Size for Sample
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select your prototyping size. Sample mode is restricted to 1 piece.
                  </p>
                </div>

                {/* Available Size Pills */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">Select Garment Fit Size:</label>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((sz, idx) => {
                      const isSelected = singleSize === sz;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSingleSize(sz)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-indigo-500/20"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sample Quantity (Strictly 1 pc) */}
                <div className="pt-2 border-t border-slate-200/60">
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Sample Quantity (Strictly 1 pc):</label>
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-2 rounded-xl font-bold text-xs bg-indigo-600 text-white border border-indigo-600 shadow-xs flex items-center gap-1.5">
                      <Check className="size-3.5" />
                      <span>1 Unit Sample ({singleSize})</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">Single unit prototyping. For multiple sizes or wholesale quantities, switch to Bulk Wholesale mode.</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Bulk Wholesale Multi-Size Quantity Breakdown */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Step 2: Multi-Size Bulk Quantity Breakdown
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Configure custom quantities per size. Quick presets let you add batches in one click.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleFillAllSizes(5)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      +5 all
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillAllSizes(10)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      +10 all
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillAllSizes(25)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      +25 all
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllSizes}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* 1D Size Distribution Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-4 text-left w-24">Size</th>
                        <th className="py-2.5 px-3 text-center w-28">Wholesale Rate</th>
                        <th className="py-2.5 px-3 text-center">Quick Bulk Presets</th>
                        <th className="py-2.5 px-3 text-center w-36">Quantity</th>
                        <th className="py-2.5 px-4 text-right w-28">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {availableSizes.map((sz, idx) => {
                        const qty = Number(sizeQuantities[sz] || 0);
                        const lineSubtotal = qty * bulkPrice;
                        return (
                          <tr
                            key={idx}
                            className={
                              qty > 0
                                ? "bg-indigo-50/20 hover:bg-indigo-50/30 transition-colors"
                                : "hover:bg-slate-50/50 transition-colors"
                            }
                          >
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center justify-center font-black text-xs px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-2xs">
                                {sz}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                              ₹{bulkPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {[5, 10, 25, 50].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleAddSizeQuantity(sz, preset)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                    title={`Add +${preset} pcs to size ${sz}`}
                                  >
                                    +{preset}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleAddSizeQuantity(sz, -1)}
                                  disabled={qty <= 0}
                                  className="size-6 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold transition-all active:scale-95 cursor-pointer"
                                >
                                  <Minus className="size-3" />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={sizeQuantities[sz] ?? ""}
                                  onChange={(e) => handleSizeQuantityChange(sz, e.target.value)}
                                  className="w-14 h-6 text-center text-xs font-black bg-transparent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddSizeQuantity(sz, 1)}
                                  className="size-6 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                                >
                                  <Plus className="size-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900">
                              ₹{lineSubtotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100/70 border-t-2 border-slate-200 font-bold text-slate-800">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-4 font-black text-[11px] uppercase tracking-wider text-slate-600">
                          Total Multi-Size Units:
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-indigo-700 text-sm">
                          {totalUnits} pcs
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-indigo-700 text-sm">
                          ₹{quote.rawSubtotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Quotation Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Total Units Selected:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">{totalUnits} pieces</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Order Tier Applied:</span>
                <Badge className={quote.isBulk ? "bg-emerald-100 text-emerald-800 border-none font-bold text-[11px]" : "bg-indigo-100 text-indigo-800 border-none font-bold text-[11px]"}>
                  {quote.tierLabel}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Base Subtotal ({totalUnits} &times; ₹{(pricingTier === "single" ? singlePrice : bulkPrice).toFixed(2)}):</span>
                <span className="font-bold font-mono">₹{quote.rawSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Wholesale Delivery Freight:</span>
                <span className={`font-bold font-mono ${quote.isFreeShipping ? "text-emerald-600" : ""}`}>
                  {quote.isFreeShipping ? "FREE" : `₹${quote.shippingFee.toFixed(2)}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-emerald-700">
                <span>GST Tax ({b2bSettings.gst_enabled ? `${b2bSettings.tax_percent}%` : "Disabled"}):</span>
                <span className="font-bold font-mono">+₹{quote.gstAmount.toFixed(2)}</span>
              </div>

              <div className="pt-3 border-t-2 border-slate-200 flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                    Total Payable Amount
                  </span>
                  <span className="text-[10px] text-slate-400">Direct B2B Razorpay settlement</span>
                </div>
                <div className="text-2xl font-black text-indigo-700">
                  ₹{quote.grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Transparent Split Notice */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Provider Payout ({quote.activeProviderMarginPercent}%): ₹{quote.providerEarnings.toFixed(2)}</span>
                <span>Admin Cut ({quote.activePlatformFeePercent}%): ₹{quote.platformCommission.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Trigger Button */}
            <Button
              disabled={submitting || totalUnits <= 0}
              onClick={() => setShowCheckoutModal(true)}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 rounded-2xl gap-2 cursor-pointer transition-all"
            >
              <Send className="size-4" />
              <span>
                {totalUnits <= 0
                  ? "Specify Quantity per Size to Proceed"
                  : `Proceed to Checkout (${totalUnits} pcs • ₹${quote.grandTotal.toFixed(2)})`}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout & Delivery Modal */}
      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Confirm Wholesale Order & Shipping
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provide delivery address for your {totalUnits} pcs order from your Print Provider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Quick Order Capsule */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">{product.name}</span>
                <span className="text-[11px] text-slate-500 block">
                  {totalUnits} units ({pricingTier === "bulk" ? "Bulk Wholesale" : "Sample"})
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
                  Size Breakdown: {selectedOrderItems.map((it) => `${it.garment_size} (${it.quantity} pcs)`).join(" • ")}
                </span>
              </div>
              <span className="text-base font-black text-indigo-700">₹{quote.grandTotal.toFixed(2)}</span>
            </div>

            {/* Address fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Recipient Name *</label>
                <Input
                  value={shippingAddress.name}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                  className="h-8 text-xs rounded-lg"
                  placeholder="Studio or Contact Name"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number *</label>
                <Input
                  value={shippingAddress.phone}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                  className="h-8 text-xs rounded-lg"
                  placeholder="10-digit mobile"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Street Address *</label>
              <Input
                value={shippingAddress.address}
                onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                className="h-8 text-xs rounded-lg"
                placeholder="Studio building, street, landmark"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">City *</label>
                <Input
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  className="h-8 text-xs rounded-lg"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">State *</label>
                <Input
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  className="h-8 text-xs rounded-lg"
                  placeholder="State"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">PIN Code *</label>
                <Input
                  value={shippingAddress.pincode}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, pincode: e.target.value })}
                  className="h-8 text-xs rounded-lg"
                  placeholder="PIN code"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes to Manufacturer (Optional)</label>
              <Input
                value={designerNotes}
                onChange={(e) => setDesignerNotes(e.target.value)}
                className="h-8 text-xs rounded-lg"
                placeholder="E.g., Special packaging or rush shipping instructions"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCheckoutModal(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              disabled={submitting}
              onClick={handleProceedToPayment}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-2"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              <span>{submitting ? "Processing..." : `Pay ₹${quote.grandTotal.toFixed(2)} via Razorpay`}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Success Confirmation Dialog */}
      <Dialog open={!!completedOrder} onOpenChange={() => setCompletedOrder(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-center space-y-4">
          <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-8" />
          </div>

          <div>
            <DialogTitle className="text-lg font-black text-slate-900">
              Wholesale Order Placed Successfully!
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Your Print Provider has received your order and production will begin immediately.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Order Reference:</span>
              <span className="font-mono font-bold text-slate-900">{completedOrder?.order_number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total Quantity:</span>
              <span className="font-bold text-slate-900">{completedOrder?.total_quantity} pieces</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Payment Status:</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">PAID</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Order Status:</span>
              <Badge variant="outline" className="text-[10px] font-bold capitalize">{completedOrder?.status || "confirmed"}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl text-xs font-bold"
              onClick={() => setLocation("/supplier/orders")}
            >
              View My Orders
            </Button>
            <Button
              className="flex-1 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => setLocation(`/supplier/product/${rawParamId}`)}
            >
              Design Studio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
