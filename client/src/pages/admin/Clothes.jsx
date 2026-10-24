import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import {
  Save,
  ArrowLeft,
  ArrowRight,
  Upload,
  CheckCircle,
  CheckCircle2,
  Package,
  Ruler,
  Palette,
  Trash2,
  Sparkles,
  Tag,
  Eye,
  Info,
  Check,
  Percent,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  Shirt,
  RotateCcw,
  Loader2
} from "lucide-react";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import { useToast } from "@/hooks/use-toast";
import { decodeId } from "@/utils/idEncoder";
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

export default function AdminClothes() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#000000");
  const [sizeLabel, setSizeLabel] = useState("");
  const [product, setProduct] = useState("tshirt");
  const [sizeChart, setSizeChart] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productName, setProductName] = useState("");
  const [productSaved, setProductSaved] = useState(false);
  const [category, setCategory] = useState("men");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {}
  });

  const sectionsEnabled = productSaved || productName.trim() !== "";

  const FARMO_PRESETS = [
    {
      category: "men",
      label: "Pullover Hoodie",
      name: "Men's Pullover Fleece Hoodie",
      template: "hoodie",
      frontImage: "/uploads/farmo/front/farmo_men_hoodie_front.png",
      backImage: "/uploads/farmo/back/farmo_men_hoodie_back.png",
      singlePrice: 32,
      bulkMin: 50,
      bulkPrice: 22
    }
  ];

  function applyPreset(preset) {
    setProductName(preset.name);
    setCategory(preset.category);
    setProduct(preset.template);
    setSinglePrice(preset.singlePrice);
    setBulkMin(preset.bulkMin);
    setBulkPrice(preset.bulkPrice);
    setDesigns({
      front: {
        image: preset.frontImage,
        imageScale: 85,
        imageRotation: 0,
        imagePosition: { x: 200, y: 200 },
        slogan: "",
        color: "#000000",
        template: preset.template
      },
      back: {
        image: preset.backImage,
        imageScale: 85,
        imageRotation: 0,
        imagePosition: { x: 200, y: 200 },
        slogan: "",
        color: "#000000",
        template: preset.template
      }
    });
    setFrontFilename(preset.frontImage);
    setBackFilename(preset.backImage);
    setSelectedSizes(sizes.map((s) => s.id));
    setSelectedColors([1, 2, 3, 4, 9]);
    toast({
      title: "Farmo Preset Loaded",
      description: `Loaded blank template: ${preset.name}`
    });
  }

  const [designSide, setDesignSide] = useState("front");
  const [activeTab, setActiveTab] = useState("product");
  const [designs, setDesigns] = useState({
    front: {
      image: null,
      imageScale: 100,
      imageRotation: 0,
      imagePosition: { x: 200, y: 200 },
      slogan: "",
      color: "#000000",
      template: "tshirt"
    },
    back: {
      image: null,
      imageScale: 100,
      imageRotation: 0,
      imagePosition: { x: 200, y: 200 },
      slogan: "",
      color: "#000000",
      template: "tshirt"
    }
  });
  const [frontFilename, setFrontFilename] = useState(null);
  const [backFilename, setBackFilename] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [singlePrice, setSinglePrice] = useState("");
  const [bulkMin, setBulkMin] = useState(100);
  const [bulkPrice, setBulkPrice] = useState("");

  useEffect(() => {
    fetchData();
    loadEditingProduct();
  }, [token, product]);

  async function fetchData() {
    try {
      const c = await fetch("/api/admin/colors", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (c.ok) {
        setColors(await c.json());
      } else {
        throw new Error("Failed to load colors");
      }

      const s = await fetch("/api/admin/sizes", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (s.ok) setSizes(await s.json());
      else throw new Error("Failed to load sizes");

      const sc = await fetch(
        `/api/admin/size-chart?product=${encodeURIComponent(product)}`,
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );
      if (sc.ok) setSizeChart(await sc.json());
      else setSizeChart([]);

      const inv = await fetch("/api/admin/inventory", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (inv.ok) {
        const data = await inv.json();
        setInventory(data.inventory || []);
      } else {
        setInventory([]);
      }
    } catch (err) {
      toast({
        title: "Error Loading Catalog",
        description: err?.message || "Failed to load catalog data.",
        variant: "destructive"
      });
    }
  }

  async function loadEditingProduct() {
    try {
      const params = new URLSearchParams(window.location.search);
      const idStr = params.get("productId");
      if (!idStr) return;
      const id = decodeId(idStr);
      if (!id) return;
      setEditingProductId(id);
      const res = await fetch(`/api/admin/products/${id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) return;
      const p = await res.json();
      setProductName(p.name || "");
      if (p.category) setCategory(p.category);
      setSinglePrice(p.single_price ?? 0);
      setBulkMin(p.bulk_min ?? 100);
      setBulkPrice(p.bulk_price ?? 0);
      setSelectedSizes(p.sizes || []);
      setSelectedColors(p.colors || []);
      setSizeChart(p.sizeChart || []);

      const designsMap = {
        front: {
          image: null,
          imageScale: 100,
          imageRotation: 0,
          imagePosition: { x: 200, y: 200 },
          slogan: "",
          color: "#000000",
          template: "tshirt"
        },
        back: {
          image: null,
          imageScale: 100,
          imageRotation: 0,
          imagePosition: { x: 200, y: 200 },
          slogan: "",
          color: "#000000",
          template: "tshirt"
        }
      };
      const rawDesigns = p.designs;
      if (rawDesigns) {
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
          if (
            !img.startsWith("data:") &&
            !img.startsWith("http") &&
            !img.startsWith("/")
          ) {
            img = `/attached_assets/${img}`;
          }
          return img;
        };

        const mapRow = (row) => ({
          image: normalizeImage(row),
          imageScale: Number(row.image_scale || row.imageScale || 100),
          imageRotation: Number(row.image_rotation || row.imageRotation || 0),
          imagePosition: row.image_position || row.imagePosition || { x: 200, y: 200 },
          slogan: row.slogan || "",
          color: row.color || "#000000",
          template: row.template || "tshirt"
        });

        if (Array.isArray(rawDesigns)) {
          const front = rawDesigns.find((d) => d && d.side === "front");
          const back = rawDesigns.find((d) => d && d.side === "back");
          if (front) designsMap.front = mapRow(front);
          if (back) designsMap.back = mapRow(back);
          if (!front && rawDesigns[0]) designsMap.front = mapRow(rawDesigns[0]);
          if (!back && rawDesigns[1]) designsMap.back = mapRow(rawDesigns[1]);
        } else if (typeof rawDesigns === "object") {
          if (rawDesigns.front) designsMap.front = mapRow(rawDesigns.front);
          if (rawDesigns.back) designsMap.back = mapRow(rawDesigns.back);
        }

        if (designsMap.front.image && designsMap.front.imageScale <= 1.5)
          designsMap.front.imageScale *= 100;
        else if (!designsMap.front.image && designsMap.front.imageScale <= 1.5)
          designsMap.front.imageScale = 100;

        if (designsMap.back.image && designsMap.back.imageScale <= 1.5)
          designsMap.back.imageScale *= 100;
        else if (!designsMap.back.image && designsMap.back.imageScale <= 1.5)
          designsMap.back.imageScale = 100;
      }

      setDesigns(designsMap);
      setFrontFilename(designsMap.front.image ? "front-image" : null);
      setBackFilename(designsMap.back.image ? "back-image" : null);
      setDesignSide("front");
      setProductSaved(true);
    } catch (e) {
      console.error(e);
    }
  }

  function promptDeleteProduct() {
    if (!editingProductId) return;
    setConfirmDialog({
      open: true,
      title: "Delete Product from Catalog",
      description:
        "Are you sure you want to permanently delete this blank garment? Designers will no longer be able to customize or place wholesale orders for this product.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/products/${editingProductId}`, {
            method: "DELETE",
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          });
          if (res.ok) {
            toast({
              title: "Product Deleted",
              description: "Product has been successfully removed from catalog."
            });
            setEditingProductId(null);
            setProductName("");
            setProductSaved(false);
            setSelectedSizes([]);
            setSelectedColors([]);
            setTimeout(() => setLocation("/admin/dashboard"), 800);
          } else {
            toast({
              title: "Delete Failed",
              description: "Could not delete product.",
              variant: "destructive"
            });
          }
        } catch (err) {
          toast({
            title: "Error",
            description: err?.message || "Failed to delete product",
            variant: "destructive"
          });
        }
      }
    });
  }

  async function handleSaveAll(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!productName.trim()) {
      toast({
        title: "Product Name Required",
        description: "Please enter a product name before saving.",
        variant: "destructive"
      });
      setActiveTab("product");
      return;
    }

    setIsSaving(true);
    const sizeChartPayload = sizes
      .map((s) => {
        const chest = document.getElementById(`chest-${s.id}`)?.value || "";
        const length = document.getElementById(`length-${s.id}`)?.value || "";
        const shoulder = document.getElementById(`shoulder-${s.id}`)?.value || "";
        return {
          size_id: s.id,
          chest: chest === "" ? null : Number(chest),
          length: length === "" ? null : Number(length),
          shoulder: shoulder === "" ? null : Number(shoulder)
        };
      })
      .filter(
        (sc) => sc.chest !== null || sc.length !== null || sc.shoulder !== null
      );

    const payload = {
      name: productName,
      category,
      single_price: singlePrice === "" ? 0 : Number(singlePrice),
      bulk_min: bulkMin,
      bulk_price: bulkPrice === "" ? 0 : Number(bulkPrice),
      sizes: selectedSizes,
      colors: selectedColors,
      designs: {
        front: { ...designs.front, imageScale: designs.front.imageScale / 100 },
        back: { ...designs.back, imageScale: designs.back.imageScale / 100 }
      },
      sizeChart: sizeChartPayload
    };

    try {
      let res;
      if (editingProductId) {
        res = await fetch(`/api/admin/products/${editingProductId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/admin/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        toast({
          title: "Failed to Save Product",
          description: js.message || "Error occurred while saving product.",
          variant: "destructive"
        });
      } else {
        const data = await res.json();
        setProductSaved(true);
        setSizeChart(data.sizeChart || data.size_chart || []);
        toast({
          title: editingProductId ? "Product Updated" : "Product Created",
          description: editingProductId
            ? "Your catalog changes have been saved."
            : "New blank garment published to catalog."
        });
        setTimeout(() => {
          setLocation("/admin/dashboard");
        }, 1200);
      }
    } catch (err) {
      toast({
        title: "Save Failed",
        description: err?.message || "Could not complete save operation.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Calculate volume discount percentage if both prices are valid
  const discountPercent =
    Number(singlePrice) > 0 && Number(bulkPrice) > 0 && Number(bulkPrice) < Number(singlePrice)
      ? Math.round(((Number(singlePrice) - Number(bulkPrice)) / Number(singlePrice)) * 100)
      : null;

  const tabList = [
    {
      id: "product",
      label: "Product Info",
      number: "1",
      icon: Package,
      badge: category === "men" ? "Men" : "Women"
    },
    {
      id: "design",
      label: "Artwork & Mockups",
      number: "2",
      icon: Layers,
      badge: designs.front.image && designs.back.image ? "2 Mockups" : designs.front.image || designs.back.image ? "1 Mockup" : null
    },
    {
      id: "sizes",
      label: "Colors & Sizes",
      number: "3",
      icon: Palette,
      badge: selectedSizes.length > 0 ? `${selectedSizes.length} sizes` : null
    },
    {
      id: "pricing",
      label: "Wholesale Pricing",
      number: "4",
      icon: Tag,
      badge: singlePrice ? `₹${singlePrice}` : null
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50/60 to-white pb-16">
      {/* Top Navigation Header */}
      <div className="border-b bg-white/80 backdrop-blur sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLocation("/admin/dashboard")}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs"
              title="Return to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                <span>Print Provider Studio</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">Blank Garment Catalog</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                {editingProductId ? "Edit Blank Garment" : "Create New Blank Garment"}
                {editingProductId ? (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Active Catalog Item
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Draft Configuration
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLocation("/admin/dashboard")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              Cancel & Exit
            </button>
            <button
              id="save-product-btn"
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || (!editingProductId && !productName.trim())}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all ${
                isSaving || (!editingProductId && !productName.trim())
                  ? "opacity-60 cursor-not-allowed"
                  : ""
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingProductId ? "Save Changes" : "Publish to Catalog"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSaveAll}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Multi-Step Configuration Studio */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              {/* Stepper Navigation Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-1.5 overflow-x-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 min-w-[500px] sm:min-w-0">
                  {tabList.map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center justify-between p-3 rounded-xl text-left transition-all relative ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold"
                            : "bg-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs opacity-75 font-medium leading-none mb-1">
                              Step {t.number}
                            </div>
                            <div className="text-sm font-semibold truncate leading-none">
                              {t.label}
                            </div>
                          </div>
                        </div>
                        {t.badge && (
                          <span
                            className={`hidden xl:inline-block ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              isActive
                                ? "bg-white/25 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {t.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TAB 1: PRODUCT INFO */}
              {activeTab === "product" && (
                <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="border-b bg-slate-50/60 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <Package className="h-5 w-5 text-indigo-600" />
                          Garment Specifications & Identity
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-1">
                          Define category classification, product title, template type, and initial pricing.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Category Selection Cards */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Apparel Category
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setCategory("men")}
                          className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                            category === "men"
                              ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              category === "men"
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Shirt className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-900">
                                Men's & Unisex Apparel
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  category === "men"
                                    ? "border-indigo-600 bg-indigo-600"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {category === "men" && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Standard, relaxed, streetwear and heavyweight silhouettes.
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCategory("women")}
                          className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                            category === "women"
                              ? "border-pink-600 bg-pink-50/50 ring-2 ring-pink-500/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              category === "women"
                                ? "bg-pink-600 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Shirt className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-900">
                                Women's Apparel
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  category === "women"
                                    ? "border-pink-600 bg-pink-600"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {category === "women" && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Fitted tees, cropped silhouettes, and specialized women's sizing.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Farmo Quick-Fill Presets */}
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-2xl text-white shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            Farmo Blank Presets Catalog
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Pre-calibrated mockups
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {FARMO_PRESETS.filter((p) => p.category === category).map((preset) => (
                          <div
                            key={preset.name}
                            className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl p-3.5 flex items-center justify-between transition-all"
                          >
                            <div>
                              <div className="font-semibold text-sm text-white flex items-center gap-2">
                                {preset.label}
                                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/20 font-mono">
                                  {preset.template}
                                </span>
                              </div>
                              <div className="text-xs text-slate-300 mt-1">
                                ₹{preset.singlePrice} unit • ₹{preset.bulkPrice} wholesale
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => applyPreset(preset)}
                              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 shrink-0"
                            >
                              <Sparkles className="h-3 w-3" /> Auto-fill
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Product Name */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Product / Silhouette Title <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-xs text-slate-400">
                          Shown to designers in catalog
                        </span>
                      </div>
                      <input
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="e.g. Men's Heavyweight 240 GSM Oversized Tee"
                        className="w-full border border-slate-200 bg-white px-4 py-3 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      />
                    </div>

                    {/* Base Template Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Garment Silhouette Template
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { id: "tshirt", label: "Classic T-Shirt" },
                          { id: "hoodie", label: "Pullover Hoodie" },
                          { id: "longsleeve", label: "Long Sleeve Tee" },
                          { id: "sweatshirt", label: "Crew Sweatshirt" }
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setProduct(t.id);
                              setDesigns((prev) => ({
                                front: { ...prev.front, template: t.id },
                                back: { ...prev.back, template: t.id }
                              }));
                            }}
                            className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition text-center ${
                              product === t.id
                                ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Pricing Summary Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Single Unit Price (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={singlePrice}
                            onChange={(e) =>
                              setSinglePrice(
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                            className="w-full border border-slate-200 pl-8 pr-4 py-2.5 rounded-xl text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Bulk Wholesale Price (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={bulkPrice}
                            onChange={(e) =>
                              setBulkPrice(
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                            className="w-full border border-slate-200 pl-8 pr-4 py-2.5 rounded-xl text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab("design")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-xs transition"
                    >
                      Continue to Mockups <ArrowRight className="h-4 w-4" />
                    </button>
                  </CardFooter>
                </Card>
              )}

              {/* TAB 2: ARTWORK & MOCKUPS */}
              {activeTab === "design" && (
                <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="border-b bg-slate-50/60 p-6">
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="h-5 w-5 text-indigo-600" />
                      Garment Mockup Uploads
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-1">
                      Upload transparent PNG mockups for front and back angles. Designers will place their artwork directly over these canvases.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Front Mockup Card */}
                      <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                            <h4 className="font-bold text-sm text-slate-900">
                              Front View Canvas
                            </h4>
                          </div>
                          {designs.front.image ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Required
                            </span>
                          )}
                        </div>

                        {designs.front.image ? (
                          <div className="space-y-4">
                            <div className="relative aspect-square max-h-48 mx-auto bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                              <img
                                src={designs.front.image}
                                alt="Front Mockup"
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Scale: {designs.front.imageScale}%</span>
                                <button
                                  type="button"
                                  onClick={() => setDesignSide("front")}
                                  className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" /> Preview Live
                                </button>
                              </div>
                              <input
                                type="range"
                                min="20"
                                max="150"
                                value={designs.front.imageScale}
                                onChange={(e) =>
                                  setDesigns((d) => ({
                                    ...d,
                                    front: {
                                      ...d.front,
                                      imageScale: Number(e.target.value)
                                    }
                                  }))
                                }
                                className="w-full accent-indigo-600 cursor-pointer"
                              />
                              <div className="flex items-center gap-2 pt-1">
                                <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition shadow-2xs">
                                  <Upload className="h-3.5 w-3.5" /> Replace
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      setDesignSide("front");
                                      const reader = new FileReader();
                                      reader.onload = async () => {
                                        const dataUrl = reader.result;
                                        const prevUrl = designs.front.image;
                                        if (
                                          prevUrl &&
                                          typeof prevUrl === "string" &&
                                          prevUrl.includes("/uploads/designs/")
                                        ) {
                                          fetch("/api/assets/delete-file", {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                              Authorization: token ? `Bearer ${token}` : ""
                                            },
                                            body: JSON.stringify({ url: prevUrl })
                                          }).catch(() => {});
                                        }
                                        try {
                                          const res = await fetch("/api/assets", {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                              Authorization: token ? `Bearer ${token}` : ""
                                            },
                                            body: JSON.stringify({
                                              dataUrl,
                                              filename: f.name,
                                              metadata: { type: "designs", side: "front" }
                                            })
                                          });
                                          if (res.ok) {
                                            const js = await res.json();
                                            const url =
                                              js?.url || `/attached_assets/${js?.filename}`;
                                            setDesigns((d) => ({
                                              ...d,
                                              front: {
                                                ...d.front,
                                                image: url,
                                                imagePosition: { x: 200, y: 200 }
                                              }
                                            }));
                                            setFrontFilename(f.name);
                                            return;
                                          }
                                        } catch (err) {}
                                        setDesigns((d) => ({
                                          ...d,
                                          front: {
                                            ...d.front,
                                            image: dataUrl,
                                            imagePosition: { x: 200, y: 200 }
                                          }
                                        }));
                                        setFrontFilename(f.name);
                                      };
                                      reader.readAsDataURL(f);
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const fileUrl = designs.front.image;
                                    setDesigns((d) => ({
                                      ...d,
                                      front: { ...d.front, image: null }
                                    }));
                                    setFrontFilename(null);
                                    if (
                                      fileUrl &&
                                      typeof fileUrl === "string" &&
                                      fileUrl.includes("/uploads/designs/")
                                    ) {
                                      try {
                                        await fetch("/api/assets/delete-file", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            Authorization: token ? `Bearer ${token}` : ""
                                          },
                                          body: JSON.stringify({ url: fileUrl })
                                        });
                                      } catch (e) {}
                                    }
                                    toast({
                                      title: "Front Mockup Removed",
                                      description: "Image removed from server."
                                    });
                                  }}
                                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                                  title="Delete front mockup"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition group">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 transition">
                              <Upload className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-bold text-slate-800">
                              Upload Front Mockup
                            </span>
                            <span className="text-xs text-slate-400 mt-1">
                              PNG or JPG with transparent bg
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setDesignSide("front");
                                const reader = new FileReader();
                                reader.onload = async () => {
                                  const dataUrl = reader.result;
                                  try {
                                    const res = await fetch("/api/assets", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: token ? `Bearer ${token}` : ""
                                      },
                                      body: JSON.stringify({
                                        dataUrl,
                                        filename: f.name,
                                        metadata: { type: "designs", side: "front" }
                                      })
                                    });
                                    if (res.ok) {
                                      const js = await res.json();
                                      const url =
                                        js?.url || `/attached_assets/${js?.filename}`;
                                      const img2 = new Image();
                                      img2.onload = () => {
                                        const aspectRatio = img2.height / img2.width;
                                        const fitScale = Math.min(0.9, 0.9 / aspectRatio);
                                        const scalePct = Math.round(fitScale * 100);
                                        setDesigns((d) => ({
                                          ...d,
                                          front: {
                                            ...d.front,
                                            image: url,
                                            imageScale: scalePct,
                                            imagePosition: { x: 200, y: 200 }
                                          }
                                        }));
                                      };
                                      img2.src = url;
                                      setFrontFilename(f.name);
                                      return;
                                    }
                                  } catch (err) {}
                                  setDesigns((d) => ({
                                    ...d,
                                    front: {
                                      ...d.front,
                                      image: dataUrl,
                                      imageScale: 85,
                                      imagePosition: { x: 200, y: 200 }
                                    }
                                  }));
                                  setFrontFilename(f.name);
                                };
                                reader.readAsDataURL(f);
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Back Mockup Card */}
                      <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                            <h4 className="font-bold text-sm text-slate-900">
                              Back View Canvas
                            </h4>
                          </div>
                          {designs.back.image ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Optional
                            </span>
                          )}
                        </div>

                        {designs.back.image ? (
                          <div className="space-y-4">
                            <div className="relative aspect-square max-h-48 mx-auto bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                              <img
                                src={designs.back.image}
                                alt="Back Mockup"
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Scale: {designs.back.imageScale}%</span>
                                <button
                                  type="button"
                                  onClick={() => setDesignSide("back")}
                                  className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" /> Preview Live
                                </button>
                              </div>
                              <input
                                type="range"
                                min="20"
                                max="150"
                                value={designs.back.imageScale}
                                onChange={(e) =>
                                  setDesigns((d) => ({
                                    ...d,
                                    back: {
                                      ...d.back,
                                      imageScale: Number(e.target.value)
                                    }
                                  }))
                                }
                                className="w-full accent-indigo-600 cursor-pointer"
                              />
                              <div className="flex items-center gap-2 pt-1">
                                <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition shadow-2xs">
                                  <Upload className="h-3.5 w-3.5" /> Replace
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      setDesignSide("back");
                                      const reader = new FileReader();
                                      reader.onload = async () => {
                                        const dataUrl = reader.result;
                                        const prevUrl = designs.back.image;
                                        if (
                                          prevUrl &&
                                          typeof prevUrl === "string" &&
                                          prevUrl.includes("/uploads/designs/")
                                        ) {
                                          fetch("/api/assets/delete-file", {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                              Authorization: token ? `Bearer ${token}` : ""
                                            },
                                            body: JSON.stringify({ url: prevUrl })
                                          }).catch(() => {});
                                        }
                                        try {
                                          const res = await fetch("/api/assets", {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                              Authorization: token ? `Bearer ${token}` : ""
                                            },
                                            body: JSON.stringify({
                                              dataUrl,
                                              filename: f.name,
                                              metadata: { type: "designs", side: "back" }
                                            })
                                          });
                                          if (res.ok) {
                                            const js = await res.json();
                                            const url =
                                              js?.url || `/attached_assets/${js?.filename}`;
                                            setDesigns((d) => ({
                                              ...d,
                                              back: {
                                                ...d.back,
                                                image: url,
                                                imagePosition: { x: 200, y: 200 }
                                              }
                                            }));
                                            setBackFilename(f.name);
                                            return;
                                          }
                                        } catch (err) {}
                                        setDesigns((d) => ({
                                          ...d,
                                          back: {
                                            ...d.back,
                                            image: dataUrl,
                                            imagePosition: { x: 200, y: 200 }
                                          }
                                        }));
                                        setBackFilename(f.name);
                                      };
                                      reader.readAsDataURL(f);
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const fileUrl = designs.back.image;
                                    setDesigns((d) => ({
                                      ...d,
                                      back: { ...d.back, image: null }
                                    }));
                                    setBackFilename(null);
                                    if (
                                      fileUrl &&
                                      typeof fileUrl === "string" &&
                                      fileUrl.includes("/uploads/designs/")
                                    ) {
                                      try {
                                        await fetch("/api/assets/delete-file", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            Authorization: token ? `Bearer ${token}` : ""
                                          },
                                          body: JSON.stringify({ url: fileUrl })
                                        });
                                      } catch (e) {}
                                    }
                                    toast({
                                      title: "Back Mockup Removed",
                                      description: "Image removed from server."
                                    });
                                  }}
                                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                                  title="Delete back mockup"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition group">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-slate-200 text-slate-700 flex items-center justify-center mb-3 transition">
                              <Upload className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-bold text-slate-800">
                              Upload Back Mockup
                            </span>
                            <span className="text-xs text-slate-400 mt-1">
                              PNG or JPG with transparent bg
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setDesignSide("back");
                                const reader = new FileReader();
                                reader.onload = async () => {
                                  const dataUrl = reader.result;
                                  try {
                                    const res = await fetch("/api/assets", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: token ? `Bearer ${token}` : ""
                                      },
                                      body: JSON.stringify({
                                        dataUrl,
                                        filename: f.name,
                                        metadata: { type: "designs", side: "back" }
                                      })
                                    });
                                    if (res.ok) {
                                      const js = await res.json();
                                      const url =
                                        js?.url || `/attached_assets/${js?.filename}`;
                                      const img2 = new Image();
                                      img2.onload = () => {
                                        const aspectRatio = img2.height / img2.width;
                                        const fitScale = Math.min(0.9, 0.9 / aspectRatio);
                                        const scalePct = Math.round(fitScale * 100);
                                        setDesigns((d) => ({
                                          ...d,
                                          back: {
                                            ...d.back,
                                            image: url,
                                            imageScale: scalePct,
                                            imagePosition: { x: 200, y: 200 }
                                          }
                                        }));
                                      };
                                      img2.src = url;
                                      setBackFilename(f.name);
                                      return;
                                    }
                                  } catch (err) {}
                                  setDesigns((d) => ({
                                    ...d,
                                    back: {
                                      ...d.back,
                                      image: dataUrl,
                                      imageScale: 85,
                                      imagePosition: { x: 200, y: 200 }
                                    }
                                  }));
                                  setBackFilename(f.name);
                                };
                                reader.readAsDataURL(f);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab("product")}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Info
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("sizes")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-xs transition"
                    >
                      Continue to Colors & Sizes <ArrowRight className="h-4 w-4" />
                    </button>
                  </CardFooter>
                </Card>
              )}

              {/* TAB 3: COLORS & SIZES */}
              {activeTab === "sizes" && (
                <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="border-b bg-slate-50/60 p-6">
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Palette className="h-5 w-5 text-indigo-600" />
                      Variants, Color Swatches & Size Chart
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-1">
                      Choose which standard sizes and fabric colors are offered for this silhouette, and input the garment measurement chart.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    {/* Size Selector */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-indigo-600" />
                            Garment Sizing Options
                          </h4>
                          <span className="text-xs text-slate-500">
                            Select all sizes available in your production inventory.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSizes(sizes.map((s) => s.id))}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSizes([])}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        {sizes.map((s) => {
                          const isSelected = selectedSizes.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedSizes((prev) =>
                                  prev.includes(s.id)
                                    ? prev.filter((x) => x !== s.id)
                                    : [...prev, s.id]
                                );
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-2xs ${
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Color Swatches */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Palette className="h-4 w-4 text-indigo-600" />
                            Print Color Palettes
                          </h4>
                          <span className="text-xs text-slate-500">
                            Available blank garment fabric colors.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedColors(colors.map((c) => c.id))}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedColors([])}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        {colors.map((c) => {
                          const isSelected = selectedColors.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedColors((prev) =>
                                  prev.includes(c.id)
                                    ? prev.filter((x) => x !== c.id)
                                    : [...prev, c.id]
                                );
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 shadow-2xs ${
                                isSelected
                                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-inner"
                                style={{ backgroundColor: c.hex }}
                              />
                              <span>{c.name}</span>
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sizing Measurement Chart Matrix */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <Ruler className="h-4 w-4 text-indigo-600" />
                          Size Chart Matrix ({product.toUpperCase()})
                        </h4>
                        <span className="text-xs text-slate-400">
                          Measurements in inches
                        </span>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                              <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Size
                              </th>
                              <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                                Chest Width (in)
                              </th>
                              <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                                Body Length (in)
                              </th>
                              <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                                Shoulder (in)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sizes.map((s) => {
                              const sc = sizeChart.find((x) => x.size_id === s.id) || {};
                              const isSelected = selectedSizes.includes(s.id);
                              return (
                                <tr
                                  key={s.id}
                                  className={`transition-colors ${
                                    isSelected ? "bg-indigo-50/30" : "bg-slate-50/30 opacity-40"
                                  }`}
                                >
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`w-2 h-2 rounded-full ${
                                          isSelected ? "bg-indigo-600" : "bg-slate-300"
                                        }`}
                                      />
                                      <span
                                        className={`font-bold text-sm ${
                                          isSelected ? "text-slate-900" : "text-slate-400"
                                        }`}
                                      >
                                        {s.label}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      className={`w-full max-w-[110px] mx-auto block border border-slate-200 px-3 py-1.5 rounded-lg text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs ${
                                        !isSelected
                                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                          : "bg-white text-slate-900"
                                      }`}
                                      defaultValue={sc.chest || ""}
                                      id={`chest-${s.id}`}
                                      placeholder="—"
                                      readOnly={!isSelected}
                                    />
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      className={`w-full max-w-[110px] mx-auto block border border-slate-200 px-3 py-1.5 rounded-lg text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs ${
                                        !isSelected
                                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                          : "bg-white text-slate-900"
                                      }`}
                                      defaultValue={sc.length || ""}
                                      id={`length-${s.id}`}
                                      placeholder="—"
                                      readOnly={!isSelected}
                                    />
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      className={`w-full max-w-[110px] mx-auto block border border-slate-200 px-3 py-1.5 rounded-lg text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs ${
                                        !isSelected
                                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                          : "bg-white text-slate-900"
                                      }`}
                                      defaultValue={sc.shoulder || ""}
                                      id={`shoulder-${s.id}`}
                                      placeholder="—"
                                      readOnly={!isSelected}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab("design")}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Mockups
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("pricing")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-xs transition"
                    >
                      Continue to Pricing <ArrowRight className="h-4 w-4" />
                    </button>
                  </CardFooter>
                </Card>
              )}

              {/* TAB 4: WHOLESALE PRICING */}
              {activeTab === "pricing" && (
                <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="border-b bg-slate-50/60 p-6">
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Tag className="h-5 w-5 text-indigo-600" />
                      Dual-Tier Wholesale & Single Unit Pricing
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-1">
                      Configure your pricing structure. Designers can purchase single units for physical samples or place bulk wholesale runs with minimum thresholds.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Single Unit Tier */}
                      <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Tier 1: Sample Orders
                          </span>
                          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                            1 - {Math.max(1, bulkMin - 1)} units
                          </span>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900">
                            Single Unit Base Price
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Standard rate charged when designers buy single test samples.
                          </p>
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={singlePrice}
                            onChange={(e) =>
                              setSinglePrice(
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            placeholder="299.00"
                            className="w-full border border-slate-200 pl-9 pr-4 py-3 rounded-xl text-slate-900 font-bold text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                          />
                        </div>
                      </div>

                      {/* Bulk Wholesale Tier */}
                      <div className="border border-indigo-200 rounded-2xl p-5 bg-indigo-50/20 space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                            Tier 2: Wholesale Bulk
                          </span>
                          {discountPercent ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Percent className="h-3 w-3" /> Save {discountPercent}%
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                              Volume Tier
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900">
                            Bulk Production Pricing
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Discounted wholesale unit price for batch manufacturing runs.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Min Order Qty (MOQ)
                            </label>
                            <input
                              type="number"
                              value={bulkMin}
                              onChange={(e) => setBulkMin(Number(e.target.value))}
                              placeholder="50"
                              className="w-full border border-slate-200 bg-white px-3 py-3 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Bulk Unit Price (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                ₹
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={bulkPrice}
                                onChange={(e) =>
                                  setBulkPrice(
                                    e.target.value === "" ? "" : Number(e.target.value)
                                  )
                                }
                                placeholder="199.00"
                                className="w-full border border-slate-200 bg-white pl-7 pr-3 py-3 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-indigo-500 outline-none transition"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Calculated Tier Summary Banner */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">
                          ₹
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">
                            Designer Ordering Summary
                          </div>
                          <div className="text-xs text-slate-500">
                            Single unit purchase:{" "}
                            <span className="font-semibold text-slate-900">
                              ₹{singlePrice || "0.00"}
                            </span>{" "}
                            • Bulk runs ({bulkMin}+ pcs):{" "}
                            <span className="font-semibold text-indigo-600">
                              ₹{bulkPrice || "0.00"}/pc
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSaveAll}
                          disabled={isSaving || (!editingProductId && !productName.trim())}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition flex items-center gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {editingProductId ? "Update Product" : "Save & Publish Garment"}
                        </button>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab("sizes")}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Sizes
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAll}
                      disabled={isSaving || (!editingProductId && !productName.trim())}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition"
                    >
                      <Save className="h-4 w-4" /> Save Product
                    </button>
                  </CardFooter>
                </Card>
              )}
            </div>

            {/* Right Column: Sticky Studio Live Preview & Actions */}
            <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-5">
              <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
                <CardHeader className="border-b bg-slate-50/60 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-indigo-600" />
                        Studio Live Preview
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Real-time garment canvas projection
                      </CardDescription>
                    </div>

                    {/* View Switcher Pills */}
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setDesignSide("front")}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                          designSide === "front"
                            ? "bg-white text-indigo-600 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesignSide("back")}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                          designSide === "back"
                            ? "bg-white text-indigo-600 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* Studio Canvas Box */}
                  <div className="relative aspect-square w-full rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/70 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner p-2">
                    {/* Subtle grid pattern background */}
                    <div
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage: `radial-gradient(circle, #94a3b8 1px, transparent 1px)`,
                        backgroundSize: "16px 16px"
                      }}
                    />

                    <DesignCanvas
                      side={designSide}
                      slogan={designs[designSide].slogan}
                      color={designs[designSide].color}
                      template={designs[designSide].template}
                      templateColor={designs[designSide].color}
                      image={designs[designSide].image}
                      imageScale={designs[designSide].imageScale / 100}
                      imageRotation={designs[designSide].imageRotation}
                      imagePosition={designs[designSide].imagePosition}
                      width={340}
                      height={340}
                      showTemplate={false}
                    />

                    {/* Side indicator badge */}
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 shadow-xs">
                      {designSide === "front" ? "Front View" : "Back View"}
                    </div>
                  </div>

                  {/* Garment Quick Metadata Summary */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Garment Name</span>
                      <span className="text-xs font-bold text-slate-900 truncate max-w-[180px]">
                        {productName.trim() || "Untitled Blank"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Classification</span>
                      <span className="text-xs font-semibold text-slate-700 capitalize">
                        {category}’s • {product}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Pricing Range</span>
                      <span className="text-xs font-bold text-indigo-600 font-mono">
                        {singlePrice ? `₹${singlePrice}` : "₹0"}
                        {bulkPrice ? ` - ₹${bulkPrice} bulk` : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-xs text-slate-500 font-medium">
                        Enabled Variants
                      </span>
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <span>{selectedSizes.length} sizes</span>
                        <span>•</span>
                        <span>{selectedColors.length} colors</span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-t bg-slate-50/50 p-5 flex flex-col gap-2.5">
                  <button
                    type="submit"
                    disabled={isSaving || (!editingProductId && !productName.trim())}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs hover:shadow transition-all ${
                      isSaving || (!editingProductId && !productName.trim())
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving Product...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {editingProductId ? "Update Garment Catalog" : "Save & Publish Garment"}
                      </>
                    )}
                  </button>

                  {editingProductId && (
                    <button
                      type="button"
                      onClick={promptDeleteProduct}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete from Catalog
                    </button>
                  )}
                </CardFooter>
              </Card>
            </aside>
          </div>
        </form>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 lg:hidden">
        <div className="bg-white/95 backdrop-blur border border-slate-200 shadow-xl rounded-2xl p-3 flex gap-2.5 items-center">
          <button
            onClick={() => document.getElementById("save-product-btn")?.click()}
            disabled={isSaving || (!editingProductId && !productName.trim())}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Garment
          </button>
          {editingProductId && (
            <button
              onClick={promptDeleteProduct}
              className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-bold transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Styled Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent className="rounded-2xl shadow-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 mt-2">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 gap-2">
            <AlertDialogCancel className="rounded-xl font-semibold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
