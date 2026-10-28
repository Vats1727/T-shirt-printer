import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import { useLocation } from "wouter";
import {
  Trash2,
  Eye,
  Copy,
  Check,
  Search,
  RefreshCw,
  Plus,
  LayoutTemplate,
  Sparkles,
  Palette,
  Ruler,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { decodeId, getMaskedCode } from "@/utils/idEncoder";
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
import { cn } from "@/utils/cn";

export default function SavedDesignsPage({ params }) {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const rawDesignerId = params?.designerId;
  const designerIdToLoad = rawDesignerId ? decodeId(rawDesignerId) || rawDesignerId : undefined;

  const [designs, setDesigns] = useState([]);
  const [deletingIds, setDeletingIds] = useState([]);
  const [designToDelete, setDesignToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSide, setSelectedSide] = useState({});

  // Preview Modal States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDesign, setActiveDesign] = useState(null);
  const [previewSide, setPreviewSide] = useState("front");
  const [previewColor, setPreviewColor] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      let url = "/api/designs";
      if (designerIdToLoad) {
        url += `?userId=${designerIdToLoad}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to fetch designs");
      const data = await res.json();
      setDesigns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[SavedDesigns] fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, [token]);

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

  const copyLink = (design) => {
    const dataToCopy = {
      code: getMaskedCode(design.id, "DSG"),
      product: design.product || "t-shirt",
      sides: design.version?.sides ? JSON.parse(JSON.stringify(design.version.sides)) : [],
      metadata: design.version?.metadata || {}
    };
    const jsonString = JSON.stringify(dataToCopy, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopiedId(design.id);
    toast({
      title: "Design Copied",
      description: "JSON specification copied to clipboard."
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllData = () => {
    if (!designs || designs.length === 0) {
      toast({
        title: "No Designs",
        description: "You have no saved designs to copy.",
        variant: "destructive"
      });
      return;
    }
    const allData = filteredDesigns.map((design) => ({
      code: getMaskedCode(design.id, "DSG"),
      product: design.product || "t-shirt",
      sides: design.version?.sides ? JSON.parse(JSON.stringify(design.version.sides)) : [],
      metadata: design.version?.metadata || {}
    }));
    navigator.clipboard.writeText(JSON.stringify(allData, null, 2));
    setCopiedAll(true);
    toast({
      title: "All Designs Copied",
      description: `Copied ${allData.length} design specifications.`
    });
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const executeDeleteDesign = async (id) => {
    setDeletingIds((prev) => [...prev, id]);
    try {
      const res = await fetch(`/api/designs/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        setDesigns((prev) => prev.filter((d) => d.id !== id));
        toast({
          title: "Design Deleted",
          description: "The custom design has been removed from your library."
        });
      } else {
        throw new Error("Failed to delete design");
      }
    } catch (e) {
      toast({
        title: "Delete Failed",
        description: e?.message || "Error deleting design.",
        variant: "destructive"
      });
    } finally {
      setDeletingIds((prev) => prev.filter((dId) => dId !== id));
      setDesignToDelete(null);
    }
  };

  const getPreviewImage = (d, side = "front") => {
    const meta = d.version?.metadata || {};
    if (side === "front" && meta.preview_front) return normalizeImage(meta.preview_front);
    if (side === "back" && meta.preview_back) return normalizeImage(meta.preview_back);

    const sides = d.version?.sides || [];
    const sideObj = sides.find((s) => (s.name || "").toLowerCase() === side);
    const imgLayer = sideObj?.layers?.find((l) => l.type === "image");
    if (imgLayer?.asset?.url) return normalizeImage(imgLayer.asset.url);
    if (imgLayer?.asset?.dataUrl) return normalizeImage(imgLayer.asset.dataUrl);

    if (side === "front" && d.image) return normalizeImage(d.image);
    if (side === "back" && d.back_image) return normalizeImage(d.back_image);

    return null;
  };

  const filteredDesigns = designs.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const prod = (d.product || "").toLowerCase();
    const slogan = (d.slogan || "").toLowerCase();
    const code = getMaskedCode(d.id, "DSG").toLowerCase();
    return prod.includes(q) || slogan.includes(q) || code.includes(q);
  });

  return (
    <div className="w-full space-y-4 pb-12 animate-in fade-in duration-300">
      {/* Streamlined Toolbar Row */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-medium px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 text-base">Saved Designs Library</span>
            <span className="text-slate-400 font-semibold">({filteredDesigns.length})</span>
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
                placeholder="Search design, garment..."
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

            <Button
              size="sm"
              onClick={() => setLocation("/supplier/dashboard")}
              className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Design
            </Button>
          </div>
        </div>

        {/* Designs Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-72 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredDesigns.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white max-w-md mx-auto my-6">
            <LayoutTemplate className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800 mb-1">No Saved Designs Found</h3>
            <p className="text-xs text-slate-500 mb-5">
              {searchQuery
                ? `No custom designs match "${searchQuery}".`
                : "Select a blank garment from your print provider catalog to start designing."}
            </p>
            <Button
              onClick={() => setLocation("/supplier/dashboard")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs rounded-xl h-9 text-xs font-semibold px-4 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Design
            </Button>
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
                        {d.product || "Garment"}
                      </Badge>
                    </div>

                    {/* Preview Image / Fallback Canvas */}
                    {currentPreview ? (
                      <img
                        src={currentPreview}
                        alt={d.slogan || "Custom Design"}
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
                          slogan={d.slogan || ""}
                          color={d.color || "#000000"}
                          image={d.image}
                          imageScale={(d.imageScale || 100) / 100}
                          template={d.template || "tshirt"}
                          templateColor={d.templateColor || garmentColor}
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
                        {d.slogan ? `"${d.slogan}"` : d.product || "Custom Design"}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Garment: <span className="font-semibold text-slate-600">{d.product || "T-Shirt"}</span>
                      </p>
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
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 shrink-0 shadow-2xs cursor-pointer"
                      onClick={() => copyLink(d)}
                      title="Copy design specifications JSON"
                    >
                      {copiedId === d.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 shrink-0 shadow-2xs cursor-pointer"
                      onClick={() => setDesignToDelete(d.id)}
                      disabled={deletingIds.includes(d.id)}
                      title="Delete design"
                    >
                      <Trash2 className="w-3 h-3" />
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
            {/* Left side: Canvas & Multi-color Preview */}
            <div className="md:col-span-7 bg-slate-50 flex items-center justify-center relative p-6 border-b md:border-b-0 md:border-r border-slate-100 min-h-[380px] overflow-hidden">
              <div className="absolute top-4 left-4 z-20 flex gap-1 p-1 bg-white/95 backdrop-blur-2xs rounded-lg shadow-xs border border-slate-200">
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

              {/* Garment Image / Interactive Canvas */}
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
                    />
                  );
                })()}
              </div>
            </div>

            {/* Right side: Detailed Specs */}
            <div className="md:col-span-5 bg-white flex flex-col p-6 overflow-y-auto max-h-full">
              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  Custom Creation
                </span>
                <h2 className="text-xl font-bold text-slate-900 leading-snug mt-2">
                  {activeDesign?.slogan ? `"${activeDesign.slogan}"` : activeDesign?.product || "Custom Design"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Garment Model: <span className="font-semibold text-slate-700">{activeDesign?.product || "T-Shirt"}</span>
                </p>
              </div>

              {/* Configured Colors */}
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
                    <span className="text-xs text-slate-500 italic">All standard sizes configured</span>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-auto space-y-2 pt-4 border-t border-slate-100">
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 text-xs font-bold shadow-xs cursor-pointer"
                  onClick={() => copyLink(activeDesign)}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy Full Design Specifications
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" className="w-full h-10 text-xs font-semibold text-slate-500 cursor-pointer">
                    Close Preview
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(designToDelete)}
        onOpenChange={(open) => !open && setDesignToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-6 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">
              Delete Saved Design?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              This action cannot be undone. This design will be permanently removed from your studio creations library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl h-9 text-xs font-semibold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 text-xs font-semibold"
              onClick={() => designToDelete && executeDeleteDesign(designToDelete)}
            >
              Delete Design
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
