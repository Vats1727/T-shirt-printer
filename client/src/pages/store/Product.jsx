import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import Footer from "@/layouts/Footer";
import { encodeId, decodeId } from "@/utils/idEncoder";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import {
  ShoppingBag,
  ArrowLeft,
  Check,
  ShieldCheck,
  Truck,
  Sparkles,
  RotateCcw,
  Ruler,
  ChevronDown,
  ChevronUp,
  Heart,
  Share2,
  Star,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useCart } from "@/context/CartContext";
export default function StoreProduct() {
  const [, setLocation] = useLocation();
  const { addToCart, setIsCartOpen, cartCount } = useCart();
  const path = window.location.pathname || "";
  const parts = path.split("/").filter(Boolean);
  const slug = (parts.pop() || "").trim();
  const byId = parts.length > 0 && parts[parts.length - 1] === "id";
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewSide, setPreviewSide] = useState("front");
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("specs");
  const [addedToCart, setAddedToCart] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(500);
  const API_BASE = import.meta.env?.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:5000`;
  const qp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const supplierQuery = qp.get("supplier");
  const colorQuery = qp.get("color");

  useEffect(() => {
    fetch(`${API_BASE}/api/settings/financial`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.settings?.free_shipping_threshold) {
          setFreeShippingThreshold(Number(d.settings.free_shipping_threshold));
        }
      })
      .catch(() => { });
  }, [API_BASE]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    (async () => {
      setLoading(true);
      try {
        const resolvedId = byId ? decodeId(slug) : slug;
        const url = byId ? `${API_BASE}/api/listing/id/${encodeURIComponent(resolvedId)}` : `${API_BASE}/api/listing/${encodeURIComponent(slug)}`;
        const res = await fetch(url);
        if (!res.ok) {
          if (supplierQuery && byId) {
            const resolvedSupplier = decodeId(supplierQuery) || supplierQuery;
            const r2 = await fetch(`${API_BASE}/api/store/${encodeURIComponent(resolvedSupplier)}`);
            if (r2.ok) {
              const js2 = await r2.json();
              const found = (js2.listings || []).find((x) => String(x.id) === String(resolvedId));
              if (found) {
                setListing(found);
                setLoading(false);
                return;
              }
            }
          }
          setListing(null);
          setLoading(false);
          return;
        }
        const js = await res.json();
        setListing(js.listing || (js.id ? js : null));
      } catch (e) {
        setListing(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, byId, supplierQuery]);

  // Synchronize initial color and size once listing is loaded (declared BEFORE early returns to follow Rules of Hooks)
  useEffect(() => {
    if (listing?.available_colors?.length > 0) {
      if (colorQuery) {
        const found = listing.available_colors.find(c =>
          (c.hex && c.hex.toLowerCase() === colorQuery.toLowerCase()) ||
          (c.name && c.name.toLowerCase() === colorQuery.toLowerCase()) ||
          (String(c.id) === String(colorQuery))
        );
        if (found) {
          setSelectedColor(found);
        } else {
          setSelectedColor(listing.available_colors[0]);
        }
      } else {
        const initialColor = (listing.design_color
          ? listing.available_colors.find(c => c.hex && c.hex.toLowerCase() === listing.design_color.toLowerCase())
          : null) || listing.available_colors[0];
        setSelectedColor(initialColor);
      }
    }
    if (listing?.available_sizes?.length > 0) {
      const firstLabel = typeof listing.available_sizes[0] === 'object'
        ? listing.available_sizes[0].label
        : listing.available_sizes[0];
      setSelectedSize(firstLabel || "M");
    }
  }, [listing, colorQuery]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <div className="size-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading garment details...</p>
      </div>
      <Footer />
    </div>;
  }
  if (!listing) {
    return <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 max-w-xl mx-auto px-6 py-20 text-center">
        <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <ShoppingBag className="size-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Garment Listing Not Found</h1>
        <p className="text-slate-500 text-sm mb-6">
          The product you are trying to view might have been moved or removed by the designer.
        </p>
        <Button onClick={() => window.history.back()} variant="outline" className="gap-2">
          <ArrowLeft className="size-4" /> Return to Previous Page
        </Button>
      </div>
      <Footer />
    </div>;
  }
  const pg = listing.preview_group;
  const availableColors = listing?.available_colors || [];
  const availableSizes = (listing?.available_sizes && listing.available_sizes.length > 0)
    ? listing.available_sizes
    : [{ id: 1, label: "S" }, { id: 2, label: "M" }, { id: 3, label: "L" }, { id: 4, label: "XL" }];

  // Find color-specific front/back previews from preview_by_color
  const colorPreviews = listing?.preview_by_color || [];
  const matchedColorPreview = selectedColor ? colorPreviews.find((cp) => {
    if (selectedColor.id && cp.id && String(selectedColor.id) === String(cp.id)) return true;
    if (selectedColor.hex && cp.hex && selectedColor.hex.toLowerCase() === cp.hex.toLowerCase()) return true;
    if (selectedColor.name && cp.name && selectedColor.name.toLowerCase() === cp.name.toLowerCase()) return true;
    return false;
  }) : null;

  const defaultFront = pg?.front?.url || (listing.preview_asset_id ? `/api/assets/${listing.preview_asset_id}` : null) || listing.preview_url || "/templates/tshirt.png";
  const defaultBack = pg?.back?.url || null;

  const frontImg = matchedColorPreview?.preview_front || matchedColorPreview?.front || defaultFront;
  const backImg = matchedColorPreview?.preview_back || matchedColorPreview?.back || defaultBack;
  const currentImg = previewSide === "back" && backImg ? backImg : frontImg;
  const hasBothSides = Boolean(frontImg && backImg);
  const priceValue = Number(listing.price || 29.99);
  const formattedPrice = `\u20B9${priceValue.toFixed(2)}`;
  const originalPrice = `\u20B9${(priceValue * 1.25).toFixed(2)}`;
  const resolvedSupplierId = listing.supplier_id || decodeId(supplierQuery);
  const storeUrl = resolvedSupplierId ? `/store/${encodeId(resolvedSupplierId)}` : "/store";

  const handleAddToCart = () => {
    addToCart({
      listing_id: listing.id,
      design_id: listing.design_id,
      product_id: listing.product_id,
      supplier_id: listing.supplier_id,
      title: listing.title,
      price: priceValue,
      quantity,
      size: selectedSize,
      color: selectedColor,
      preview_url: currentImg
    });
    setAddedToCart(true);
    toast({
      title: "Added to Cart!",
      description: `${quantity}x ${listing.title} (${selectedSize}${selectedColor ? ` • ${selectedColor.name || selectedColor.hex}` : ''}) added to your bag.`
    });
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleInstantCheckout = () => {
    addToCart({
      listing_id: listing.id,
      design_id: listing.design_id,
      product_id: listing.product_id,
      supplier_id: listing.supplier_id,
      title: listing.title,
      price: priceValue,
      quantity,
      size: selectedSize,
      color: selectedColor,
      preview_url: currentImg
    });
    setLocation('/checkout');
  };
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied!",
        description: "Product link copied to clipboard."
      });
    }
  };
  return <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
    {
      /* Breadcrumb Bar */
    }
    <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <Link href={storeUrl} className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
            <ArrowLeft className="size-3.5" />
            <span>Back to Store</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium hidden sm:inline">Designer Collection</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-slate-900 font-semibold truncate max-w-[200px]">{listing.title}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 bg-white transition-colors"
            title="Share Product"
          >
            <Share2 className="size-3.5" />
          </button>
          <button
            onClick={() => setIsWishlisted(!isWishlisted)}
            className={`p-1.5 rounded-lg border transition-colors ${isWishlisted ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-600 hover:text-rose-600 bg-white"}`}
            title="Add to Wishlist"
          >
            <Heart className={`size-3.5 ${isWishlisted ? "fill-rose-500" : ""}`} />
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-1.5 px-2.5 rounded-lg border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 bg-white transition-colors flex items-center gap-1.5 cursor-pointer font-bold ml-1"
            title="View Cart"
          >
            <ShoppingBag className="size-3.5 text-indigo-600" />
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="size-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-extrabold ml-0.5">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>

    {
      /* Main Product Showcase Section */
    }
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">

        {
          /* Left Column: Interactive Garment Media Canvas */
        }
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative rounded-3xl border border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-slate-100/60 p-6 sm:p-10 flex items-center justify-center min-h-[440px] sm:min-h-[560px] shadow-sm overflow-hidden group">

            {
              /* Top Floating Badges & View Switcher */
            }
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600/10 border border-indigo-200 text-indigo-700 text-[11px] font-bold tracking-wide uppercase">
                <Sparkles className="size-3" />
                Designer Custom
              </span>

              {hasBothSides && <div className="flex bg-white/95 backdrop-blur-md rounded-xl p-1 border border-slate-200/80 shadow-xs">
                <button
                  type="button"
                  onClick={() => setPreviewSide("front")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${previewSide === "front" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Front View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSide("back")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${previewSide === "back" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Back View
                </button>
              </div>}
            </div>

            {
              /* Top Right Specs Badge */
            }
            <div className="absolute top-4 right-4 z-10">
              <Badge variant="outline" className="bg-white/90 backdrop-blur-md border-slate-200 text-slate-700 text-xs px-2.5 py-1 font-semibold">
                100% Ring-Spun Cotton
              </Badge>
            </div>

            {
              /* Garment Hero Image Display */
            }
            <div className="w-full h-full flex items-center justify-center max-h-[500px]">
              {(!matchedColorPreview && selectedColor?.hex) ? (
                <DesignCanvas
                  side={previewSide}
                  width={480}
                  height={480}
                  slogan={(() => {
                    const vSides = listing.design_version?.sides || [];
                    const sideObj = vSides.find(s => s.name === previewSide);
                    const textLayer = sideObj?.layers?.find(l => l.type === "text");
                    return textLayer?.text || (previewSide === "front" ? listing.slogan : listing.back_slogan) || "";
                  })()}
                  color={(() => {
                    const vSides = listing.design_version?.sides || [];
                    const sideObj = vSides.find(s => s.name === previewSide);
                    const textLayer = sideObj?.layers?.find(l => l.type === "text");
                    return textLayer?.color || listing.color || "#000000";
                  })()}
                  image={(() => {
                    const vSides = listing.design_version?.sides || [];
                    const sideObj = vSides.find(s => s.name === previewSide);
                    const imgLayer = sideObj?.layers?.find(l => l.type === "image");
                    return imgLayer?.image || (previewSide === "front" ? listing.artwork_url : null) || null;
                  })()}
                  template={listing.template || listing.design_version?.template || "tshirt"}
                  templateColor={selectedColor.hex}
                  showTemplate={true}
                />
              ) : (
                <img
                  src={currentImg}
                  alt={listing.title}
                  className="max-h-[480px] w-auto max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-500 ease-out"
                  onError={(e) => {
                    e.currentTarget.src = "/templates/tshirt.png";
                  }}
                />
              )}
            </div>

            {
              /* Subtle Bottom Watermark */
            }
            <div className="absolute bottom-4 right-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              High-Resolution DTG Print
            </div>
          </div>

          {
            /* Thumbnail Angle Selectors */
          }
          {hasBothSides && <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setPreviewSide("front")}
              className={`flex items-center gap-3 p-2 rounded-2xl border transition-all ${previewSide === "front" ? "border-indigo-600 bg-white ring-2 ring-indigo-600/20 shadow-xs" : "border-slate-200 bg-slate-50 hover:bg-white text-slate-600"}`}
            >
              <img src={frontImg} alt="Front Thumbnail" className="size-14 object-contain rounded-lg bg-slate-100/60 p-1" />
              <div className="text-left pr-3">
                <span className="block text-xs font-bold text-slate-900">Front Angle</span>
                <span className="block text-[11px] text-slate-400">Primary Print</span>
              </div>
            </button>

            <button
              onClick={() => setPreviewSide("back")}
              className={`flex items-center gap-3 p-2 rounded-2xl border transition-all ${previewSide === "back" ? "border-indigo-600 bg-white ring-2 ring-indigo-600/20 shadow-xs" : "border-slate-200 bg-slate-50 hover:bg-white text-slate-600"}`}
            >
              <img src={backImg || frontImg} alt="Back Thumbnail" className="size-14 object-contain rounded-lg bg-slate-100/60 p-1" />
              <div className="text-left pr-3">
                <span className="block text-xs font-bold text-slate-900">Back Angle</span>
                <span className="block text-[11px] text-slate-400">Back Print</span>
              </div>
            </button>
          </div>}
        </div>

        {
          /* Right Column: Garment Console & Purchase Panel */
        }
        <div className="lg:col-span-5 flex flex-col gap-6">

          {
            /* Header / Titles */
          }
          <div className="space-y-2.5 pb-5 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-indigo-600">
                <Sparkles className="size-3.5" />
                Exclusive Print Collection
              </span>
              <div className="flex items-center gap-2">
                {listing.designer_name && (
                  <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200 text-[11px] font-bold">
                    Designed by {listing.designer_name}
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  <span>4.9</span>
                  <span className="text-slate-400 font-normal">(42 reviews)</span>
                </div>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {listing.title}
            </h1>

            {listing.description && <p className="text-slate-600 text-sm leading-relaxed pt-1">
              {listing.description}
            </p>}
          </div>

          {
            /* Pricing Section */
          }
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-black text-slate-900">{formattedPrice}</span>
              <span className="ml-2.5 text-sm font-semibold text-slate-400 line-through">{originalPrice}</span>
              <Badge className="ml-2.5 bg-emerald-500 text-white font-extrabold text-[10px] px-2 py-0.5">
                SAVE 20%
              </Badge>
            </div>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-full">
              Free shipping over ₹{freeShippingThreshold}
            </span>
          </div>

          {/* Color Selector */}
          {availableColors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Select Color: <span className="text-indigo-600 font-extrabold">{selectedColor?.name || selectedColor?.hex}</span>
                </span>
                <span className="text-[11px] text-slate-400 font-semibold">{availableColors.length} Available</span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {availableColors.map((c, i) => {
                  const isSelected = selectedColor?.hex?.toLowerCase() === c.hex?.toLowerCase();
                  return (
                    <button
                      key={c.id || c.hex || i}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`group relative size-10 rounded-full transition-all flex items-center justify-center p-0.5 border-2 shadow-xs cursor-pointer ${isSelected
                          ? "border-indigo-600 ring-2 ring-indigo-600/30 scale-110"
                          : "border-slate-200 hover:border-slate-400 hover:scale-105"
                        }`}
                      title={c.name}
                    >
                      <span
                        className="size-full rounded-full border border-black/10 flex items-center justify-center shadow-inner"
                        style={{ backgroundColor: c.hex }}
                      >
                        {isSelected && (
                          <Check
                            className={`size-4 stroke-[3] ${['#ffffff', '#fff', 'white'].includes(c.hex?.toLowerCase())
                                ? "text-slate-900"
                                : "text-white"
                              }`}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Select Size: <span className="text-indigo-600 font-extrabold">{selectedSize}</span>
              </span>
              <button
                onClick={() => setSizeGuideOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-4 cursor-pointer"
              >
                <Ruler className="size-3.5" />
                Size Guide
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {availableSizes.map((s, i) => {
                const label = typeof s === 'object' ? s.label : s;
                const isSelected = selectedSize === label;
                return (
                  <button
                    key={s.id || label || i}
                    type="button"
                    onClick={() => setSelectedSize(label)}
                    className={`min-w-12 h-11 px-3.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${isSelected
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-600/20"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {
            /* Quantity Selector & CTAs */
          }
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-200 bg-white rounded-xl p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="size-9 rounded-lg hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-sm text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="size-9 rounded-lg hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>

              <Button
                onClick={handleAddToCart}
                className={`flex-1 h-12 rounded-xl font-extrabold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${addedToCart ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 active:scale-[0.99]"}`}
              >
                {addedToCart ? <>
                  <Check className="size-4 stroke-[3]" />
                  Added to Cart!
                </> : <>
                  <ShoppingBag className="size-4" />
                  Add to Cart • ₹{(priceValue * quantity).toFixed(2)}
                </>}
              </Button>
            </div>

            <button
              type="button"
              onClick={handleInstantCheckout}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md active:scale-[0.99] cursor-pointer"
            >
              Instant Checkout with 1-Click
            </button>
          </div>

          {
            /* Trust Badges Bar */
          }
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-center">
            <div className="flex flex-col items-center gap-1.5 p-1">
              <Truck className="size-5 text-indigo-600" />
              <span className="text-[11px] font-bold text-slate-900">Fast Dispatch</span>
              <span className="text-[10px] text-slate-400">Printed in 2-3 Days</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-1 border-x border-slate-100">
              <ShieldCheck className="size-5 text-indigo-600" />
              <span className="text-[11px] font-bold text-slate-900">30-Day Guarantee</span>
              <span className="text-[10px] text-slate-400">100% Made to Right</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-1">
              <Sparkles className="size-5 text-indigo-600" />
              <span className="text-[11px] font-bold text-slate-900">Ultra-HD DTG</span>
              <span className="text-[10px] text-slate-400">Non-Fading Inks</span>
            </div>
          </div>

          {
            /* Accordion Tabs for Specs, Care, Shipping */
          }
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden divide-y divide-slate-100">

            {
              /* Tab 1: Specs */
            }
            <div>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "specs" ? "" : "specs")}
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Info className="size-4 text-indigo-600" />
                  Fabric & Garment Specifications
                </span>
                {activeTab === "specs" ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
              </button>
              {activeTab === "specs" && <div className="px-4 pb-4 text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50/50">
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li><strong>Material:</strong> 100% premium ring-spun combed cotton (180 GSM).</li>
                  <li><strong>Construction:</strong> Shoulder-to-shoulder taping with side-seamed unisex fit.</li>
                  <li><strong>Printing Technique:</strong> State-of-the-art Direct-to-Garment (DTG) digital print.</li>
                  <li><strong>Design Key:</strong> {listing.design_key || "Custom designer print"}</li>
                </ul>
              </div>}
            </div>

            {
              /* Tab 2: Care Guide */
            }
            <div>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "care" ? "" : "care")}
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="size-4 text-indigo-600" />
                  Print Care Instructions
                </span>
                {activeTab === "care" ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
              </button>
              {activeTab === "care" && <div className="px-4 pb-4 text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50/50">
                <p>To preserve the vividness of your custom garment print:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Machine wash cold, inside-out, gentle cycle with mild detergent.</li>
                  <li>Tumble dry low, or hang dry for longest life.</li>
                  <li>Cool iron inside-out if necessary; do not iron directly over the print.</li>
                  <li>Do not dry clean or use chlorine bleach.</li>
                </ul>
              </div>}
            </div>

            {
              /* Tab 3: Shipping */
            }
            <div>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "shipping" ? "" : "shipping")}
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Truck className="size-4 text-indigo-600" />
                  Delivery & 30-Day Returns
                </span>
                {activeTab === "shipping" ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
              </button>
              {activeTab === "shipping" && <div className="px-4 pb-4 text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50/50">
                <p>
                  Every order is printed on-demand with extreme precision. We package and dispatch items within <strong>2–3 business days</strong>.
                </p>
                <p>
                  <strong>30-Day Make It Right Guarantee:</strong> If your print has any defect or flaw upon delivery, we will immediately send you a free replacement or issue a full refund.
                </p>
              </div>}
            </div>

          </div>

        </div>

      </div>
    </main>

    {
      /* Sizing Chart Modal */
    }
    <Dialog open={sizeGuideOpen} onOpenChange={setSizeGuideOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Ruler className="size-5 text-indigo-600" />
            Unisex Garment Size Chart
          </DialogTitle>
          <DialogDescription>
            All measurements are in inches. Fits true to standard modern sizing.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-2.5">Size</th>
                  <th className="p-2.5">Chest (Width)</th>
                  <th className="p-2.5">Body Length</th>
                  <th className="p-2.5">Sleeve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">S</td>
                  <td className="p-2.5">36"</td>
                  <td className="p-2.5">28"</td>
                  <td className="p-2.5">8.25"</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">M</td>
                  <td className="p-2.5">40"</td>
                  <td className="p-2.5">29"</td>
                  <td className="p-2.5">8.6"</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">L</td>
                  <td className="p-2.5">44"</td>
                  <td className="p-2.5">30"</td>
                  <td className="p-2.5">9.1"</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">XL</td>
                  <td className="p-2.5">48"</td>
                  <td className="p-2.5">31"</td>
                  <td className="p-2.5">9.6"</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">2XL</td>
                  <td className="p-2.5">52"</td>
                  <td className="p-2.5">32"</td>
                  <td className="p-2.5">10.0"</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 text-center">
            Tip: For an oversized relaxed streetwear fit, choose one size up.
          </p>
        </div>
      </DialogContent>
    </Dialog>

    <Footer />
  </div>;
}
