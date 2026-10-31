import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { encodeId } from "@/utils/idEncoder";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Sparkles,
  Globe,
  Lock,
  IndianRupee,
  TrendingUp,
  ShoppingBag,
  Tag,
  ExternalLink,
  Layers,
  Loader2,
  AlertCircle,
  Copy
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function CreateListing() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [previewSide, setPreviewSide] = useState("front");
  const [visibility, setVisibility] = useState("public");
  const [retailPrice, setRetailPrice] = useState(499);
  const baseCost = 16.5;
  const [saving, setSaving] = useState(false);
  const [createdListing, setCreatedListing] = useState(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const normalizeImage = (img) => {
    if (!img) return null;
    img = String(img);
    if (img.startsWith("data:") || img.startsWith("http") || img.startsWith("/")) return img;
    return `/uploads/${img}`;
  };

  const extractDesignPrice = (d) => {
    if (!d) return null;
    const raw = d.raw || d;
    const meta = d.version?.metadata || raw.version?.metadata || {};
    if (raw.price_cents && Number(raw.price_cents) > 0) return Number(raw.price_cents) / 100;
    if (raw.retail_price && Number(raw.retail_price) > 0) return Number(raw.retail_price);
    if (raw.price && Number(raw.price) > 0) return Number(raw.price);
    if (meta.retail_price && Number(meta.retail_price) > 0) return Number(meta.retail_price);
    if (meta.price && Number(meta.price) > 0) return Number(meta.price);
    if (meta.price_cents && Number(meta.price_cents) > 0) return Number(meta.price_cents) / 100;
    return null;
  };

  const handleSelectDesign = (d) => {
    setSelectedDesign(d);
    const p = extractDesignPrice(d);
    if (p !== null && p > 0) {
      setRetailPrice(p);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        let rawList = [];
        // 1. Fetch from /api/supplier/saved-designs
        try {
          const res = await fetch("/api/supplier/saved-designs", { headers });
          if (res.ok) {
            const js = await res.json();
            rawList = Array.isArray(js) ? js : (js.designs || []);
          }
        } catch (e) {
          console.warn("Could not fetch /api/supplier/saved-designs", e);
        }

        // 2. If empty, fallback to /api/designs
        if (!rawList || rawList.length === 0) {
          try {
            const res2 = await fetch("/api/designs", { headers });
            if (res2.ok) {
              const js2 = await res2.json();
              rawList = Array.isArray(js2) ? js2 : (js2.designs || []);
            }
          } catch (e) {
            console.warn("Could not fetch /api/designs", e);
          }
        }

        const validDesigns = (rawList || []).map((d) => {
          // If already in front/back object format
          if (d.front?.url || d.back?.url || d.any?.url) {
            const fUrl = normalizeImage(d.front?.url);
            const bUrl = normalizeImage(d.back?.url);
            const aUrl = normalizeImage(d.any?.url) || fUrl || bUrl;
            return {
              id: d.id,
              key: d.key || (d.id ? `design-${d.id}` : `design-${Math.random().toString(36).slice(2, 6)}`),
              name: d.product || d.name || `Design #${d.id || d.key}`,
              front: fUrl ? { url: fUrl } : null,
              back: bUrl ? { url: bUrl } : null,
              any: aUrl ? { url: aUrl } : null,
              version: d.version,
              raw: d
            };
          }

          // Format from designs table
          const meta = d.version?.metadata || {};
          const sides = d.version?.sides || [];
          const frontSideObj = sides.find((s) => s.side === "front") || sides[0];
          const backSideObj = sides.find((s) => s.side === "back");

          const rawFront = meta.preview_front || d.image || frontSideObj?.image || frontSideObj?.artwork_url || null;
          const rawBack = meta.preview_back || d.back_image || backSideObj?.image || backSideObj?.artwork_url || null;

          const frontUrl = normalizeImage(rawFront);
          const backUrl = normalizeImage(rawBack);
          const anyUrl = frontUrl || backUrl || "/templates/tshirt.png";

          return {
            id: d.id,
            key: d.key || `design-${d.id}`,
            name: d.product || `Design #${d.id}`,
            front: frontUrl ? { url: frontUrl } : null,
            back: backUrl ? { url: backUrl } : null,
            any: { url: anyUrl },
            version: d.version,
            raw: d
          };
        }).filter((d) => Boolean(d.front?.url || d.back?.url || d.any?.url));

        setDesigns(validDesigns);
        if (validDesigns.length > 0) {
          const params = new URLSearchParams(window.location.search);
          const qDesignId = params.get("designId") || params.get("id");
          let initialDesign = validDesigns[0];
          if (qDesignId) {
            const found = validDesigns.find(d => String(d.id) === String(qDesignId) || d.key === qDesignId || d.key === `design-${qDesignId}`);
            if (found) initialDesign = found;
          }
          if (initialDesign) {
            handleSelectDesign(initialDesign);
          }
        }
      } catch (e) {
        console.error("Failed to load designs:", e);
        setDesigns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const profit = Math.max(0, retailPrice - baseCost);
  const marginPercent = retailPrice > 0 ? Math.round(profit / retailPrice * 100) : 0;

  async function handleCreate(e) {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title Required", description: "Please enter a compelling title for your listing." });
      return;
    }
    if (!selectedDesign) {
      toast({ variant: "destructive", title: "Design Required", description: "Please select one of your saved designs to list." });
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        design_key: selectedDesign.key,
        visibility,
        price: retailPrice
      };
      const res = await fetch("/api/supplier/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || "");
        throw new Error(txt || "Failed to create listing");
      }
      const js = await res.json();
      setCreatedListing(js || null);
      setSuccessDialogOpen(true);
      toast({ title: "\u{1F389} Listing Published!", description: "Your custom apparel is now live in your storefront." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error Creating Listing", description: err?.message || "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  const supplierId = user?.id || user?.sub || "";
  const storeUrl = `${window.location.origin}/store/${encodeId(supplierId)}`;
  const singleListingUrl = createdListing?.slug ? `${window.location.origin}/listing/${encodeURIComponent(createdListing.slug)}` : storeUrl;

  const getPreviewImage = (d, side) => {
    if (!d) return "/templates/tshirt.png";
    if (side === "front") {
      return d.front?.url || d.any?.url || d.back?.url || "/templates/tshirt.png";
    }
    return d.back?.url || d.front?.url || d.any?.url || "/templates/tshirt.png";
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pt-2">
        {/* Row 1 Left: Product Information (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="h-full rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                    <Tag className="size-3.5" />
                    <span>Product Information</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight pt-1">Listing Details</h3>
                  <p className="text-xs text-slate-500">
                    Enter an engaging title and story to attract shoppers on your public storefront.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="space-y-1.5 w-full min-w-0 max-w-full">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Product Title <span className="text-rose-500">*</span>
                    </label>
                    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${title.length > 85 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                      {title.length}/100
                    </span>
                  </div>
                  <div className="relative rounded-xl border border-slate-200/90 focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all bg-slate-50/40">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                      placeholder="e.g. Vintage Oversized Graphic Crewneck"
                      className="border-0 bg-transparent text-base font-medium h-11 focus-visible:ring-0 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Product Description
                    </label>
                    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${description.length > 220 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                      {description.length}/250
                    </span>
                  </div>
                  <div className="relative rounded-xl border border-slate-200/90 focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all bg-slate-50/40">
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={250}
                      rows={3}
                      placeholder="Describe your design inspiration, fabric feel, styling suggestions, or fit advice..."
                      className="border-0 bg-transparent text-sm leading-relaxed focus-visible:ring-0 placeholder:text-slate-400 resize-none p-3"
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100/80 mt-2">
              Tip: Include apparel style, fit, or color highlights to make your item easily searchable.
            </p>
          </div>
        </div>

        {/* Row 1 Right: Your Saved Designs (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="h-full rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/20 shrink-0">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                  <Layers className="size-3.5" />
                  <span>Your Saved Designs</span>
                </div>
                <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 font-bold text-xs px-2.5 py-0.5 shadow-2xs">
                  {designs.length} Active {designs.length === 1 ? "Design" : "Designs"}
                </Badge>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight pt-2">Select Garment Graphic</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick the custom artwork mockup to link with this store listing.
              </p>
            </div>

            <div className="p-4 flex-1 flex flex-col min-h-0">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 flex-1">
                  <Loader2 className="size-7 animate-spin text-indigo-600" />
                  <span className="text-xs font-medium">Loading saved designs...</span>
                </div>
              ) : designs.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3 flex-1 flex flex-col items-center justify-center">
                  <AlertCircle className="size-8 text-amber-500 mx-auto" />
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">No Active Designs Found</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Create and save a custom apparel mockup first before publishing a listing.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setLocation("/supplier/dashboard")}
                    className="bg-indigo-600 text-white rounded-xl"
                  >
                    Go to Designer Studio
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {designs.map((d) => {
                    const isSelected = selectedDesign?.key === d.key;
                    const previewImg = getPreviewImage(d, "front");
                    return (
                      <div
                        key={d.key}
                        onClick={() => handleSelectDesign(d)}
                        className={`group relative rounded-2xl border-2 p-2.5 cursor-pointer transition-all duration-200 bg-white flex flex-col items-center ${
                          isSelected
                            ? "border-indigo-600 ring-4 ring-indigo-500/10 shadow-md bg-indigo-50/20"
                            : "border-slate-200/90 hover:border-indigo-300 hover:shadow-md hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="aspect-square w-full rounded-xl bg-gradient-to-b from-slate-50 to-slate-100/70 flex items-center justify-center p-2.5 overflow-hidden relative">
                          <img
                            src={previewImg}
                            alt={d.name || d.key}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
                          />
                          {isSelected ? (
                            <div className="absolute top-2 right-2 size-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 animate-in zoom-in-75">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="absolute top-2 right-2 size-6 rounded-full border border-slate-300/80 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        <div className="w-full mt-2 flex items-center justify-between px-1">
                          <span className="font-bold text-xs text-slate-800 uppercase tracking-wider truncate max-w-[95px]" title={d.name || d.key}>
                            {d.name || d.key}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                            {d.id ? `DSG-${d.id}` : "MOCK"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 Left: Pricing & Action Bar (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="h-full rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/80">
                    <IndianRupee className="size-3.5" />
                    <span>Pricing Strategy</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight pt-1">Set Retail Selling Price</h3>
                  <p className="text-xs text-slate-500">
                    Specify the customer-facing price listed in your public shop catalog.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Customer Retail Price</span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                      Indian Rupee (₹)
                    </span>
                  </div>
                  <div className="relative rounded-xl border-2 border-slate-200 focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-500/10 bg-white transition-all overflow-hidden">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={retailPrice}
                      onChange={(e) => setRetailPrice(parseFloat(e.target.value) || 0)}
                      className="border-0 bg-transparent pl-10 h-13 text-2xl font-black text-slate-900 focus-visible:ring-0 tracking-tight"
                    />
                  </div>

                  {/* Quick Price Suggestions */}
                  <div className="pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Quick Suggestions
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[499, 699, 899, 999, 1299, 1499].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setRetailPrice(amt)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            retailPrice === amt
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25 scale-105"
                              : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Integrated Action Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/supplier/listings")}
                  className="w-full sm:w-auto h-12 px-6 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition-all"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving || !selectedDesign}
                  className="w-full sm:flex-1 h-12 px-8 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Publishing to Storefront...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="size-4" />
                      <span>Launch to Store</span>
                      <Sparkles className="size-4 ml-1 opacity-80" />
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Instant storefront live sync
                </span>
                <span className="font-medium text-slate-500 truncate max-w-[200px]">
                  {selectedDesign ? `Selected: ${selectedDesign.name || selectedDesign.key}` : "Select a design to publish"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 Right: Live Customer Preview (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="h-full rounded-2xl border border-indigo-100/90 bg-white shadow-lg shadow-indigo-500/5 overflow-hidden flex flex-col justify-between">
            <div className="p-4 pb-3 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white via-indigo-50/20 to-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Live Customer Preview
                </span>
              </div>
              {/* Front / Back Switcher */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setPreviewSide("front")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    previewSide === "front"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSide("back")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    previewSide === "back"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            {selectedDesign ? (
              <div className="p-5 flex-1 flex flex-col items-center justify-between gap-4">
                {/* Garment Staging Mockup View */}
                <div className="relative w-full flex-1 min-h-[200px] max-h-[260px] rounded-2xl bg-gradient-to-b from-slate-50 via-white to-slate-100/60 border border-slate-200/80 shadow-inner flex items-center justify-center p-4 group overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_70%)] pointer-events-none" />
                  <img
                    src={getPreviewImage(selectedDesign, previewSide)}
                    alt="Active design preview"
                    className="max-h-full max-w-full object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-300 relative z-10"
                  />
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-20 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-400"></span>
                    {previewSide} view
                  </div>
                </div>

                {/* Storefront Mini Product Card Preview */}
                <div className="w-full p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    <span>Storefront Preview Card</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Sparkles className="size-3" /> Live Ready
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-extrabold text-slate-900 text-sm break-all [overflow-wrap:anywhere] line-clamp-2 min-w-0" title={title || "Untitled Product"}>
                      {title || "Untitled Product"}
                    </h4>
                    <span className="text-base font-black text-indigo-600 shrink-0">
                      ₹{retailPrice.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 break-all [overflow-wrap:anywhere] line-clamp-2 italic min-w-0">
                    {description || "No description provided yet..."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 flex-1 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                <ShoppingBag className="size-8 text-slate-300" />
                <p className="text-xs font-medium">Select a design graphic above to preview your product mockup.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Launch Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-0 overflow-hidden rounded-3xl border border-slate-200/90 shadow-2xl bg-white">
          {/* Header Banner with celebration gradient */}
          <div className="relative bg-gradient-to-br from-indigo-50/80 via-emerald-50/40 to-white px-6 pt-7 pb-5 text-center border-b border-slate-100">
            <div className="mx-auto size-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-3 ring-4 ring-emerald-50/80">
              <CheckCircle2 className="size-8 stroke-[2.5]" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-200/90 mb-2">
              <Sparkles className="size-3 text-emerald-600" />
              <span>Published to Storefront</span>
            </div>

            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
              Listing Published!
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs sm:text-sm max-w-xs mx-auto pt-1">
              Your custom apparel is now live in your designer storefront and ready for customer orders.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4 w-full min-w-0 max-w-full overflow-hidden">
            {/* Product Summary Card with Mockup Thumbnail */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 hover:border-indigo-200 transition-all w-full min-w-0 max-w-full overflow-hidden">
              <div className="size-16 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-xs p-1">
                <img
                  src={getPreviewImage(selectedDesign, "front")}
                  alt={title || "Product"}
                  className="size-full object-contain"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 break-all [overflow-wrap:anywhere] line-clamp-2 min-w-0" title={title || "Untitled Product"}>
                    {title || "Untitled Product"}
                  </h4>
                  <span className="text-base font-black text-emerald-600 shrink-0 whitespace-nowrap">
                    ₹{retailPrice.toFixed(2)}
                  </span>
                </div>

                {description && (
                  <p className="text-xs text-slate-500 break-all [overflow-wrap:anywhere] line-clamp-2 min-w-0" title={description}>
                    {description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-0.5 rounded-md bg-slate-200/70 font-mono font-medium text-[11px] text-slate-700 shrink-0">
                    {selectedDesign?.key || "design-custom"}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-emerald-700 whitespace-nowrap">
                    +₹{profit.toFixed(2)} Margin ({marginPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Shareable Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-indigo-500" />
                  Direct Customer Link
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Share with buyers</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-600 truncate select-all">
                  {singleListingUrl}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(singleListingUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast({ title: "Copied!", description: "Direct storefront link copied to clipboard." });
                  }}
                  className="shrink-0 h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 text-slate-600" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Structured Action Buttons */}
            <div className="pt-2 space-y-2.5">
              <Button
                onClick={() => {
                  window.open(singleListingUrl, "_blank");
                }}
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 gap-2 text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <ShoppingBag className="size-4" />
                <span>View Live in Storefront</span>
                <ExternalLink className="size-3.5 opacity-80" />
              </Button>

              <div className="grid grid-cols-2 gap-2 w-full min-w-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccessDialogOpen(false);
                    setLocation("/supplier/listings");
                  }}
                  className="h-10 rounded-xl text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  Manage Listings
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccessDialogOpen(false);
                    setLocation("/supplier/dashboard");
                  }}
                  className="h-10 rounded-xl text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  Studio Dashboard
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Store({ className }) {
  return <ShoppingBag className={className} />;
}
