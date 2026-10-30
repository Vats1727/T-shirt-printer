import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, Save, Check, Palette, Type, Image as ImageIcon, IndianRupee, Loader2, Lock, ShoppingCart, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { decodeId } from "@/utils/idEncoder";
export default function SupplierProductOrder() {
  const [match, params] = useRoute("/supplier/product/:id");
  const rawParamId = params?.id;
  const decodedParamId = rawParamId ? decodeId(rawParamId) : null;
  const id = decodedParamId && decodedParamId !== 0 ? decodedParamId : rawParamId;

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const designQueryParam = searchParams.get("designId") || searchParams.get("edit");
  const editDesignId = designQueryParam ? decodeId(designQueryParam) || designQueryParam : null;

  const [, setLocation] = useLocation();
  const { token, user } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedColors, setSelectedColors] = useState([]);
  const [featuredColor, setFeaturedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [savedDesignId, setSavedDesignId] = useState(null);
  const [versions, setVersions] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState({
    status: "none",
    canSave: false,
    order: null
  });
  const frontExportRef = useRef(null);
  const backExportRef = useRef(null);
  const [side, setSide] = useState("front");
  const [activeTab, setActiveTab] = useState("colors");
  const baseState = {
    slogan: "",
    color: "#7c3aed",
    templateColor: "#ffffff",
    imageTintColor: null,
    textSize: 24,
    textRotation: 0,
    textPosition: { x: 180, y: 180 },
    image: null,
    imageScale: 25,
    imageRotation: 0,
    imagePosition: { x: 180, y: 180 },
    template: product?.template || "tshirt",
    templateImage: null
  };
  const [frontState, setFrontState] = useState(() => ({ ...baseState }));
  const [backState, setBackState] = useState(() => ({ ...baseState }));
  const activeState = side === "front" ? frontState : backState;
  const setActiveState = (patch) => {
    if (side === "front") setFrontState((prev) => ({ ...prev, ...patch }));
    else setBackState((prev) => ({ ...prev, ...patch }));
  };
  const slogan = activeState.slogan;
  const color = activeState.color;
  const templateColor = activeState.templateColor;
  const templateImage = activeState.templateImage;
  const imageTintColor = activeState.imageTintColor;
  const textSize = activeState.textSize;
  const textRotation = activeState.textRotation;
  const textPosition = activeState.textPosition;
  const image = activeState.image;
  const imageScale = activeState.imageScale;
  const imageRotation = activeState.imageRotation;
  const imagePosition = activeState.imagePosition;
  const template = activeState.template;
  const [orderType, setOrderType] = useState("single");
  const [priceInput, setPriceInput] = useState(0);
  useEffect(() => {
    console.debug("SupplierProductOrder: product/template/image", { product: product ? { id: product.id, slug: product.slug, template: product.template } : null, side, template, image, imageTintColor, templateImage });
  }, [product, side, template, image, imageTintColor, templateImage]);
  useEffect(() => {
    try {
      console.debug("SupplierProductOrder: side template colors", { front: frontState.templateColor, back: backState.templateColor, frontTemplateImage: frontState.templateImage, backTemplateImage: backState.templateImage });
    } catch (e) {
    }
  }, [frontState.templateColor, backState.templateColor, frontState.templateImage, backState.templateImage]);
  function normalizeImage(raw) {
    if (!raw) return null;
    let img = raw.image || raw.image_data || raw.file_name || raw.filename || raw.image_url || raw.image_src || raw.back_image || null;
    if (!img && typeof raw === "string") img = raw;
    if (!img) return null;
    img = String(img);
    if (!img.startsWith("data:") && !img.startsWith("http") && !img.startsWith("/")) img = `/attached_assets/${img}`;
    return img;
  }
  useEffect(() => {
    const load = async () => {
      setError(null);
      const res = await fetch("/api/supplier/catalog", { headers: { Authorization: token ? `Bearer ${token}` : "" } });
      if (!res.ok) {
        if (res.status === 401) setError("Please sign in as a supplier to place orders.");
        return;
      }
      const data = await res.json();
      setCatalog(data);

      let savedD = null;
      if (editDesignId) {
        try {
          const dRes = await fetch(`/api/designs/${editDesignId}`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          });
          if (dRes.ok) {
            savedD = await dRes.json();
            console.debug("SupplierProductOrder: preloading saved design", savedD);
            setSavedDesignId(Number(savedD.id));
          }
        } catch (dErr) {
          console.error("Failed to load design for editing", dErr);
        }
      }

      let prod = data.products?.find((p) =>
        Number(p.id) === Number(id) ||
        p.slug === String(id) ||
        p.slug === String(rawParamId) ||
        String(p.id) === String(id) ||
        (savedD?.product_id && Number(p.id) === Number(savedD.product_id)) ||
        (savedD?.product && p.slug === savedD.product)
      );

      if (!prod || !prod.colors || !prod.colors.length || !prod.sizes || !prod.sizes.length) {
        const prodLookupId = id || savedD?.product_id;
        if (prodLookupId) {
          try {
            const pRes = await fetch(`/api/supplier/products/${prodLookupId}`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
            if (pRes.ok) {
              const singleProd = await pRes.json();
              prod = { ...prod, ...singleProd };
            }
          } catch (e) {}
        }
      }
      console.debug("SupplierProductOrder: loaded product", prod);
      setProduct(prod || null);
      if (prod?.colors && prod.colors.length) {
        setSelectedColors(prod.colors.map(Number));
        setFeaturedColor(Number(prod.colors[0]));
      }
      setLoading(false);
      try {
        setPriceInput(Number(prod?.single_price || 0));
      } catch (e) {
        setPriceInput(0);
      }
      if (prod?.sizes && prod.sizes.length) {
        setSelectedSize(Number(prod.sizes[0]));
        setSelectedSizes(prod.sizes.map(Number));
        const init = {};
        for (const s of prod.sizes) init[Number(s)] = 0;
        init[Number(prod.sizes[0])] = 1;
        setSizeQuantities(init);
      }
      await fetchPurchaseStatus(prod);
      let frontDesign = null;
      let backDesign = null;

      if (Array.isArray(prod?.designs)) {
        frontDesign = prod.designs.find((d) => d && (d.side || "").toLowerCase() === "front") || prod.designs[0] || null;
        backDesign = prod.designs.find((d) => d && (d.side || "").toLowerCase() === "back") || (prod.designs.length > 1 ? prod.designs[1] : null);
      } else if (prod?.designs && typeof prod.designs === "object") {
        frontDesign = prod.designs.front || null;
        backDesign = prod.designs.back || null;
      }

      if (!frontDesign && (prod?.front_image || prod?.image)) {
        frontDesign = { image: prod?.front_image || prod?.image, side: "front" };
      }
      if (!backDesign && prod?.back_image) {
        backDesign = { image: prod?.back_image, side: "back" };
      }
      if (!frontDesign && prod?.designs_list && prod.designs_list[0]) {
        frontDesign = prod.designs_list[0];
      }
      if (!backDesign && prod?.designs_list && prod.designs_list[1]) {
        backDesign = prod.designs_list[1];
      }
      const firstColorHex = prod?.colors && prod.colors.length && data && data.colors ? data.colors.find((c) => Number(c.id) === Number(prod.colors[0]))?.hex : void 0;
      const pickDesignImage = (design) => {
        if (!design) return null;
        const candidates = [design?.image, design?.image_url, design?.image_src, design?.file_name, design?.filename, design?.image_data, design?.back_image];
        for (const c of candidates) {
          const img = normalizeImage(c);
          if (img) return img;
        }
        return null;
      };
      const resolvedTemplate = frontDesign && (frontDesign.template || frontDesign.template_name) || backDesign && (backDesign.template || backDesign.template_name) || prod?.template || void 0;
      const resolvedFrontImage = pickDesignImage(frontDesign);
      const resolvedBackImage = pickDesignImage(backDesign);

      if (frontDesign) {
        setFrontState((prev) => ({
          ...prev,
          slogan: frontDesign.slogan || prev.slogan,
          image: null,
          templateImage: normalizeImage(frontDesign.image || frontDesign.image_data || frontDesign.image_src || frontDesign.image_url || frontDesign.file_name || frontDesign.filename || frontDesign.template) || null,
          imageScale: frontDesign.image_scale ? Number(frontDesign.image_scale) : prev.imageScale,
          imageRotation: frontDesign.image_rotation ? Number(frontDesign.image_rotation) : prev.imageRotation,
          imagePosition: frontDesign.image_position || prev.imagePosition,
          textSize: frontDesign.text_size ? Number(frontDesign.text_size) : prev.textSize,
          textRotation: frontDesign.text_rotation ? Number(frontDesign.text_rotation) : prev.textRotation,
          textPosition: frontDesign.text_position || prev.textPosition,
          template: resolvedTemplate || prod?.template || prev.template,
          templateColor: frontDesign.template_color || frontDesign.templateColor || prev.templateColor,
          color: frontDesign.color || prev.color,
          imageTintColor: frontDesign.color || firstColorHex || prev.imageTintColor
        }));
      } else {
        setFrontState((prev) => ({ ...prev, image: null, template: prod?.template || prev.template, templateColor: firstColorHex || prev.templateColor, imageTintColor: firstColorHex || prev.imageTintColor }));
      }
      if (backDesign) {
        setBackState((prev) => ({
          ...prev,
          slogan: backDesign.slogan || prev.slogan,
          image: null,
          templateImage: normalizeImage(backDesign.image || backDesign.image_data || backDesign.image_src || backDesign.image_url || backDesign.file_name || backDesign.filename || backDesign.template) || null,
          imageScale: backDesign.image_scale ? Number(backDesign.image_scale) : prev.imageScale,
          imageRotation: backDesign.image_rotation ? Number(backDesign.image_rotation) : prev.imageRotation,
          imagePosition: backDesign.image_position || prev.imagePosition,
          textSize: backDesign.text_size ? Number(backDesign.text_size) : prev.textSize,
          textRotation: backDesign.text_rotation ? Number(backDesign.text_rotation) : prev.textRotation,
          textPosition: backDesign.text_position || prev.textPosition,
          template: resolvedTemplate || prod?.template || prev.template,
          templateColor: backDesign.template_color || backDesign.templateColor || firstColorHex || prev.templateColor,
          color: backDesign.color || firstColorHex || prev.color,
          imageTintColor: backDesign.color || firstColorHex || prev.imageTintColor
        }));
      } else {
        setBackState((prev) => ({ ...prev, image: null, template: prod?.template || prev.template, templateColor: firstColorHex || prev.templateColor, imageTintColor: firstColorHex || prev.imageTintColor }));
      }

      setFrontState((prev) => ({ ...prev, template: prod?.template || prev.template }));
      setBackState((prev) => ({ ...prev, template: prod?.template || prev.template }));

      // If preloading existing design, restore all custom artwork, slogan, colors, sizes and price
      if (savedD) {
        const version = savedD.version || (savedD.versions && savedD.versions[0]) || {};
        const sides = Array.isArray(version.sides) ? version.sides : [];
        const frontSide = sides.find((s) => (s.name || "").toLowerCase() === "front");
        const backSide = sides.find((s) => (s.name || "").toLowerCase() === "back");
        const meta = version.metadata || {};

        const fText = frontSide?.layers?.find((l) => l.type === "text");
        const fImg = frontSide?.layers?.find((l) => l.type === "image");
        const bText = backSide?.layers?.find((l) => l.type === "text");
        const bImg = backSide?.layers?.find((l) => l.type === "image");

        const fGarmentColor = meta.featured_color?.hex || savedD.template_color || firstColorHex || "#ffffff";

        const parseScale = (scaleVal, fallback = 25) => {
          if (scaleVal === undefined || scaleVal === null) return fallback;
          const num = Number(scaleVal);
          if (isNaN(num)) return fallback;
          return num <= 1 && num > 0 ? Math.round(num * 100) : Math.round(num);
        };

        const fArtwork = fImg?.asset?.dataUrl || fImg?.asset?.url || fImg?.url || (savedD.image ? normalizeImage(savedD.image) : null);
        const bArtwork = bImg?.asset?.dataUrl || bImg?.asset?.url || bImg?.url || (savedD.back_image ? normalizeImage(savedD.back_image) : null);

        setFrontState((prev) => ({
          ...prev,
          slogan: fText?.text !== undefined ? fText.text : (savedD.slogan || ""),
          color: fText?.color || savedD.color || prev.color,
          textSize: fText?.size ? Number(fText.size) : (savedD.text_size ? Number(savedD.text_size) : prev.textSize),
          textRotation: fText?.rotation !== undefined ? Number(fText.rotation) : (savedD.text_rotation !== undefined ? Number(savedD.text_rotation) : prev.textRotation),
          textPosition: fText?.position || savedD.text_position || prev.textPosition,
          image: fArtwork,
          imageScale: parseScale(fImg?.scale ?? savedD.image_scale, prev.imageScale),
          imageRotation: fImg?.rotation !== undefined ? Number(fImg.rotation) : (savedD.image_rotation !== undefined ? Number(savedD.image_rotation) : prev.imageRotation),
          imagePosition: fImg?.position || savedD.image_position || prev.imagePosition,
          template: savedD.template || prod?.template || prev.template,
          templateColor: fGarmentColor
        }));

        setBackState((prev) => ({
          ...prev,
          slogan: bText?.text !== undefined ? bText.text : (savedD.back_slogan || ""),
          color: bText?.color || savedD.color || prev.color,
          textSize: bText?.size ? Number(bText.size) : (savedD.back_text_size ? Number(savedD.back_text_size) : prev.textSize),
          textRotation: bText?.rotation !== undefined ? Number(bText.rotation) : (savedD.back_text_rotation !== undefined ? Number(savedD.back_text_rotation) : prev.textRotation),
          textPosition: bText?.position || savedD.back_text_position || prev.textPosition,
          image: bArtwork,
          imageScale: parseScale(bImg?.scale ?? savedD.back_image_scale, prev.imageScale),
          imageRotation: bImg?.rotation !== undefined ? Number(bImg.rotation) : (savedD.back_image_rotation !== undefined ? Number(savedD.back_image_rotation) : prev.imageRotation),
          imagePosition: bImg?.position || savedD.back_image_position || prev.imagePosition,
          template: savedD.template || prod?.template || prev.template,
          templateColor: fGarmentColor
        }));

        if (meta.selected_colors && Array.isArray(meta.selected_colors) && meta.selected_colors.length > 0) {
          const cIds = meta.selected_colors.map((c) => Number(c.id || c)).filter(Boolean);
          if (cIds.length > 0) setSelectedColors(cIds);
        }
        if (meta.featured_color) {
          const featId = Number(meta.featured_color.id || meta.featured_color);
          if (featId) setFeaturedColor(featId);
        }
        if (meta.selected_sizes && Array.isArray(meta.selected_sizes) && meta.selected_sizes.length > 0) {
          const sIds = meta.selected_sizes.map((s) => Number(s.id || s)).filter(Boolean);
          if (sIds.length > 0) setSelectedSizes(sIds);
        }
        if (savedD.price_cents) {
          setPriceInput(Number(savedD.price_cents) / 100);
        }
      }
    };
    load();
  }, [id, editDesignId, token]);

  const fetchPurchaseStatus = async (currentProd) => {
    const prodId = currentProd?.id || id;
    if (!prodId || (user && user.role !== "designer")) {
      setPurchaseStatus({ status: "approved", canSave: true });
      return;
    }
    try {
      const res = await fetch(`/api/supplier/products/${prodId}/purchase-status`, {
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





  const Banner = () => <div className="mb-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded">{error}</div>}
      {message && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded">{message} {savedDesignId && <button className="underline ml-2 text-primary" onClick={async () => {
    try {
      setError(null);
      setMessage("Fetching versions...");
      const res = await fetch(`/api/designs/${savedDesignId}/versions`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        setError("Failed to fetch versions: " + (txt || res.status));
        setMessage(null);
        return;
      }
      const js = await res.json();
      setVersions(js);
      setMessage("Versions loaded.");
    } catch (e) {
      setError("Failed to fetch versions: " + (e?.message || e));
      setMessage(null);
    }
  }}>View versions</button>}</div>}
    </div>;
  const totalQty = Object.values(sizeQuantities || {}).reduce((s, v) => s + Number(v || 0), 0);
  const unitPriceForDisplay = orderType === "bulk" && product?.bulk_min && totalQty >= Number(product?.bulk_min) && product?.bulk_price ? Number(product?.bulk_price) : Number(product?.single_price || 0);
  const totalPrice = totalQty > 0 ? unitPriceForDisplay * totalQty : 0;


  const getSizeLabel = (sid) => {
    if (!catalog || !Array.isArray(catalog.sizes)) return sid;
    const byId = catalog.sizes.find((s) => Number(s.id) === Number(sid));
    if (byId && (byId.label || byId.value)) return byId.label || byId.value;
    const byLabel = catalog.sizes.find((s) => String(s.label) === String(sid) || String(s.value) === String(sid));
    if (byLabel) return byLabel.label || byLabel.value;
    return sid;
  };
  const getColorObj = (cid) => (catalog && catalog.colors ? catalog.colors.find((c) => Number(c.id) === Number(cid)) : null) || { name: "Unknown", hex: "#ccc" };
  async function saveDesign() {
    setSaving(true);
    setError(null);
    const buildSide = (state, name) => ({
      name,
      layers: [
        ...state.slogan ? [{ type: "text", text: state.slogan, size: state.textSize, rotation: state.textRotation, position: state.textPosition, color: state.color }] : [],
        ...state.image ? [{ type: "image", url: state.image, asset: { url: state.image, dataUrl: state.image }, scale: state.imageScale / 100, rotation: state.imageRotation, position: state.imagePosition }] : []
      ]
    });
    const frontPreview = frontExportRef.current?.toDataURL?.("image/png") || null;
    const backPreview = backExportRef.current?.toDataURL?.("image/png") || null;
    const payload = {
      product: product?.slug || String(product?.id || "tshirt"),
      product_id: product?.id ? Number(product.id) : null,
      provider_id: (product?.owner_id ? Number(product.owner_id) : null) || (user?.associated_provider_id ? Number(user.associated_provider_id) : null),
      template: frontState.template || product?.template || "tshirt",
      templateColor: frontState.templateColor || "#ffffff",
      image: frontState.image || null,
      back_image: backState.image || null,
      slogan: frontState.slogan || null,
      back_slogan: backState.slogan || null,
      // convert rupees to paise
      price_cents: Math.round(Number(priceInput || 0) * 100),
      currency: "INR",
      version: {
        versionName: "supplier-save",
        sides: [buildSide(frontState, "front"), buildSide(backState, "back")],
        metadata: {
          canvasDimensions: { width: 400, height: 400 },
          dpiAware: true,
          preview_front: frontPreview,
          preview_back: backPreview,
          selected_colors: selectedColors.map((cid) => {
            const c = getColorObj(Number(cid));
            return { id: Number(cid), hex: c?.hex || null, name: c?.name || null };
          }),
          selected_sizes: selectedSizes.map((sid) => ({
            id: Number(sid),
            label: getSizeLabel(sid)
          })),
          featured_color: featuredColor ? (() => {
            const c = getColorObj(Number(featuredColor));
            if (!c) return null;
            return { id: Number(featuredColor), hex: c.hex, name: c.name };
          })() : selectedColors && selectedColors.length ? (() => {
            const c = getColorObj(Number(selectedColors[0]));
            if (!c) return null;
            return { id: Number(selectedColors[0]), hex: c.hex, name: c.name };
          })() : null
        }
      }
    };
    try {
      const createdIds = [];
      const originalFrontColor = frontState.templateColor;
      const originalBackColor = backState.templateColor;
      const capturePreviewsFor = async (hex) => {
        if (hex) {
          setFrontState((prev) => ({ ...prev, templateColor: hex }));
          setBackState((prev) => ({ ...prev, templateColor: hex }));
        }
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));
        const f = frontExportRef.current?.toDataURL?.("image/png") || null;
        const b = backExportRef.current?.toDataURL?.("image/png") || null;
        return { front: f, back: b };
      };
      const postOrPutDesign = async (payloadToSend) => {
        const isUpdate = Boolean(savedDesignId);
        const url = isUpdate ? `/api/designs/${savedDesignId}` : "/api/designs";
        const method = isUpdate ? "PUT" : "POST";
        const res2 = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify(payloadToSend)
        });
        if (!res2.ok) {
          const txt = await res2.text().catch(() => "");
          throw new Error(`Failed to ${isUpdate ? "update" : "save"} design: ` + (txt || res2.status));
        }
        return await res2.json();
      };
      if (selectedColors && Array.isArray(selectedColors) && selectedColors.length > 1) {
        const featuredCid = featuredColor ? Number(featuredColor) : Number(selectedColors[0]);
        const featuredObj = getColorObj(featuredCid) || null;
        const previewByColor = [];
        for (const cid of selectedColors) {
          const cobj = getColorObj(Number(cid));
          const hex = cobj?.hex || null;
          const previews = await capturePreviewsFor(hex);
          previewByColor.push({ id: Number(cid), hex, name: cobj?.name || null, preview_front: previews.front, preview_back: previews.back });
        }
        const featuredPreview = previewByColor.find((p) => Number(p.id) === Number(featuredCid)) || previewByColor[0];
        const multiPayload = {
          ...payload,
          version: {
            ...payload.version,
            metadata: {
              ...payload.version?.metadata || {},
              preview_front: featuredPreview?.preview_front || null,
              preview_back: featuredPreview?.preview_back || null,
              selected_colors: previewByColor.map((p) => ({ id: p.id, hex: p.hex, name: p.name })),
              selected_sizes: selectedSizes.map((sid) => ({
                id: Number(sid),
                label: getSizeLabel(sid)
              })),
              featured_color: featuredObj ? { id: Number(featuredObj.id), hex: featuredObj.hex, name: featuredObj.name } : null,
              preview_by_color: previewByColor
            }
          }
        };
        const js2 = await postOrPutDesign(multiPayload);
        const did2 = Number(js2.id || js2.designId || js2.design?.id || savedDesignId || null) || null;
        if (did2) createdIds.push(did2);
        setFrontState((prev) => ({ ...prev, templateColor: originalFrontColor }));
        setBackState((prev) => ({ ...prev, templateColor: originalBackColor }));
        try {
          localStorage.setItem(`supplier:product:${product?.id}:price`, String(priceInput || 0));
        } catch (e) {
        }
        const successMsg = savedDesignId
          ? "Design updated successfully for " + (selectedColors.length) + " colors!"
          : "Design saved successfully for " + createdIds.length + " colors!";
        setMessage(successMsg);
        toast({
          title: savedDesignId ? "Design Updated" : "Design Saved",
          description: successMsg
        });
        if (createdIds.length) setSavedDesignId(createdIds[0]);
        setTimeout(() => setLocation("/supplier/saved-designs"), 1200);
        return;
      }
      const js = await postOrPutDesign(payload);
      try {
        localStorage.setItem(`supplier:product:${product?.id}:price`, String(priceInput || 0));
      } catch (e) {
      }
      const did = Number(js.id || js.designId || js.design?.id || savedDesignId || null) || null;
      setSavedDesignId(did);
      if (js.versions && Array.isArray(js.versions)) {
        setVersions(js.versions);
      } else if (js.design && js.design.version) {
        setVersions([js.design.version]);
      }
      const successMsg = savedDesignId ? "Design updated successfully! Redirecting..." : "Design saved successfully! Redirecting...";
      setMessage(successMsg);
      toast({
        title: savedDesignId ? "Design Updated" : "Design Saved",
        description: savedDesignId ? "Your custom garment changes have been saved." : "New design added to your library."
      });
      setTimeout(() => setLocation("/supplier/saved-designs"), 1200);
    } catch (e) {
      setError(e?.message || "Failed to save design");
    } finally {
      setSaving(false);
    }
  }
  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse text-sm font-medium">Preparing design environment...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-12 text-center text-muted-foreground font-medium">
        Product not found
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/supplier/saved-designs")}
            className="rounded-full hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {savedDesignId ? "Edit Custom Design" : (product?.name || "Product")}
              </h1>
              {savedDesignId && (
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 font-mono text-xs">
                  #DSG-{savedDesignId}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {savedDesignId 
                ? `Update custom artwork, slogan, colors and specs for ${product?.name || product?.slug || "garment"}`
                : `Customize and save your design for ${product?.slug || ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === "designer" && (
            <Button
              onClick={() => setLocation(`/supplier/product/${params?.id || id}/order`)}
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1.5 shadow-xs rounded-xl h-10 font-semibold cursor-pointer"
            >
              <ShoppingCart className="size-4" />
              Order Blank Garments
            </Button>
          )}
          <Button
            onClick={saveDesign}
            disabled={saving || selectedColors.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 gap-2 min-w-[140px] shadow-sm rounded-xl h-10 font-semibold transition-all cursor-pointer"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? (savedDesignId ? "Updating..." : "Saving...") : (savedDesignId ? "Update Design" : "Save Design")}
          </Button>
        </div>
      </div>

      <Banner />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
        {
    /* Left column: Controls */
  }
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Design Customization</CardTitle>
                  <CardDescription>Configure colors, text, and logos</CardDescription>
                </div>
                <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-lg border shadow-sm">
                  <button
    onClick={() => setSide("front")}
    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${side === "front" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
  >
                    Front
                  </button>
                  <button
    onClick={() => setSide("back")}
    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${side === "back" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
  >
                    Back
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-4 gap-1 bg-muted/50 p-1">
                  <TabsTrigger value="colors" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                    <Palette className="size-4" />
                    <span className="hidden sm:inline">Color and Size</span>
                  </TabsTrigger>
                  <TabsTrigger value="slogan" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm" disabled={selectedColors.length === 0}>
                    <Type className="size-4" />
                    <span className="hidden sm:inline">Text</span>
                  </TabsTrigger>
                  <TabsTrigger value="logo" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm" disabled={selectedColors.length === 0}>
                    <ImageIcon className="size-4" />
                    <span className="hidden sm:inline">Logo</span>
                  </TabsTrigger>
                  <TabsTrigger value="price" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm" disabled={selectedColors.length === 0}>
                    <IndianRupee className="size-4" />
                    <span className="hidden sm:inline">Price</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="colors" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground italic">Available Print Colors</label>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-slate-50">Select at least one</Badge>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {product.colors && product.colors.length > 0 ? (
                        product.colors.map((cid) => {
                          const c = getColorObj(Number(cid));
                          const selected = selectedColors.includes(Number(cid));
                          const isFeatured = featuredColor === Number(cid);
                          return (
                            <div key={cid} className="relative group/color">
                              <button
                                onClick={() => {
                                  setSelectedColors((prev) => {
                                    if (prev.includes(Number(cid))) {
                                      const filtered = prev.filter((x) => x !== Number(cid));
                                      if (featuredColor === Number(cid)) setFeaturedColor(filtered.length ? filtered[0] : null);
                                      return filtered;
                                    }
                                    const next = [...prev, Number(cid)];
                                    if (!featuredColor) setFeaturedColor(Number(cid));
                                    return next;
                                  });
                                  setFrontState((prev) => ({ ...prev, templateColor: c.hex || prev.templateColor, imageTintColor: c.hex || prev.imageTintColor }));
                                  setBackState((prev) => ({ ...prev, templateColor: c.hex || prev.templateColor, imageTintColor: c.hex || prev.imageTintColor }));
                                }}
                                className={`w-full aspect-square rounded-full border-4 transition-all ${selected ? "border-indigo-500 shadow-md scale-105" : "border-white hover:border-gray-200"}`}
                                style={{ background: c.hex }}
                                title={c.name}
                              />
                              {selected && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFeaturedColor(Number(cid));
                                  }}
                                  className={`absolute -top-1 -right-1 size-5 rounded-full border flex items-center justify-center text-[10px] shadow-sm transition-transform active:scale-90 ${isFeatured ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-muted-foreground border-gray-200 hover:bg-gray-50"}`}
                                  title={isFeatured ? "Featured color" : "Mark as featured"}
                                >
                                  ★
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-4 text-xs text-muted-foreground italic py-2">
                          Standard neutral colors available
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-foreground italic">Available Sizes</label>
                        <span className="text-[10px] text-muted-foreground">(Multi-Select)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {product.sizes && product.sizes.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedSizes(product.sizes.map(Number))}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (product.sizes?.length) {
                                  setSelectedSizes([Number(product.sizes[0])]);
                                  setSelectedSize(Number(product.sizes[0]));
                                }
                              }}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                            >
                              Reset
                            </button>
                          </>
                        )}
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-slate-50 ml-1">
                          {selectedSizes.length} Selected
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.sizes && product.sizes.length > 0 ? (
                        product.sizes.map((sid) => {
                          const label = getSizeLabel(sid);
                          const isSelected = selectedSizes.includes(Number(sid));
                          return (
                            <button
                              key={sid}
                              type="button"
                              onClick={() => {
                                const num = Number(sid);
                                setSelectedSizes((prev) => {
                                  if (prev.includes(num)) {
                                    if (prev.length === 1) return prev; // keep at least 1 size
                                    const next = prev.filter((x) => x !== num);
                                    if (selectedSize === num) setSelectedSize(next[0]);
                                    return next;
                                  }
                                  return [...prev, num];
                                });
                                setSelectedSize(num);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-2xs ${
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              {isSelected && <Check className="size-3.5" />}
                              <span>{label}</span>
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">Standard Universal Fit</span>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="slogan" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold italic">Design Slogan</label>
                      <Input
    placeholder="Type your slogan here..."
    value={slogan}
    onChange={(e) => setActiveState({ slogan: e.target.value })}
    className="bg-muted/30 focus-visible:ring-indigo-500 h-12"
  />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold italic">Text Color</label>
                        <div className="flex items-center gap-3">
                          <input type="color" value={color} onChange={(e) => setActiveState({ color: e.target.value })} className="size-10 p-0.5 rounded-lg border cursor-pointer overflow-hidden bg-white" />
                          <span className="text-xs font-mono text-muted-foreground uppercase">{color}</span>
                        </div>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button variant="outline" size="sm" onClick={() => setActiveState({ slogan: "" })} className="text-xs">Clear Text</Button>
                      </div>
                    </div>

                    {slogan && <div className="space-y-6 pt-4 border-t">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Font Size</span>
                            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{textSize}px</span>
                          </div>
                          <input type="range" min={8} max={200} value={textSize} onChange={(e) => setActiveState({ textSize: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rotation</span>
                            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{textRotation}°</span>
                          </div>
                          <input type="range" min={0} max={360} value={textRotation} onChange={(e) => setActiveState({ textRotation: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                        </div>
                      </div>}
                  </div>
                </TabsContent>

                <TabsContent value="logo" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold italic">Upload Art or Logo</label>
                      <div className="flex items-center justify-center border-2 border-dashed border-border/60 rounded-xl p-8 bg-muted/20 hover:bg-muted/30 transition-colors group">
                        <label className="cursor-pointer flex flex-col items-center gap-3 w-full h-full">
                          <input type="file" accept="image/*" onChange={async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (!result) return;
      try {
        const res = await fetch("/api/assets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({ dataUrl: result, filename: f.name })
        });
        if (res.ok) {
          const js = await res.json();
          const url = js?.url || `/attached_assets/${js?.filename}`;
          setActiveState({ image: url });
          toast({ title: "Image Uploaded", description: `${f.name} has been added successfully.` });
          return;
        }
      } catch (err) {
      }
      setActiveState({ image: result });
    };
    reader.readAsDataURL(f);
  }} className="hidden" />
                          <div className="size-12 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border">
                            <ImageIcon className="size-6 text-indigo-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">Click to browse</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG or SVG up to 5MB</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {image && <div className="space-y-6 pt-4 border-t">
                        <div className="flex gap-4">
                          <div className="size-24 rounded-lg border bg-white p-2 flex items-center justify-center shadow-sm flex-shrink-0">
                            <img src={image} alt="logo preview" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="flex-grow space-y-4">
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Size Scale</span>
                                <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{imageScale}%</span>
                              </div>
                              <input type="range" min={1} max={100} value={imageScale} onChange={(e) => setActiveState({ imageScale: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rotation</span>
                                <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{imageRotation}°</span>
                              </div>
                              <input type="range" min={0} max={360} value={imageRotation} onChange={(e) => setActiveState({ imageRotation: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <Button variant="outline" size="sm" onClick={() => setActiveState({ image: null })} className="text-xs flex-grow text-red-600 hover:text-red-700 hover:bg-red-50">Remove</Button>
                              <Button variant="ghost" size="sm" onClick={() => setActiveState({ imageScale: 100, imageRotation: 0, imagePosition: { x: 180, y: 180 } })} className="text-xs">Reset</Button>
                            </div>
                          </div>
                        </div>
                      </div>}
                  </div>
                </TabsContent>

                <TabsContent value="price" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100/50 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold italic text-indigo-900">Retail Price (for your Listing)</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-indigo-600/60" />
                        <Input
    type="number"
    step="0.01"
    value={priceInput}
    onChange={(e) => setPriceInput(Number(e.target.value) || 0)}
    className="pl-9 bg-white border-indigo-200 focus-visible:ring-indigo-500 h-12 text-lg font-semibold"
  />
                      </div>
                      <p className="text-[10px] text-indigo-600/80 italic font-medium">This is the price your customers will see on your storefront.</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {
    /* Right column: 3D Preview */
  }
        <div className="lg:col-span-7 space-y-6">
          <div className="relative aspect-square w-full max-w-2xl mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100 border-8 border-white bg-slate-100 flex items-center justify-center">
            <DesignCanvas
    side={side}
    slogan={slogan}
    color={color}
    template={template || product.template || "tshirt"}
    templateImage={templateImage || void 0}
    showTemplate={true}
    templateColor={templateColor}
    imageTintColor={imageTintColor || void 0}
    tintImage={false}
    forceTemplateFill={false}
    textSize={textSize}
    textRotation={textRotation}
    textPosition={textPosition}
    onTextMove={(pos) => setActiveState({ textPosition: pos })}
    image={image}
    imageScale={imageScale / 100}
    imageRotation={imageRotation}
    imagePosition={imagePosition}
    onImageMove={(pos) => setActiveState({ imagePosition: pos })}
    width={640}
    height={640}
  />
            
            {
    /* Design tools Overlay */
  }
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-xl border border-white/20 p-2 rounded-full shadow-lg">
              <Badge variant="secondary" className="bg-indigo-600 text-white border-none py-1.5 px-4 shadow-sm select-none">
                Interactive Preview
              </Badge>
              <div className="flex items-center gap-1.5 pr-2">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-600 select-none">Live Sync</span>
              </div>
            </div>
            
            {
    /* Zoom / Hint indicator */
  }
            <div className="absolute top-6 right-6 p-3 rounded-2xl bg-white/80 backdrop-blur-md shadow-sm border border-white flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-tighter text-indigo-600">Hint</span>
              <p className="text-[8px] italic text-slate-500 max-w-[60px] text-center leading-tight">Drag items to reposition</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-indigo-400" />
              <span>Base Template: <span className="font-semibold text-slate-700 capitalize">{product?.template || "Default"}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-indigo-400" />
              <span>Active Side: <span className="font-semibold text-slate-700 capitalize">{side}</span></span>
            </div>
          </div>
        </div>
      </div>

      {
    /* Hidden canvases for exporting front/back previews */
  }
      <div aria-hidden className="invisible pointer-events-none fixed top-[-1000px] left-[-1000px]">
        <DesignCanvas
    side={"front"}
    slogan={frontState.slogan}
    color={frontState.color}
    template={frontState.template || product?.template}
    templateImage={frontState.templateImage || void 0}
    showTemplate={true}
    templateColor={frontState.templateColor}
    imageTintColor={frontState.imageTintColor || void 0}
    tintImage={false}
    forceTemplateFill={false}
    textSize={frontState.textSize}
    textRotation={frontState.textRotation}
    textPosition={frontState.textPosition}
    image={frontState.image}
    imageScale={frontState.imageScale / 100}
    imageRotation={frontState.imageRotation}
    imagePosition={frontState.imagePosition}
    width={520}
    height={520}
    exportCanvasRef={frontExportRef}
  />
        <DesignCanvas
    side={"back"}
    slogan={backState.slogan}
    color={backState.color}
    template={backState.template || product?.template}
    templateImage={backState.templateImage || void 0}
    showTemplate={true}
    templateColor={backState.templateColor}
    imageTintColor={backState.imageTintColor || void 0}
    tintImage={false}
    forceTemplateFill={false}
    textSize={backState.textSize}
    textRotation={backState.textRotation}
    textPosition={backState.textPosition}
    image={backState.image}
    imageScale={backState.imageScale / 100}
    imageRotation={backState.imageRotation}
    imagePosition={backState.imagePosition}
    width={520}
    height={520}
    exportCanvasRef={backExportRef}
  />
      </div>

      {versions && <Card className="mt-8 border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Debug: Design Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-[10px] font-mono bg-white p-4 rounded-lg overflow-auto max-h-[300px] shadow-inner border leading-relaxed">
              {JSON.stringify(versions, null, 2)}
            </pre>
          </CardContent>
        </Card>}
    </div>
  );
}
