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
  Ruler,
  Shirt,
  Store
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
    <div className="w-full space-y-4 pb-12 animate-in fade-in duration-300">
      {/* Creations Catalog Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-medium px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 text-base">Creations Showcase</span>
            <span className="text-slate-400 font-semibold">({filteredDesigns.length})</span>
            {filterDesignerId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold">
                Filtered by Designer
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px]">
                Search: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery("")}
                  className="hover:text-indigo-900 font-bold ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filterDesignerId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.history.replaceState({}, "", "/admin/designer-designs");
                  window.location.reload();
                }}
                className="h-8 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 rounded-lg shadow-2xs cursor-pointer"
              >
                Clear Filter
              </Button>
            )}

            {designs.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={copyAllData}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 shadow-xs rounded-lg cursor-pointer"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedAll ? "Copied All!" : "Copy All Data"}
              </Button>
            )}

            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search design, product..."
                className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg shadow-2xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchDesigns}
              disabled={loading}
              className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div
                key={i}
                className="h-72 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-rose-700 font-semibold text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-rose-300 text-rose-800 hover:bg-rose-100 rounded-lg text-xs"
              onClick={fetchDesigns}
            >
              Try Again
            </Button>
          </div>
        ) : filteredDesigns.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">No Saved Designs Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When designers select your print hub and save custom graphics on your blank garments, their creations will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {filteredDesigns.map((d) => {
              const meta = d.version?.metadata || {};
              const activeSide = selectedSide[d.id] || "front";
              const currentPreview = getPreviewImage(d, activeSide);
              const garmentColor = d.template_color || d.color || "#ffffff";
              const selectedColors = meta.selected_colors || [];
              const selectedSizes = meta.selected_sizes || [];

              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group"
                >
                  {/* Visual Canvas / Preview Area */}
                  <div className="relative h-44 sm:h-48 bg-slate-50/80 flex items-center justify-center p-3 border-b border-slate-100 overflow-hidden">
                    {/* Masked Code Badge */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/95 backdrop-blur-2xs text-slate-700 border border-slate-200 shadow-2xs">
                        {getMaskedCode(d.id, "DSG")}
                      </span>
                    </div>

                    {/* Garment Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <Badge
                        variant="secondary"
                        className="bg-white/95 backdrop-blur-2xs text-slate-700 text-[9px] font-bold px-1.5 py-0.5 border border-slate-200 shadow-2xs"
                      >
                        {d.product_name || d.product || "Garment"}
                      </Badge>
                    </div>

                    {/* Preview Image / Fallback Canvas */}
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
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2">
                        <DesignCanvas
                          side={activeSide}
                          width={170}
                          height={170}
                          slogan={(() => {
                            const v2Slogan = d.version?.sides
                              ?.find((s) => s.name === activeSide)
                              ?.layers?.find((l) => l.type === "text")?.text;
                            return (
                              v2Slogan ||
                              (activeSide === "front" ? d.slogan : d.back_slogan) ||
                              ""
                            );
                          })()}
                          color={(() => {
                            const v2Color = d.version?.sides
                              ?.find((s) => s.name === activeSide)
                              ?.layers?.find((l) => l.type === "text")?.color;
                            return v2Color || d.color || "#000000";
                          })()}
                          image={(() => {
                            const sideData = d.version?.sides?.find((s) => s.name === activeSide);
                            const imgLayer = sideData?.layers?.find((l) => l.type === "image");
                            return (
                              imgLayer?.asset?.url ||
                              imgLayer?.asset?.dataUrl ||
                              (activeSide === "front" ? d.image : d.back_image) ||
                              null
                            );
                          })()}
                          imageScale={1}
                          template={d.template || "tshirt"}
                          templateColor={garmentColor}
                          showTemplate={true}
                        />
                      </div>
                    )}

                    {/* Front / Back Switcher Pills */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex rounded-full bg-white/95 backdrop-blur-2xs p-0.5 shadow-2xs border border-slate-200 z-10 text-[9px] font-medium">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSide((prev) => ({ ...prev, [d.id]: "front" }));
                        }}
                        className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                          activeSide === "front"
                            ? "bg-indigo-600 text-white font-bold shadow-xs"
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
                        className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                          activeSide === "back"
                            ? "bg-indigo-600 text-white font-bold shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Back
                      </button>
                    </div>

                    {/* Hover Overlay with Preview Details Button */}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 backdrop-blur-[1px] z-20">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-lg shadow-md text-xs font-bold px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 cursor-pointer h-7"
                        onClick={() => openPreview(d)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Preview Details
                      </Button>
                    </div>
                  </div>

                  {/* Card Content & Details */}
                  <div className="p-3 flex-grow flex flex-col justify-between space-y-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs line-clamp-1">
                        {d.slogan ? `"${d.slogan}"` : d.product_name || "Custom Design"}
                      </h3>

                      {/* Designer Attribution Box */}
                      <div className="mt-2 p-2 bg-slate-50/80 rounded-lg border border-slate-100 text-[10px] space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 font-medium text-slate-500">
                            <User className="w-2.5 h-2.5 text-indigo-500" /> Designer:
                          </span>
                          <span className="font-bold text-slate-800 truncate max-w-[110px]">
                            {d.designer_name || "Associated Designer"}
                          </span>
                        </div>
                        {d.designer_email && (
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="flex items-center gap-1 font-medium">
                              <Mail className="w-2.5 h-2.5 text-slate-400" /> Contact:
                            </span>
                            <span className="font-mono text-[9px] text-slate-600 truncate max-w-[110px]">
                              {d.designer_email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Colors & Sizes Row */}
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-100 text-[10px]">
                      {/* Selected Colors */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500 flex items-center gap-1">
                          <Palette className="w-2.5 h-2.5 text-slate-400" /> Colors:
                        </span>
                        <div className="flex items-center -space-x-1">
                          {selectedColors.length > 0 ? (
                            <>
                              {selectedColors.slice(0, 5).map((c, i) => (
                                <div
                                  key={i}
                                  className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs"
                                  style={{ backgroundColor: c.hex || "#ddd" }}
                                  title={c.name || c.hex}
                                />
                              ))}
                              {selectedColors.length > 5 && (
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs bg-slate-100 flex items-center justify-center text-[7px] font-bold text-slate-600">
                                  +{selectedColors.length - 5}
                                </div>
                              )}
                            </>
                          ) : (
                            <div
                              className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs"
                              style={{ backgroundColor: garmentColor }}
                              title={garmentColor}
                            />
                          )}
                        </div>
                      </div>

                      {/* Selected Sizes */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500 flex items-center gap-1">
                          <Ruler className="w-2.5 h-2.5 text-slate-400" /> Sizes:
                        </span>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {selectedSizes.length > 0 ? (
                            selectedSizes.slice(0, 3).map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1 py-0.2 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"
                              >
                                {s.label || s.size || s.id}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">Standard</span>
                          )}
                          {selectedSizes.length > 3 && (
                            <span className="text-[8px] font-bold text-indigo-600">
                              +{selectedSizes.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Quick Actions */}
                  <div className="p-2.5 pt-0 border-t border-slate-100 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-[11px] font-semibold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100/80 border-indigo-200/60 rounded-lg shadow-2xs cursor-pointer"
                      onClick={() => openPreview(d)}
                    >
                      <Eye className="w-3 h-3 mr-1 text-indigo-600" /> Preview
                    </Button>

                    <Button
                      size="sm"
                      className="flex-1 h-7 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs gap-1 cursor-pointer"
                      onClick={() => setLocation(`/admin/listings/create?designId=${d.id}`)}
                      title="Sell this designer creation in your store"
                    >
                      <Store className="w-3 h-3" /> Sell in Store
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 text-xs font-bold shadow-sm gap-2"
                  onClick={() => {
                    setDialogOpen(false);
                    setLocation(`/admin/listings/create?designId=${activeDesign?.id}`);
                  }}
                >
                  <Store className="h-4 w-4" /> Publish / Sell in Facility Store
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-700 hover:text-indigo-600 h-10 text-xs font-semibold shadow-2xs"
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
