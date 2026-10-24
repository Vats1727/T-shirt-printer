import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Search,
  LayoutTemplate,
  Calendar,
  User,
  Mail,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Palette,
  Ruler
} from "lucide-react";
import { format } from "date-fns";
import { getMaskedCode, decodeId } from "@/utils/idEncoder";

export default function DesignerDesigns() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();

  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSide, setSelectedSide] = useState({}); // { [designId]: 'front' | 'back' }
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Modal Preview States (matching Designer's SavedDesigns preview)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDesign, setActiveDesign] = useState(null);
  const [previewSide, setPreviewSide] = useState("front");
  const [previewColor, setPreviewColor] = useState(null);

  // Query parameter for designerId (handles both encoded and raw)
  const searchParams = new URLSearchParams(window.location.search);
  const rawDesignerId = searchParams.get("designerId");
  const filterDesignerId = rawDesignerId ? (decodeId(rawDesignerId) || rawDesignerId) : null;

  useEffect(() => {
    fetchDesigns();
  }, [token]);

  async function fetchDesigns() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/designer-designs", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load designer creations");
      const data = await res.json();
      setDesigns(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Failed to load designs");
    } finally {
      setLoading(false);
    }
  }

  const normalizeImage = (img) => {
    if (!img) return null;
    img = String(img);
    if (img.startsWith("data:") || img.startsWith("http") || img.startsWith("/")) return img;
    return `/uploads/${img}`;
  };

  const openPreview = (design) => {
    setActiveDesign(design);
    setPreviewSide("front");
    const meta = design.version?.metadata || {};
    const featured = meta.featured_color;
    if (featured && (featured.hex || featured.id)) {
      setPreviewColor(featured.hex || featured.id);
    } else {
      const colors = meta.selected_colors || [];
      setPreviewColor(colors.length > 0 ? colors[0].hex || colors[0].id : "#ffffff");
    }
    setDialogOpen(true);
  };

  const copyDesignData = (design) => {
    const dataToCopy = {
      code: getMaskedCode(design.id, "DSG"),
      designer: {
        name: design.designer_name || "Designer",
        email: design.designer_email
      },
      product: design.product_name || design.product || "t-shirt",
      sides: design.version?.sides ? JSON.parse(JSON.stringify(design.version.sides)) : [],
      metadata: design.version?.metadata || {}
    };
    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
    setCopiedId(design.id);
    toast({
      title: "Design Data Copied",
      description: `Copied JSON specifications for ${getMaskedCode(design.id, "DSG")}.`
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllData = () => {
    if (!designs || designs.length === 0) {
      toast({
        title: "No Designs",
        description: "There are no designs available to copy.",
        variant: "destructive"
      });
      return;
    }
    const allData = filteredDesigns.map((design) => ({
      code: getMaskedCode(design.id, "DSG"),
      designer: {
        name: design.designer_name || "Designer",
        email: design.designer_email
      },
      product: design.product_name || design.product || "t-shirt",
      sides: design.version?.sides ? JSON.parse(JSON.stringify(design.version.sides)) : [],
      metadata: design.version?.metadata || {}
    }));
    navigator.clipboard.writeText(JSON.stringify(allData, null, 2));
    setCopiedAll(true);
    toast({
      title: "All Designs Copied",
      description: `Copied specifications for ${allData.length} designer creations.`
    });
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const filteredDesigns = designs.filter((d) => {
    if (filterDesignerId && String(d.owner_id) !== String(filterDesignerId)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const prodName = (d.product_name || d.product || "").toLowerCase();
    const desName = (d.designer_name || "").toLowerCase();
    const desEmail = (d.designer_email || "").toLowerCase();
    const slogan = (d.slogan || "").toLowerCase();
    const code = (d.design_code || "").toLowerCase();
    return prodName.includes(q) || desName.includes(q) || desEmail.includes(q) || slogan.includes(q) || code.includes(q);
  });

  const getPreviewImage = (d, side = "front") => {
    const meta = d.version?.metadata || {};
    if (side === "front" && meta.preview_front) return normalizeImage(meta.preview_front);
    if (side === "back" && meta.preview_back) return normalizeImage(meta.preview_back);

    // Check version sides
    const sides = d.version?.sides || [];
    const sideObj = sides.find((s) => (s.name || "").toLowerCase() === side);
    const imgLayer = sideObj?.layers?.find((l) => l.type === "image");
    if (imgLayer?.asset?.url) return normalizeImage(imgLayer.asset.url);
    if (imgLayer?.asset?.dataUrl) return normalizeImage(imgLayer.asset.dataUrl);

    if (side === "front" && d.image) return normalizeImage(d.image);
    if (side === "back" && d.back_image) return normalizeImage(d.back_image);

    return null;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <button
            onClick={() => setLocation("/admin/designers")}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Associated Designers
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
              <LayoutTemplate className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Designer Creations
              </h1>
              <p className="text-slate-500 mt-0.5 text-sm">
                Explore custom designs created by your associated designers on your blank garments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {filterDesignerId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.history.replaceState({}, "", "/admin/designer-designs");
                window.location.reload();
              }}
              className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              Clear Designer Filter
            </Button>
          )}

          {designs.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={copyAllData}
              className="h-10 text-xs bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            >
              {copiedAll ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copiedAll ? "Copied All!" : "Copy All Data"}
            </Button>
          )}

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search design, product or designer..."
              className="pl-9 h-10 bg-white border-slate-200 text-xs rounded-xl shadow-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDesigns}
            disabled={loading}
            className="h-10 px-3 text-xs border-slate-200 shadow-xs"
            title="Refresh creations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : error ? (
        <div className="p-12 text-center bg-rose-50 border border-rose-200 rounded-2xl">
          <p className="text-rose-700 font-semibold text-sm">{error}</p>
          <Button variant="outline" className="mt-4 border-rose-300 text-rose-800" onClick={fetchDesigns}>
            Try Again
          </Button>
        </div>
      ) : filteredDesigns.length === 0 ? (
        <Card className="bg-white border-dashed border-2 py-20">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <Sparkles className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No Saved Designs Found</h3>
            <p className="text-slate-500 text-xs max-w-sm mx-auto mt-2">
              When designers select your print hub and save designs on your blank garments, their creations will automatically appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDesigns.map((d) => {
            const meta = d.version?.metadata || {};
            const activeSide = selectedSide[d.id] || "front";
            const currentPreview = getPreviewImage(d, activeSide);
            const garmentColor = d.template_color || d.color || "#ffffff";
            const selectedColors = meta.selected_colors || [];
            const selectedSizes = meta.selected_sizes || [];

            return (
              <Card
                key={d.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white flex flex-col"
              >
                {/* Visual Canvas / Preview Area (Matching Designer Studio) */}
                <div className="relative aspect-square w-full bg-[#f8f9fa] overflow-hidden flex items-center justify-center">
                  {currentPreview ? (
                    <img
                      src={currentPreview}
                      alt={d.product_name || "Design Preview"}
                      onError={(e) => {
                        if (e.currentTarget.dataset.retried) return;
                        e.currentTarget.dataset.retried = "true";
                        if (currentPreview.startsWith("/uploads/")) {
                          e.currentTarget.src = currentPreview.replace("/uploads/", "/attached_assets/");
                        } else if (currentPreview.startsWith("/attached_assets/")) {
                          e.currentTarget.src = currentPreview.replace("/attached_assets/", "/uploads/");
                        }
                      }}
                      className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                      <DesignCanvas
                        side={activeSide}
                        width={220}
                        height={220}
                        slogan={(() => {
                          const v2Slogan = d.version?.sides?.find((s) => s.name === activeSide)?.layers?.find((l) => l.type === "text")?.text;
                          return v2Slogan || (activeSide === "front" ? d.slogan : d.back_slogan) || "";
                        })()}
                        color={(() => {
                          const v2Color = d.version?.sides?.find((s) => s.name === activeSide)?.layers?.find((l) => l.type === "text")?.color;
                          return v2Color || d.color || "#000000";
                        })()}
                        image={(() => {
                          const sideData = d.version?.sides?.find((s) => s.name === activeSide);
                          const imgLayer = sideData?.layers?.find((l) => l.type === "image");
                          return imgLayer?.asset?.url || imgLayer?.asset?.dataUrl || (activeSide === "front" ? d.image : d.back_image) || null;
                        })()}
                        imageScale={1}
                        template={d.template || "tshirt"}
                        templateColor={garmentColor}
                        showTemplate={true}
                      />
                    </div>
                  )}

                  {/* Side Switcher Pills on the Card */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex rounded-full bg-white/90 backdrop-blur-md p-1 shadow-md border border-slate-200/60 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSide((prev) => ({ ...prev, [d.id]: "front" }));
                      }}
                      className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                        activeSide === "front"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSide((prev) => ({ ...prev, [d.id]: "back" }));
                      }}
                      className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                        activeSide === "back"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Back
                    </button>
                  </div>

                  {/* Garment Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <Badge variant="secondary" className="bg-white/90 backdrop-blur-md text-slate-700 text-[11px] font-semibold shadow-xs">
                      {d.product_name || d.product || "Blank Garment"}
                    </Badge>
                  </div>

                  {/* Hover Overlay with Preview Button (Matching SavedDesigns) */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 backdrop-blur-[2px] z-20">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full shadow-lg text-xs font-bold px-4 bg-white hover:bg-slate-100 text-slate-900"
                      onClick={() => openPreview(d)}
                    >
                      <Eye className="h-4 w-4 mr-1.5 text-indigo-600" /> Preview Details
                    </Button>
                  </div>
                </div>

                {/* Card Content & Details */}
                <CardContent className="p-4 flex-grow flex flex-col justify-between space-y-3">
                  <div>
                    <div className="mb-1.5">
                      <h3 className="font-bold text-slate-800 text-sm line-clamp-1">
                        {d.slogan ? `"${d.slogan}"` : d.product_name || "Custom Design"}
                      </h3>
                    </div>

                    {/* Designer Details Banner */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-medium text-slate-500">
                          <User className="w-3 h-3 text-indigo-500" /> Designer:
                        </span>
                        <span className="font-bold text-slate-800 truncate max-w-[130px]">
                          {d.designer_name || "Associated Designer"}
                        </span>
                      </div>
                      {d.designer_email && (
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="flex items-center gap-1 font-medium">
                            <Mail className="w-3 h-3 text-slate-400" /> Contact:
                          </span>
                          <span className="font-mono text-[10px] text-slate-600 truncate max-w-[130px]">
                            {d.designer_email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Colors & Sizes Row */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    {/* Selected Colors Dots */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Palette className="w-3 h-3 text-slate-400" /> Colors:
                      </span>
                      <div className="flex items-center -space-x-1">
                        {selectedColors.length > 0 ? (
                          <>
                            {selectedColors.slice(0, 5).map((c, i) => (
                              <div
                                key={i}
                                className="w-4 h-4 rounded-full border-2 border-white shadow-xs"
                                style={{ backgroundColor: c.hex || "#ddd" }}
                                title={c.name || c.hex}
                              />
                            ))}
                            {selectedColors.length > 5 && (
                              <div className="w-4 h-4 rounded-full border-2 border-white shadow-xs bg-slate-100 flex items-center justify-center text-[7px] font-bold text-slate-600">
                                +{selectedColors.length - 5}
                              </div>
                            )}
                          </>
                        ) : (
                          <div
                            className="w-4 h-4 rounded-full border-2 border-white shadow-xs"
                            style={{ backgroundColor: garmentColor }}
                            title={garmentColor}
                          />
                        )}
                      </div>
                    </div>

                    {/* Selected Sizes Chips */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-slate-400" /> Sizes:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {selectedSizes.length > 0 ? (
                          selectedSizes.slice(0, 4).map((s, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"
                            >
                              {s.label || s.size || s.id}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Standard</span>
                        )}
                        {selectedSizes.length > 4 && (
                          <span className="text-[9px] font-bold text-indigo-600">
                            +{selectedSizes.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Card Footer: Quick Actions */}
                <CardFooter className="p-3 pt-0 border-t border-slate-50 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[11px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    onClick={() => copyDesignData(d)}
                  >
                    {copiedId === d.id ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Copy Data
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full Preview Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl max-h-[90vh]">
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px] h-[85vh] max-h-[750px]">
            {/* Left side: Canvas & Multi-color Preview (7 cols on desktop) */}
            <div className="md:col-span-7 bg-slate-50 flex items-center justify-center relative p-6 border-b md:border-b-0 md:border-r border-slate-100 min-h-[380px] overflow-hidden">
              {/* Front/Back Pills */}
              <div className="absolute top-4 left-4 z-20 flex gap-1 p-1 bg-white/95 backdrop-blur-md rounded-lg shadow-sm border border-slate-200">
                <Button
                  size="sm"
                  variant={previewSide === "front" ? "default" : "ghost"}
                  className={`h-8 px-4 rounded-md text-xs font-bold transition-all ${
                    previewSide === "front"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  onClick={() => setPreviewSide("front")}
                >
                  Front
                </Button>
                <Button
                  size="sm"
                  variant={previewSide === "back" ? "default" : "ghost"}
                  className={`h-8 px-4 rounded-md text-xs font-bold transition-all ${
                    previewSide === "back"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  onClick={() => setPreviewSide("back")}
                >
                  Back
                </Button>
              </div>

              {/* Garment Image / Interactive Canvas Container */}
              <div className="w-full h-full flex items-center justify-center p-4">
                {activeDesign && (() => {
                  const meta = activeDesign.version?.metadata || {};
                  const mapping = meta.preview_by_color || [];
                  const chosen = previewColor
                    ? mapping.find(
                        (m) =>
                          (m.id && String(m.id) === String(previewColor)) ||
                          (m.hex && String(m.hex).toLowerCase() === String(previewColor).toLowerCase())
                      )
                    : null;

                  const preRendered = chosen
                    ? previewSide === "front"
                      ? chosen.preview_front || chosen.front
                      : chosen.preview_back || chosen.back
                    : previewSide === "front"
                    ? meta.preview_front || activeDesign.image
                    : meta.preview_back || activeDesign.back_image;

                  const normalizedPreRendered = normalizeImage(preRendered);

                  if (normalizedPreRendered) {
                    return (
                      <img
                        src={normalizedPreRendered}
                        className="max-h-[480px] max-w-full w-auto h-auto object-contain filter drop-shadow-md select-none transition-all duration-300"
                        alt="Preview"
                        onError={(e) => {
                          if (e.currentTarget.dataset.retried) return;
                          e.currentTarget.dataset.retried = "true";
                          if (normalizedPreRendered.startsWith("/uploads/")) {
                            e.currentTarget.src = normalizedPreRendered.replace("/uploads/", "/attached_assets/");
                          } else if (normalizedPreRendered.startsWith("/attached_assets/")) {
                            e.currentTarget.src = normalizedPreRendered.replace("/attached_assets/", "/uploads/");
                          }
                        }}
                      />
                    );
                  }

                  return (
                    <DesignCanvas
                      side={previewSide}
                      width={460}
                      height={460}
                      slogan={(() => {
                        const v2Slogan = activeDesign.version?.sides
                          ?.find((s) => s.name === previewSide)
                          ?.layers?.find((l) => l.type === "text")?.text;
                        return (
                          v2Slogan ||
                          (previewSide === "front" ? activeDesign.slogan : activeDesign.back_slogan) ||
                          ""
                        );
                      })()}
                      color={(() => {
                        const v2Color = activeDesign.version?.sides
                          ?.find((s) => s.name === previewSide)
                          ?.layers?.find((l) => l.type === "text")?.color;
                        return v2Color || activeDesign.color || "#000000";
                      })()}
                      template={activeDesign.template || "tshirt"}
                      templateColor={previewColor || activeDesign.templateColor || "#ffffff"}
                      showTemplate={true}
                      imageTintColor={previewColor || undefined}
                      tintImage={true}
                      image={(() => {
                        const sideData = activeDesign.version?.sides?.find((s) => s.name === previewSide);
                        const imgLayer = sideData?.layers?.find((l) => l.type === "image");
                        let v2Image = imgLayer?.asset?.url || imgLayer?.asset?.dataUrl || null;
                        if (!v2Image && imgLayer?.asset?.asset_id) {
                          v2Image = `/api/assets/${imgLayer.asset.asset_id}`;
                        }
                        return (
                          v2Image ||
                          (previewSide === "front" ? activeDesign.image : activeDesign.back_image) ||
                          null
                        );
                      })()}
                      imageScale={(() => {
                        const v2Scale = activeDesign.version?.sides
                          ?.find((s) => s.name === previewSide)
                          ?.layers?.find((l) => l.type === "image")?.scale;
                        if (typeof v2Scale === "number") return v2Scale;
                        const legacyScale =
                          previewSide === "front" ? activeDesign.imageScale : activeDesign.back_image_scale;
                        return typeof legacyScale === "number" ? legacyScale / 100 : 1;
                      })()}
                      imageRotation={(() => {
                        const v2Rot = activeDesign.version?.sides
                          ?.find((s) => s.name === previewSide)
                          ?.layers?.find((l) => l.type === "image")?.rotation;
                        if (typeof v2Rot === "number") return v2Rot;
                        return (
                          (previewSide === "front"
                            ? activeDesign.imageRotation
                            : activeDesign.back_image_rotation) || 0
                        );
                      })()}
                      imagePosition={(() => {
                        const v2Pos = activeDesign.version?.sides
                          ?.find((s) => s.name === previewSide)
                          ?.layers?.find((l) => l.type === "image")?.position;
                        return (
                          v2Pos ||
                          (previewSide === "front"
                            ? activeDesign.imagePosition
                            : activeDesign.back_image_position) || { x: 150, y: 150 }
                        );
                      })()}
                    />
                  );
                })()}
              </div>
            </div>

            {/* Right side: Detailed Specs & Designer Attribution (5 cols on desktop) */}
            <div className="md:col-span-5 bg-white flex flex-col p-6 overflow-y-auto max-h-full">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    Designer Creation
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">
                  {activeDesign?.slogan ? `"${activeDesign.slogan}"` : activeDesign?.product_name || activeDesign?.product || "Custom Design"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Garment: <span className="font-semibold text-slate-700">{activeDesign?.product_name || activeDesign?.product || "T-Shirt"}</span>
                </p>
              </div>

              {/* Designer Card */}
              <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-slate-500">
                    <User className="w-3.5 h-3.5 text-indigo-500" /> Designer:
                  </span>
                  <span className="font-bold text-slate-900">
                    {activeDesign?.designer_name || "Associated Designer"}
                  </span>
                </div>
                {activeDesign?.designer_email && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Contact:
                    </span>
                    <span className="font-mono text-[11px] text-slate-700 truncate max-w-[170px]">
                      {activeDesign.designer_email}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Saved On:
                  </span>
                  <span className="text-slate-700">
                    {activeDesign?.created_at
                      ? format(new Date(activeDesign.created_at), "MMM dd, yyyy")
                      : "Recently"}
                  </span>
                </div>
              </div>

              {/* Interactive Color Switcher */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-500" /> Configured Colors
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {(activeDesign?.version?.metadata?.selected_colors || []).length > 0 ? (
                    activeDesign.version.metadata.selected_colors.map((c, i) => {
                      const isSelected =
                        String(previewColor).toLowerCase() === String(c.hex || c.id).toLowerCase();
                      return (
                        <button
                          key={i}
                          className={`w-9 h-9 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                            isSelected
                              ? "border-indigo-600 ring-2 ring-indigo-200 scale-110 shadow-md"
                              : "border-slate-200 hover:border-slate-400 shadow-2xs"
                          }`}
                          style={{ backgroundColor: c.hex || "#ddd" }}
                          onClick={() => setPreviewColor(c.hex || c.id)}
                          title={`${c.name || "Color"} (${c.hex})`}
                        >
                          {isSelected && (
                            <Check
                              className={`w-4 h-4 ${
                                c.hex === "#ffffff" || c.hex === "#FFFFFF"
                                  ? "text-slate-900"
                                  : "text-white"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <button
                      className="w-9 h-9 rounded-full border-2 border-indigo-600 ring-2 ring-indigo-200 shadow-md"
                      style={{ backgroundColor: activeDesign?.template_color || "#ffffff" }}
                      title="Default Garment Color"
                    />
                  )}
                </div>
              </div>

              {/* Configured Sizes */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-indigo-500" /> Selected Sizes
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(activeDesign?.version?.metadata?.selected_sizes || []).length > 0 ? (
                    activeDesign.version.metadata.selected_sizes.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 text-indigo-500" />
                        {s.label || s.size || s.id}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">All standard sizes available</span>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-auto space-y-2 pt-4 border-t border-slate-100">
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 text-xs font-bold shadow-sm"
                  onClick={() => copyDesignData(activeDesign)}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy Full Design Specifications
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" className="w-full h-10 text-xs font-semibold text-slate-500">
                    Close Preview
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
