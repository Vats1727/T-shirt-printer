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
  Loader2,
  Plus,
  Wand2,
  HelpCircle,
  AlertTriangle,
  FileText,
  AlertCircle,
  Lock
} from "lucide-react";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import { useToast } from "@/hooks/use-toast";
import { decodeId } from "@/utils/idEncoder";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
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
  const [colorHex, setColorHex] = useState("#4F46E5");
  const [rgbState, setRgbState] = useState({ r: 79, g: 70, b: 229 });
  const [sizeLabel, setSizeLabel] = useState("");
  const [product, setProduct] = useState("tshirt");
  const [sizeChart, setSizeChart] = useState([]);
  const [sizeChartValues, setSizeChartValues] = useState({});
  const [showSizeMatrix, setShowSizeMatrix] = useState(false);
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
  const [showMockupGuide, setShowMockupGuide] = useState(false);

  // Industry Standard Apparel Measurements (in Inches)
  const INDUSTRY_STANDARD_SIZES = {
    tshirt: {
      XS: { chest: 36, length: 26, shoulder: 16.5 },
      S: { chest: 38, length: 27, shoulder: 17 },
      M: { chest: 40, length: 28, shoulder: 18 },
      L: { chest: 42, length: 29, shoulder: 19 },
      XL: { chest: 44, length: 30, shoulder: 20 },
      "2XL": { chest: 46, length: 31, shoulder: 21 },
      "3XL": { chest: 48, length: 32, shoulder: 22 }
    },
    hoodie: {
      XS: { chest: 38, length: 26, shoulder: 17.5 },
      S: { chest: 40, length: 27, shoulder: 18.5 },
      M: { chest: 42, length: 28, shoulder: 19.5 },
      L: { chest: 44, length: 29, shoulder: 20.5 },
      XL: { chest: 46, length: 30, shoulder: 21.5 },
      "2XL": { chest: 48, length: 31, shoulder: 22.5 },
      "3XL": { chest: 50, length: 32, shoulder: 23.5 }
    },
    longsleeve: {
      XS: { chest: 36, length: 26, shoulder: 16.5 },
      S: { chest: 38, length: 27, shoulder: 17 },
      M: { chest: 40, length: 28, shoulder: 18 },
      L: { chest: 42, length: 29, shoulder: 19 },
      XL: { chest: 44, length: 30, shoulder: 20 },
      "2XL": { chest: 46, length: 31, shoulder: 21 },
      "3XL": { chest: 48, length: 32, shoulder: 22 }
    },
    sweatshirt: {
      XS: { chest: 38, length: 26, shoulder: 17 },
      S: { chest: 40, length: 27, shoulder: 18 },
      M: { chest: 42, length: 28, shoulder: 19 },
      L: { chest: 44, length: 29, shoulder: 20 },
      XL: { chest: 46, length: 30, shoulder: 21 },
      "2XL": { chest: 48, length: 31, shoulder: 22 },
      "3XL": { chest: 50, length: 32, shoulder: 23 }
    }
  };

  function getIndustryDefaults(template, label) {
    const tmpl = INDUSTRY_STANDARD_SIZES[template] || INDUSTRY_STANDARD_SIZES.tshirt;
    const cleanLabel = (label || "").trim().toUpperCase();
    if (tmpl[cleanLabel]) return tmpl[cleanLabel];
    if (cleanLabel === "XXL" && tmpl["2XL"]) return tmpl["2XL"];
    if (cleanLabel === "XXXL" && tmpl["3XL"]) return tmpl["3XL"];
    if (cleanLabel.startsWith("XS") && tmpl["XS"]) return tmpl["XS"];
    if (cleanLabel.startsWith("S") && tmpl["S"]) return tmpl["S"];
    if (cleanLabel.startsWith("M") && tmpl["M"]) return tmpl["M"];
    if (cleanLabel.startsWith("L") && tmpl["L"]) return tmpl["L"];
    if (cleanLabel.startsWith("XL") && tmpl["XL"]) return tmpl["XL"];
    return { chest: 40, length: 28, shoulder: 18 };
  }

  // Populate/Refresh sizeChartValues with defaults or existing data
  const applyIndustryDefaultsToAll = () => {
    const next = {};
    sizes.forEach((s) => {
      const def = getIndustryDefaults(product, s.label);
      next[s.id] = {
        chest: def.chest,
        length: def.length,
        shoulder: def.shoulder
      };
    });
    setSizeChartValues(next);
    toast({
      title: "Industry Defaults Applied",
      description: `Loaded standard measurements for ${product.toUpperCase()}.`
    });
  };

  // Color conversion & management helpers
  function hexToRgb(hex) {
    let clean = (hex || "#000000").replace("#", "");
    if (clean.length === 3) {
      clean = clean.split("").map((c) => c + c).join("");
    }
    const num = parseInt(clean, 16);
    return {
      r: isNaN(num) ? 0 : (num >> 16) & 255,
      g: isNaN(num) ? 0 : (num >> 8) & 255,
      b: isNaN(num) ? 0 : num & 255
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, parseInt(v, 10) || 0));
    return (
      "#" +
      [clamp(r), clamp(g), clamp(b)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  const updateColorFromHex = (hex) => {
    setColorHex(hex);
    setRgbState(hexToRgb(hex));
  };

  const updateColorFromRgb = (channel, val) => {
    const clean = Math.max(0, Math.min(255, parseInt(val, 10) || 0));
    const next = { ...rgbState, [channel]: clean };
    setRgbState(next);
    setColorHex(rgbToHex(next.r, next.g, next.b));
  };

  async function handleAddCustomColor() {
    if (!colorHex || !colorName.trim()) {
      toast({
        title: "Color Name Required",
        description: "Please enter a descriptive name for this color swatch (e.g., 'Vintage Indigo').",
        variant: "destructive"
      });
      return;
    }

    if (colorName.trim().length > 30) {
      toast({
        title: "Color Name Too Long",
        description: "Fabric shade name must be 30 characters or less.",
        variant: "destructive"
      });
      return;
    }

    const normalizeHex = (h) => {
      if (!h) return "";
      let clean = h.trim().toLowerCase();
      if (!clean.startsWith("#")) clean = "#" + clean;
      if (clean.length === 4) {
        clean = "#" + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
      }
      return clean;
    };

    const targetHex = normalizeHex(colorHex);
    const targetName = colorName.trim().toLowerCase();

    // 1. Check if a color with the exact same hex code already exists
    const duplicateHex = colors.find(
      (c) => normalizeHex(c.hex) === targetHex
    );
    if (duplicateHex) {
      toast({
        title: "Color Already Exists",
        description: `This color code (${colorHex.toUpperCase()}) already exists in your catalog as "${duplicateHex.name}".`,
        variant: "destructive"
      });
      return;
    }

    // 2. Check if a color with the exact same name already exists
    const duplicateName = colors.find(
      (c) => (c.name || "").trim().toLowerCase() === targetName
    );
    if (duplicateName) {
      toast({
        title: "Color Name Already Exists",
        description: `A color named "${duplicateName.name}" (${duplicateName.hex}) already exists. Please choose a different name.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const res = await fetch("/api/admin/colors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ name: colorName.trim(), hex: colorHex })
      });
      if (res.ok) {
        const newColor = await res.json();
        setColors((prev) => [...prev.filter((c) => c.id !== newColor.id), newColor]);
        setSelectedColors((prev) => [...new Set([...prev, newColor.id])]);
        setColorName("");
        toast({
          title: "Custom Swatch Added",
          description: `${newColor.name} (${newColor.hex}) added and selected.`
        });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Could Not Add Color",
          description: err.message || "Failed to create color swatch.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "Failed to add color swatch.",
        variant: "destructive"
      });
    }
  }

  async function handleDeleteColor(colorId, colorTitle) {
    try {
      const res = await fetch(`/api/admin/colors/${colorId}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        setColors((prev) => prev.filter((c) => c.id !== colorId));
        setSelectedColors((prev) => prev.filter((id) => id !== colorId));
        toast({
          title: "Swatch Removed",
          description: `${colorTitle} removed from catalog.`
        });
      }
    } catch (e) {}
  }

  // Strict Real-Time Whole Number Validation Handlers
  const handleWholeNumberKeyDown = (e) => {
    if (
      ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) ||
      ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase()))
    ) {
      return;
    }
    // Block negatives, decimals, exponents, symbols, letters
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const sanitizeWholeNumber = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    const digits = String(val).replace(/\D/g, "");
    if (!digits) return "";
    return String(parseInt(digits, 10)); // removes leading zeroes e.g. "05" -> "5"
  };

  const sectionsEnabled = productSaved || productName.trim() !== "";

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
  const [bulkMin, setBulkMin] = useState("50");
  const [bulkPrice, setBulkPrice] = useState("");
  const [productStatus, setProductStatus] = useState("published");
  const [missingFieldsModalOpen, setMissingFieldsModalOpen] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState([]);

  const validateStepRequirements = (targetTabId) => {
    const tabOrder = ["product", "design", "sizes", "pricing"];
    const currentIndex = tabOrder.indexOf(activeTab);
    const targetIndex = tabOrder.indexOf(targetTabId);

    // Navigating backwards is always allowed
    if (targetIndex <= currentIndex) {
      return { ok: true };
    }

    // Check each step up to the target
    for (let i = 0; i < targetIndex; i++) {
      const step = tabOrder[i];
      if (step === "product") {
        if (!productName.trim()) {
          return {
            ok: false,
            stepId: "product",
            title: "Product Title Required",
            description: "Please enter a product title in Step 01 before proceeding to the next step."
          };
        }
        if (productName.trim().length > 60) {
          return {
            ok: false,
            stepId: "product",
            title: "Product Title Too Long",
            description: "Product title must not exceed 60 characters before proceeding."
          };
        }
      } else if (step === "design") {
        if (!designs.front.image) {
          return {
            ok: false,
            stepId: "design",
            title: "Front Mockup Required",
            description: "Please upload a Front View Canvas Mockup (PNG) in Step 02 before proceeding to the next step."
          };
        }
      } else if (step === "sizes") {
        if (!selectedColors || selectedColors.length === 0) {
          return {
            ok: false,
            stepId: "sizes",
            title: "Fabric Colors Required",
            description: "Please select at least one garment color swatch in Step 03 before proceeding."
          };
        }
        if (!selectedSizes || selectedSizes.length === 0) {
          return {
            ok: false,
            stepId: "sizes",
            title: "Garment Sizes Required",
            description: "Please select at least one garment size in Step 03 before proceeding."
          };
        }
      }
    }

    return { ok: true };
  };

  const isStepAccessible = (targetId) => {
    return validateStepRequirements(targetId).ok;
  };

  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return true;

    const check = validateStepRequirements(tabId);
    if (!check.ok) {
      toast({
        title: check.title,
        description: check.description,
        variant: "destructive"
      });
      return false;
    }

    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return true;
  };

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
      if (s.ok) {
        const rawSizes = await s.json();
        const seen = new Set();
        setSizes(
          rawSizes.filter((item) => {
            const key = (item.label || "").toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
        );
      } else {
        throw new Error("Failed to load sizes");
      }

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
      setProductStatus(p.status || "published");
      setSinglePrice(p.single_price !== undefined && p.single_price !== null ? String(Math.round(p.single_price)) : "");
      setBulkMin(p.bulk_min !== undefined && p.bulk_min !== null ? String(Math.round(p.bulk_min)) : "50");
      setBulkPrice(p.bulk_price !== undefined && p.bulk_price !== null ? String(Math.round(p.bulk_price)) : "");
      setSelectedSizes(p.sizes || []);
      setSelectedColors(p.colors || []);
      setSizeChart(p.sizeChart || []);
      if (Array.isArray(p.sizeChart) && p.sizeChart.length > 0) {
        const scMap = {};
        p.sizeChart.forEach((sc) => {
          scMap[sc.size_id] = {
            chest: sc.chest ?? "",
            length: sc.length ?? "",
            shoulder: sc.shoulder ?? ""
          };
        });
        setSizeChartValues((prev) => ({ ...prev, ...scMap }));
      }

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

  const getMissingRequiredFields = () => {
    const missing = [];
    if (!productName.trim()) {
      missing.push({ tab: "product", tabName: "Step 01 Product Info", field: "Product Title" });
    } else if (productName.trim().length > 60) {
      missing.push({ tab: "product", tabName: "Step 01 Product Info", field: "Product Title must be 60 characters or less" });
    }
    if (!designs.front.image) {
      missing.push({ tab: "design", tabName: "Step 02 Artwork & Mockups", field: "Front Mockup Image (PNG)" });
    }
    if (!selectedColors || selectedColors.length === 0) {
      missing.push({ tab: "sizes", tabName: "Step 03 Colors & Sizes", field: "At least one Fabric Color" });
    }
    if (!selectedSizes || selectedSizes.length === 0) {
      missing.push({ tab: "sizes", tabName: "Step 03 Colors & Sizes", field: "At least one Garment Size" });
    }
    if (!singlePrice || Number(singlePrice) <= 0) {
      missing.push({ tab: "pricing", tabName: "Step 04 Wholesale Pricing", field: "Single Unit Base Price (> ₹0)" });
    }
    if (!bulkPrice || Number(bulkPrice) <= 0) {
      missing.push({ tab: "pricing", tabName: "Step 04 Wholesale Pricing", field: "Bulk Wholesale Price (> ₹0)" });
    }
    if (!bulkMin || Number(bulkMin) <= 0) {
      missing.push({ tab: "pricing", tabName: "Step 04 Wholesale Pricing", field: "Minimum Order Quantity (> 0)" });
    }
    return missing;
  };

  async function handleSave(isDraft = false) {
    if (!productName.trim()) {
      toast({
        title: "Product Title Required",
        description: isDraft
          ? "Please provide a name for this draft garment."
          : "Please enter a product title before saving.",
        variant: "destructive"
      });
      handleTabChange("product");
      return;
    }

    if (productName.trim().length > 60) {
      toast({
        title: "Product Title Too Long",
        description: "Product title must not exceed 60 characters to prevent layout issues.",
        variant: "destructive"
      });
      handleTabChange("product");
      return;
    }

    if (!isDraft) {
      const missing = getMissingRequiredFields();
      if (missing.length > 0) {
        setMissingFieldsList(missing);
        setMissingFieldsModalOpen(true);
        toast({
          title: "Required Fields Missing",
          description: `Cannot save as published. ${missing.length} required field(s) remain empty. You can complete them or save as Draft.`,
          variant: "destructive"
        });
        return;
      }
    }

    await executeSave(isDraft);
  }

  async function executeSave(isDraft = false) {
    setIsSaving(true);
    const sizeChartPayload = sizes
      .map((s) => {
        const defaultVals = getIndustryDefaults(product, s.label);
        const row = sizeChartValues[s.id] || {};
        const chest = row.chest !== undefined && row.chest !== "" ? row.chest : (document.getElementById(`chest-${s.id}`)?.value || defaultVals.chest || "");
        const length = row.length !== undefined && row.length !== "" ? row.length : (document.getElementById(`length-${s.id}`)?.value || defaultVals.length || "");
        const shoulder = row.shoulder !== undefined && row.shoulder !== "" ? row.shoulder : (document.getElementById(`shoulder-${s.id}`)?.value || defaultVals.shoulder || "");
        return {
          size_id: s.id,
          chest: chest === "" || isNaN(Number(chest)) ? null : Number(chest),
          length: length === "" || isNaN(Number(length)) ? null : Number(length),
          shoulder: shoulder === "" || isNaN(Number(shoulder)) ? null : Number(shoulder)
        };
      })
      .filter(
        (sc) => sc.chest !== null || sc.length !== null || sc.shoulder !== null
      );

    const targetStatus = isDraft ? "draft" : "published";

    const payload = {
      name: productName,
      category,
      single_price: singlePrice === "" ? 0 : parseInt(singlePrice, 10),
      bulk_min: bulkMin === "" ? 50 : parseInt(bulkMin, 10),
      bulk_price: bulkPrice === "" ? 0 : parseInt(bulkPrice, 10),
      sizes: selectedSizes,
      colors: selectedColors,
      designs: {
        front: { ...designs.front, imageScale: designs.front.imageScale / 100 },
        back: { ...designs.back, imageScale: designs.back.imageScale / 100 }
      },
      sizeChart: sizeChartPayload,
      status: targetStatus
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
          title: isDraft ? "Failed to Save Draft" : "Failed to Save Product",
          description: js.message || "Error occurred while saving product.",
          variant: "destructive"
        });
      } else {
        const data = await res.json();
        setProductSaved(true);
        setProductStatus(targetStatus);
        setSizeChart(data.sizeChart || data.size_chart || []);
        toast({
          title: isDraft ? "Saved as Draft" : (editingProductId ? "All Changes Saved" : "Garment Published"),
          description: isDraft
            ? "Your draft has been saved. You can complete the remaining required specifications later."
            : "All required specifications validated and saved. Returning to catalog dashboard..."
        });
        setTimeout(() => {
          setLocation("/admin/dashboard");
        }, 800);
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

  function handleSaveAll(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (activeTab !== "pricing") return;
    handleSave(false);
  }

  // Calculate volume discount percentage if both prices are valid (up to 2 decimal places, e.g. 2.23)
  const discountPercent = (() => {
    const s = Number(singlePrice);
    const b = Number(bulkPrice);
    if (s > 0 && b > 0 && b < s) {
      const raw = ((s - b) / s) * 100;
      const formatted = parseFloat(raw.toFixed(2));
      return formatted > 0 ? formatted : null;
    }
    return null;
  })();

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
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      <form onSubmit={handleSaveAll} className="space-y-6">
          {/* Professional SaaS Stepper Navigation Bar */}
          <div className="sticky top-[108px] z-30 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {editingProductId && (
              <div className="px-4 py-1.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500">Editing:</span>
                  <span className="font-bold text-slate-800">{productName || "Untitled"}</span>
                </div>
                <div>
                  {productStatus === "draft" ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                      <FileText className="w-3 h-3 text-amber-600" /> Draft
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Published
                    </span>
                  )}
                </div>
              </div>
            )}
            <nav className="flex divide-x divide-slate-100 overflow-x-auto no-scrollbar" aria-label="Garment Studio Steps">
              {tabList.map((t, index) => {
                const isActive = activeTab === t.id;
                const tabOrder = ["product", "design", "sizes", "pricing"];
                const activeIndex = tabOrder.indexOf(activeTab);
                const isPassed = index < activeIndex;
                const isAccessible = isStepAccessible(t.id);

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTabChange(t.id)}
                    className={`group relative flex-1 min-w-[180px] sm:min-w-0 py-4 px-4 sm:px-6 flex items-center gap-3.5 text-left transition-all ${
                      isActive
                        ? "bg-slate-50/70"
                        : isAccessible
                        ? "bg-white hover:bg-slate-50/40 cursor-pointer"
                        : "bg-slate-50/30 opacity-70 cursor-not-allowed hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Step Indicator Badge */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all text-xs font-bold ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-xs"
                          : isPassed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                          : isAccessible
                          ? "bg-slate-100 text-slate-500 border border-slate-200/70"
                          : "bg-slate-100 text-slate-400 border border-slate-200/50"
                      }`}
                    >
                      {isPassed ? (
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      ) : !isAccessible ? (
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <span>0{t.number}</span>
                      )}
                    </div>

                    {/* Step Title & Counter */}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          isActive
                            ? "text-indigo-600"
                            : isPassed
                            ? "text-emerald-700"
                            : isAccessible
                            ? "text-slate-400 group-hover:text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        Step 0{t.number} {!isAccessible && "• Locked"}
                      </div>
                      <div
                        className={`text-sm transition-colors whitespace-nowrap ${
                          isActive
                            ? "text-slate-900 font-bold"
                            : isAccessible
                            ? "text-slate-600 font-semibold group-hover:text-slate-900"
                            : "text-slate-400 font-medium"
                        }`}
                      >
                        {t.label}
                      </div>
                    </div>

                    {/* Active Bottom Indicator Accent */}
                    {isActive && (
                      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600" />
                    )}
                  </button>
                );
              })}
            </nav>
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
                              Standard, relaxed, streetwear and heavyweight fits.
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
                              Fitted tees, cropped styles, and specialized women's sizing.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Product Name */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Product Title <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            Shown to designers in catalog
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              productName.length >= 60
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : productName.length > 50
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {productName.length}/60
                          </span>
                        </div>
                      </div>
                      <input
                        value={productName}
                        maxLength={60}
                        onChange={(e) => setProductName(e.target.value.slice(0, 60))}
                        placeholder="e.g. Men's Heavyweight 240 GSM Oversized Tee"
                        className={`w-full border px-4 py-3 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${
                          productName.length >= 60
                            ? "border-amber-300 bg-amber-50/20"
                            : "border-slate-200 bg-white"
                        }`}
                      />
                      {productName.length >= 60 && (
                        <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                          Maximum product title character limit reached (60 characters).
                        </p>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">Step 1 of 4 • Product Identity</span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSave(true)}
                        disabled={isSaving || !productName.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 rounded-xl text-sm font-semibold transition shadow-2xs cursor-pointer"
                        title="Save progress as a draft without publishing"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        <span>Save as Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTabChange("design")}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition ${
                          !productName.trim()
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                        }`}
                      >
                        <span>Continue to Mockups</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              )}

              {/* TAB 2: ARTWORK & MOCKUPS */}
              {activeTab === "design" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Mockup Upload Controls */}
                  <div className="lg:col-span-7 space-y-6">
                    <Card className="rounded-2xl border-slate-200/80 shadow-xs overflow-hidden bg-white">
                  <CardHeader className="border-b bg-slate-50/60 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-indigo-600" />
                        Garment Mockup Uploads
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-1">
                        Upload transparent PNG mockups for front and back angles. Designers will place their artwork directly over these canvases.
                      </CardDescription>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMockupGuide(true)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold shadow-2xs transition shrink-0 cursor-pointer"
                    >
                      <HelpCircle className="h-4 w-4 text-indigo-600" />
                      <span>Mockup Requirements</span>
                    </button>
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
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                              Required *
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

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleTabChange("product")}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Product Info
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSave(true)}
                        disabled={isSaving || !productName.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 rounded-xl text-sm font-semibold transition shadow-2xs cursor-pointer"
                        title="Save progress as a draft without publishing"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        <span>Save as Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTabChange("sizes")}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition ${
                          !designs.front.image
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                        }`}
                      >
                        <span>Continue to Colors & Sizes</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              </div>

              {/* Right Column: Studio Live Preview (ONLY shown in Tab 2!) */}
              <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
                <Card className="rounded-2xl border-slate-200/80 shadow-xs overflow-hidden bg-white">
                  <CardHeader className="border-b bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Eye className="h-4 w-4 text-indigo-600" />
                          Studio Live Preview
                        </CardTitle>
                        <CardDescription className="text-[11px] text-slate-500 mt-0.5">
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
                              ? "bg-white text-indigo-600 shadow-2xs"
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
                              ? "bg-white text-indigo-600 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    {/* Studio Canvas Box */}
                    <div className="relative aspect-square w-full rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/70 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner p-2">
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
                        width={320}
                        height={320}
                        showTemplate={false}
                      />

                      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 shadow-2xs">
                        {designSide === "front" ? "Front View" : "Back View"}
                      </div>
                    </div>

                    {/* Garment Mockup Live Metadata Summary */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Front View Mockup</span>
                        {designs.front.image ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Configured ({designs.front.imageScale}%)
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">Missing</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Back View Mockup</span>
                        {designs.back.image ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Configured ({designs.back.imageScale}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Optional / None</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500 font-medium">Garment Title</span>
                        <span className="font-bold text-slate-900 truncate max-w-[170px]">
                          {productName.trim() || "Untitled Blank"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
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
                      Choose which standard sizes and fabric colors are offered for this garment, and configure the garment measurement matrix.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    {/* Interactive RGB & Hex Color Palette Generator */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Palette className="h-4 w-4 text-indigo-600" />
                            RGB Fabric Color Palette Builder
                          </h4>
                          <span className="text-xs text-slate-500">
                            Pick custom RGB/HEX shades or choose from catalog swatches.
                          </span>
                        </div>
                      </div>

                      {/* RGB Color Palette Picker Card */}
                      <div className="p-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          {/* Live Swatch & Visual Picker */}
                          <div className="md:col-span-3 flex items-center gap-3">
                            <div className="relative group">
                              <div
                                className="w-12 h-12 rounded-2xl border-2 border-white shadow-md transition-transform group-hover:scale-105 flex items-center justify-center overflow-hidden"
                                style={{ backgroundColor: colorHex }}
                              >
                                <input
                                  type="color"
                                  value={colorHex}
                                  onChange={(e) => updateColorFromHex(e.target.value)}
                                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                  title="Click to open color wheel"
                                />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                Hex Code
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                                  #
                                </span>
                                <input
                                  type="text"
                                  maxLength={7}
                                  value={colorHex.replace("#", "")}
                                  onChange={(e) => updateColorFromHex("#" + e.target.value.replace(/[^0-9A-Fa-f]/g, ""))}
                                  className="w-full pl-6 pr-2 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-mono font-bold text-slate-800 uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                                  placeholder="4F46E5"
                                />
                              </div>
                            </div>
                          </div>

                          {/* RGB Sliders / Number Inputs */}
                          <div className="md:col-span-4">
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              RGB Channels (0 - 255)
                            </label>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div>
                                <span className="text-[10px] font-bold text-rose-500 block text-center">R</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={rgbState.r}
                                  onKeyDown={handleWholeNumberKeyDown}
                                  onChange={(e) => updateColorFromRgb("r", e.target.value)}
                                  className="w-full text-center py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-emerald-600 block text-center">G</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={rgbState.g}
                                  onKeyDown={handleWholeNumberKeyDown}
                                  onChange={(e) => updateColorFromRgb("g", e.target.value)}
                                  className="w-full text-center py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-blue-600 block text-center">B</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={rgbState.b}
                                  onKeyDown={handleWholeNumberKeyDown}
                                  onChange={(e) => updateColorFromRgb("b", e.target.value)}
                                  className="w-full text-center py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Color Name Input */}
                          <div className="md:col-span-3">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-600 block">
                                Fabric Shade Name
                              </label>
                              <span className="text-[10px] font-mono text-slate-400">
                                {colorName.length}/30
                              </span>
                            </div>
                            <input
                              type="text"
                              value={colorName}
                              maxLength={30}
                              onChange={(e) => setColorName(e.target.value.slice(0, 30))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddCustomColor();
                                }
                              }}
                              placeholder="e.g. Vintage Indigo"
                              className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </div>

                          {/* Add Swatch Button */}
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={handleAddCustomColor}
                              className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Add Color</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Swatches Grid */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Offered Fabric Colors <span className="text-rose-500">*</span> ({selectedColors.length} Selected)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedColors(colors.map((c) => c.id))}
                              disabled={colors.length === 0}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedColors([])}
                              disabled={selectedColors.length === 0}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {colors.length === 0 ? (
                            <div className="w-full py-5 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
                              <Palette className="h-5 w-5 text-slate-400 mx-auto mb-1.5" />
                              <p className="text-xs font-semibold text-slate-700">No fabric colors in your catalog yet.</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">Use the palette builder above to define custom fabric shade swatches for this garment.</p>
                            </div>
                          ) : (
                            colors.map((c) => {
                              const isSelected = selectedColors.includes(c.id);
                              return (
                                <div
                                  key={c.id}
                                  className={`group flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
                                    isSelected
                                      ? "bg-indigo-50/80 border-indigo-600 text-indigo-950 font-bold ring-1 ring-indigo-500/20"
                                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedColors((prev) =>
                                        prev.includes(c.id)
                                          ? prev.filter((x) => x !== c.id)
                                          : [...prev, c.id]
                                      );
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-inner shrink-0"
                                      style={{ backgroundColor: c.hex }}
                                    />
                                    <span>{c.name}</span>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 stroke-[3]" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteColor(c.id, c.name)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition p-0.5 ml-0.5 cursor-pointer"
                                    title="Delete color"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Size Selector */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-indigo-600" />
                            Garment Sizing Options <span className="text-rose-500">*</span> ({selectedSizes.length} Selected)
                          </h4>
                          <span className="text-xs text-slate-500">
                            Select sizes available in your production inventory.
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

                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Map(sizes.map((s) => [(s.label || "").toLowerCase().trim(), s])).values()).map((s) => {
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
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-2xs ${
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

                    {/* Compact Industry Standard Sizing Matrix */}
                    <div className="space-y-3 pt-2">
                      {/* Summary Bar - Default compact view */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <Ruler className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                Industry Standard Measurements ({product.toUpperCase()})
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                Pre-Calibrated Active
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Standard Chest, Length & Shoulder specs pre-filled in inches for all active sizes.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={applyIndustryDefaultsToAll}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs"
                            title="Reset all measurements to factory standard"
                          >
                            <Wand2 className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Reset Defaults</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowSizeMatrix((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition shadow-2xs"
                          >
                            <span>{showSizeMatrix ? "Hide Measurement Table" : "Customize Measurements"}</span>
                            <span className="text-xs">{showSizeMatrix ? "▲" : "▼"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Measurement Matrix - Only renders when expanded, and ONLY for selected sizes */}
                      {showSizeMatrix && (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs bg-white mt-2">
                          {sizes.filter((s) => selectedSizes.includes(s.id)).length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-500">
                              <p className="font-semibold text-slate-700">No active sizes selected</p>
                              <p className="mt-1">Please select one or more garment sizes above to configure custom measurements.</p>
                            </div>
                          ) : (
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200">
                                  <th className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider w-28">
                                    Size
                                  </th>
                                  <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
                                    Chest Width (in)
                                  </th>
                                  <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
                                    Body Length (in)
                                  </th>
                                  <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
                                    Shoulder (in)
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {sizes
                                  .filter((s) => selectedSizes.includes(s.id))
                                  .map((s) => {
                                    const defaultVals = getIndustryDefaults(product, s.label);
                                    const currentVals = sizeChartValues[s.id] || {
                                      chest: defaultVals.chest,
                                      length: defaultVals.length,
                                      shoulder: defaultVals.shoulder
                                    };

                                    return (
                                      <tr key={s.id} className="bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors">
                                        <td className="px-4 py-2">
                                          <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-600" />
                                            <span className="font-bold text-xs text-slate-900">
                                              {s.label}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <input
                                            id={`chest-${s.id}`}
                                            type="text"
                                            inputMode="decimal"
                                            maxLength={5}
                                            value={currentVals.chest ?? ""}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/[^0-9.]/g, "").slice(0, 5);
                                              setSizeChartValues((prev) => ({
                                                ...prev,
                                                [s.id]: { ...(prev[s.id] || {}), chest: val }
                                              }));
                                            }}
                                            placeholder="—"
                                            className="w-full max-w-[90px] mx-auto block border border-slate-200 px-2.5 py-1 rounded-lg text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs bg-white text-slate-900"
                                          />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <input
                                            id={`length-${s.id}`}
                                            type="text"
                                            inputMode="decimal"
                                            maxLength={5}
                                            value={currentVals.length ?? ""}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/[^0-9.]/g, "").slice(0, 5);
                                              setSizeChartValues((prev) => ({
                                                ...prev,
                                                [s.id]: { ...(prev[s.id] || {}), length: val }
                                              }));
                                            }}
                                            placeholder="—"
                                            className="w-full max-w-[90px] mx-auto block border border-slate-200 px-2.5 py-1 rounded-lg text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs bg-white text-slate-900"
                                          />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <input
                                            id={`shoulder-${s.id}`}
                                            type="text"
                                            inputMode="decimal"
                                            maxLength={5}
                                            value={currentVals.shoulder ?? ""}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/[^0-9.]/g, "").slice(0, 5);
                                              setSizeChartValues((prev) => ({
                                                ...prev,
                                                [s.id]: { ...(prev[s.id] || {}), shoulder: val }
                                              }));
                                            }}
                                            placeholder="—"
                                            className="w-full max-w-[90px] mx-auto block border border-slate-200 px-2.5 py-1 rounded-lg text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-2xs bg-white text-slate-900"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleTabChange("design")}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Mockups
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSave(true)}
                        disabled={isSaving || !productName.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 rounded-xl text-sm font-semibold transition shadow-2xs cursor-pointer"
                        title="Save progress as a draft without publishing"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        <span>Save as Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTabChange("pricing")}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition ${
                          (!selectedColors || selectedColors.length === 0 || !selectedSizes || selectedSizes.length === 0)
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                        }`}
                      >
                        <span>Continue to Wholesale Pricing</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                      {/* Single Unit Tier */}
                      <div className="border border-slate-200 rounded-2xl p-5 bg-white flex flex-col justify-between shadow-2xs">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Tier 1: Sample Orders
                            </span>
                            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                              1 - {Math.max(1, (parseInt(bulkMin, 10) || 50) - 1)} units
                            </span>
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900">
                              Single Unit Base Price <span className="text-rose-500">*</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Standard rate charged when designers buy single test samples. Whole numbers only.
                            </p>
                          </div>
                        </div>

                        <div className="pt-4">
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Sample Unit Price (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                              ₹
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={7}
                              value={singlePrice}
                              onKeyDown={handleWholeNumberKeyDown}
                              onChange={(e) => setSinglePrice(sanitizeWholeNumber(e.target.value).slice(0, 7))}
                              onPaste={(e) => {
                                e.preventDefault();
                                const paste = e.clipboardData.getData("text");
                                setSinglePrice(sanitizeWholeNumber(paste).slice(0, 7));
                              }}
                              placeholder="299"
                              className="w-full border border-slate-200 bg-white pl-8 pr-3 py-3 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bulk Wholesale Tier */}
                      <div className="border border-indigo-200 rounded-2xl p-5 bg-indigo-50/20 flex flex-col justify-between shadow-2xs">
                        <div className="space-y-4">
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
                              Bulk Production Pricing <span className="text-rose-500">*</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Discounted wholesale unit price for batch manufacturing runs. Whole numbers only.
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Min Order Qty (MOQ)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={7}
                              value={bulkMin}
                              onKeyDown={handleWholeNumberKeyDown}
                              onChange={(e) => setBulkMin(sanitizeWholeNumber(e.target.value).slice(0, 7))}
                              onPaste={(e) => {
                                e.preventDefault();
                                const paste = e.clipboardData.getData("text");
                                setBulkMin(sanitizeWholeNumber(paste).slice(0, 7));
                              }}
                              placeholder="50"
                              className="w-full border border-slate-200 bg-white px-3 py-3 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Bulk Unit Price (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                                ₹
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={7}
                                value={bulkPrice}
                                onKeyDown={handleWholeNumberKeyDown}
                                onChange={(e) => setBulkPrice(sanitizeWholeNumber(e.target.value).slice(0, 7))}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  const paste = e.clipboardData.getData("text");
                                  setBulkPrice(sanitizeWholeNumber(paste).slice(0, 7));
                                }}
                                placeholder="199"
                                className="w-full border border-slate-200 bg-white pl-8 pr-3 py-3 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-indigo-500 outline-none transition"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Calculated Tier Summary Banner (No duplicate button) */}
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
                              ₹{singlePrice || "0"}
                            </span>{" "}
                            • Bulk runs ({bulkMin || "50"}+ pcs):{" "}
                            <span className="font-semibold text-indigo-600">
                              ₹{bulkPrice || "0"}/pc
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-slate-50/50 p-6 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleTabChange("sizes")}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back to Colors & Sizes
                      </button>
                      {editingProductId && (
                        <button
                          type="button"
                          onClick={promptDeleteProduct}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/70 rounded-xl text-xs font-semibold transition"
                          title="Delete this garment from catalog"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete Garment</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSave(true)}
                        disabled={isSaving || !productName.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 rounded-xl text-sm font-semibold transition shadow-2xs cursor-pointer"
                        title="Save progress as a draft without publishing"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        <span>Save as Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-2xs transition cursor-pointer"
                        title="Validate all required specifications and publish to catalog"
                      >
                        <Save className="h-4 w-4" />
                        <span>Save All</span>
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              )}
        </form>

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

      {/* Mockup Guidance & Specification Modal */}
      <Dialog open={showMockupGuide} onOpenChange={setShowMockupGuide}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 rounded-2xl border-slate-200 shadow-2xl bg-white flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="space-y-0.5 text-left">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Mockup Image Upload Guidelines
                  </DialogTitle>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/60">
                    Studio Standard
                  </span>
                </div>
                <DialogDescription className="text-xs text-slate-500">
                  Follow these specifications so our studio engine accurately applies real-time color shades and fabric depth.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Rule 1: Garment Color */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>1. Pure Neutral White Base Color (Mandatory)</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  White #FFFFFF
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The blank garment image <strong>must be pure white with natural grayscale fabric shading</strong>. Our rendering engine uses Canvas <code className="text-[11px] bg-slate-200/70 text-indigo-700 px-1 py-0.5 rounded font-mono">multiply</code> blending: pure white passes 100% of the true RGB/Hex swatch color, while fabric shadows and seams create photorealistic 3D depth.
              </p>
              <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Avoid Colored or Dark Mockups:</strong> Multiplying color over an already dyed or dark base distorts the hue (e.g., Red base + Blue swatch = muddy black). Black garments will never take color.
                </span>
              </div>
            </div>

            {/* Rule 2: Background Transparency */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>2. 100% Transparent Background (PNG with Alpha)</span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  .PNG (RGBA)
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Images must be saved as <strong>PNG with a clean transparent cutout background</strong>. The canvas uses the garment alpha mask (<code className="text-[11px] bg-slate-200/70 text-indigo-700 px-1 py-0.5 rounded font-mono">destination-in</code>) to dye only the fabric.
              </p>
              <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Avoid JPEG or Solid Backdrops:</strong> If the image has a solid white, gray, or studio backdrop, the entire rectangular box will be dyed with the selected color.
                </span>
              </div>
            </div>

            {/* Rule 3: Framing & Aspect Ratio */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>3. 1:1 Aspect Ratio & Centered Framing</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Min 1000×1000px
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Use a square 1:1 aspect ratio with high resolution (1000×1000px to 2000×2000px). Ensure both the Front and Back angles are centered symmetrically with matching margins so designer graphics align predictably on the print area.
              </p>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-slate-50/60 flex items-center justify-end shrink-0">
            <button
              type="button"
              onClick={() => setShowMockupGuide(false)}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Got it, Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Required Specifications Incomplete Dialog (Allows Saving as Draft) */}
      <Dialog open={missingFieldsModalOpen} onOpenChange={setMissingFieldsModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mb-2">
              <AlertCircle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Required Specifications Incomplete
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              To publish this garment to your live catalog, all required fields must be completed. Would you like to save it as a <strong>Draft</strong> to finish later, or continue editing?
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 max-h-56 overflow-y-auto">
            <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
              Missing Required Specifications:
            </span>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {missingFieldsList.map((m, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="font-semibold text-rose-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {m.field}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                    {m.tabName}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setMissingFieldsModalOpen(false);
                if (missingFieldsList.length > 0) {
                  handleTabChange(missingFieldsList[0].tab);
                }
              }}
              className="w-full sm:w-auto px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Continue Editing
            </button>
            <button
              type="button"
              onClick={() => {
                setMissingFieldsModalOpen(false);
                executeSave(true);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Save as Draft</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
