import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DesignCanvas } from "@/components/common/DesignCanvas";
import { useLocation } from "wouter";
import { Trash2, Eye, Copy, Check } from "lucide-react";
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
export default function SavedDesignsPage({ params }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const rawDesignerId = params?.designerId;
  const designerIdToLoad = rawDesignerId ? decodeId(rawDesignerId) || rawDesignerId : void 0;
  const [designs, setDesigns] = useState([]);
  const [deletingIds, setDeletingIds] = useState([]);
  const [designToDelete, setDesignToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDesign, setActiveDesign] = useState(null);
  const [previewSide, setPreviewSide] = useState("front");
  const [previewColor, setPreviewColor] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
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
      setDesigns(data || []);
    } catch (e) {
      console.error("[SavedDesigns] fetch error:", e);
    } finally {
      setLoading(true);
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchDesigns();
  }, [token]);
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
      sides: design.version?.sides ? JSON.parse(JSON.stringify(design.version.sides)) : [],
      product: design.product || "t-shirt",
      metadata: design.version?.metadata || {}
    };
    dataToCopy.sides.forEach((side) => {
      if (side.layers) {
        side.layers.forEach((layer) => {
          if (layer.type === "image" && layer.asset) {
            if (layer.asset.asset_id) {
              layer.asset.dataUrl = `/api/assets/${layer.asset.asset_id}`;
              delete layer.asset.url;
            } else if (layer.asset.dataUrl && layer.asset.dataUrl.startsWith("data:image")) {
            }
          }
        });
      }
    });
    const jsonString = JSON.stringify(dataToCopy, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopiedId(design.id);
    setTimeout(() => setCopiedId(null), 2e3);
  };
  const [copiedAll, setCopiedAll] = useState(false);
  const copyAllData = () => {
    if (!designs || designs.length === 0) {
      toast({
        title: "No Designs",
        description: "There are no designs available to copy.",
        variant: "destructive"
      });
      return;
    }
    const allData = designs.map((design) => {
      const dataToCopy = {
        sides: design.version?.sides ? JSON.parse(JSON.stringify(design.version.sides)) : [],
        product: design.product || "t-shirt",
        metadata: design.version?.metadata || {}
      };
      dataToCopy.sides.forEach((side) => {
        if (side.layers) {
          side.layers.forEach((layer) => {
            if (layer.type === "image" && layer.asset) {
              if (layer.asset.asset_id) {
                layer.asset.dataUrl = `/api/assets/${layer.asset.asset_id}`;
                delete layer.asset.url;
              }
            }
          });
        }
      });
      return dataToCopy;
    });
    const jsonString = JSON.stringify(allData, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopiedAll(true);
    toast({
      title: "Copied",
      description: "All designs copied to clipboard."
    });
    setTimeout(() => setCopiedAll(false), 2e3);
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
          description: "The design has been removed."
        });
      } else {
        toast({
          title: "Delete Failed",
          description: "Failed to delete design.",
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e?.message || "Error deleting design.",
        variant: "destructive"
      });
    } finally {
      setDeletingIds((prev) => prev.filter((dId) => dId !== id));
      setDesignToDelete(null);
    }
  };
  return <div className="min-h-screen bg-slate-50/50 p-8 pt-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
              Saved Designs
            </h1>
            <p className="text-slate-500">Manage and preview your custom creation library.</p>
          </div>
          <div className="flex items-center gap-3">
            {designs.length > 0 && <Button
    variant="default"
    className="bg-indigo-600 hover:bg-indigo-700"
    onClick={copyAllData}
  >
                {copiedAll ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedAll ? "Copied Everything!" : "Copy All Designs Data"}
              </Button>}
            <Button variant="outline" onClick={() => setLocation("/supplier/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {loading ? <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
            <p className="text-slate-500 font-medium">Loading your masterpieces...</p>
          </div> : designs.length === 0 ? <Card className="bg-white border-dashed border-2 py-20">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <Eye className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No designs found</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">
                You haven't saved any designs yet. Start creating in the product designer!
              </p>
              <Button className="mt-6 bg-sky-600 hover:bg-sky-700" onClick={() => setLocation("/supplier/dashboard")}>
                Create New Design
              </Button>
            </CardContent>
          </Card> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {designs.map((design) => {
    const normalizeImage = (img) => {
      if (!img) return null;
      img = String(img);
      if (img.startsWith("data:") || img.startsWith("http") || img.startsWith("/")) return img;
      return `/uploads/${img}`;
    };
    const meta = design.version?.metadata || {};
    const rawPreview = meta.preview_front || design.image || meta.preview_back || design.back_image || null;
    const previewImg = normalizeImage(rawPreview);
    return <Card key={design.id} className="group overflow-hidden border-slate-200 hover:border-sky-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white">
                  <div className="relative aspect-square bg-[#f8f9fa] overflow-hidden">
                    {previewImg ? <img
      src={previewImg}
      alt={design.slogan || "Custom Design"}
      onError={(e) => {
        if (e.currentTarget.dataset.retried) return;
        e.currentTarget.dataset.retried = "true";
        if (previewImg.startsWith('/uploads/')) {
          e.currentTarget.src = previewImg.replace('/uploads/', '/attached_assets/');
        } else if (previewImg.startsWith('/attached_assets/')) {
          e.currentTarget.src = previewImg.replace('/attached_assets/', '/uploads/');
        }
      }}
      className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
    /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                        <div className="bg-white/50 p-2 rounded-lg border border-slate-100">
                           <DesignCanvas
      side="front"
      width={200}
      height={200}
      slogan={design.slogan || ""}
      color={design.color || "#000000"}
      image={design.image}
      imageScale={(design.imageScale || 100) / 100}
      template={design.template || "tshirt"}
      templateColor={design.templateColor || "#ffffff"}
      showTemplate={true}
    />
                        </div>
                      </div>}
                    
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                      <Button
      size="sm"
      variant="secondary"
      className="rounded-full shadow-lg"
      onClick={() => openPreview(design)}
    >
                        <Eye className="h-4 w-4 mr-2" /> Preview
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800 line-clamp-1">{design.product || "Custom Design"}</h3>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{getMaskedCode(design.id, "DSG")}</p>
                      </div>
                      <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
      onClick={() => setDesignToDelete(design.id)}
      disabled={deletingIds.includes(design.id)}
    >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                      <div className="flex -space-x-1">
                        {(meta.selected_colors || []).slice(0, 4).map((c, i) => <div
      key={i}
      className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
      style={{ backgroundColor: c.hex || "#ddd" }}
      title={c.name}
    />)}
                        {(meta.selected_colors || []).length > 4 && <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                            +{(meta.selected_colors || []).length - 4}
                          </div>}
                      </div>
                      
                      <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-[10px] font-bold text-slate-400 hover:text-sky-600 transition-colors"
      onClick={() => copyLink(design)}
    >
                        {copiedId === design.id ? <><Check className="h-3 w-3 mr-1" /> Copied</> : <><Copy className="h-3 w-3 mr-1" /> Copy Data</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>;
  })}
          </div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl">
          <div className="flex flex-col md:flex-row h-[80vh] md:h-[70vh]">
            {
    /* Left side: Preview Canvas */
  }
            <div className="flex-1 bg-slate-50 flex items-center justify-center relative p-8">
              <div className="absolute top-4 left-4 z-10 flex gap-1 p-1 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-slate-200">
                <Button
    size="sm"
    variant={previewSide === "front" ? "default" : "ghost"}
    className="h-8 px-4 rounded-md text-xs font-bold"
    onClick={() => setPreviewSide("front")}
  >
                  Front
                </Button>
                <Button
    size="sm"
    variant={previewSide === "back" ? "default" : "ghost"}
    className="h-8 px-4 rounded-md text-xs font-bold"
    onClick={() => setPreviewSide("back")}
  >
                  Back
                </Button>
              </div>

              <div className="w-full h-full flex items-center justify-center overflow-hidden">
                {activeDesign && (() => {
    const meta = activeDesign.version?.metadata || {};
    const mapping = meta.preview_by_color || [];
    const chosen = previewColor ? mapping.find((m) => String(m.id) === String(previewColor) || String(m.hex) === String(previewColor)) : null;
    const preRendered = chosen ? previewSide === "front" ? chosen.preview_front || chosen.front : chosen.preview_back || chosen.back : null;
    const fallbackPreRendered = previewSide === "front" ? meta.preview_front || null : meta.preview_back || null;
    if (preRendered || fallbackPreRendered) {
      return <img src={preRendered || fallbackPreRendered} className="max-h-full max-w-full object-contain" alt="Preview" />;
    }
    return <DesignCanvas
      side={previewSide}
      width={600}
      height={600}
      slogan={(() => {
        const v2Slogan = activeDesign.version?.sides?.find((s) => s.name === previewSide)?.layers?.find((l) => l.type === "text")?.text;
        return v2Slogan || (previewSide === "front" ? activeDesign.slogan : activeDesign.back_slogan) || "";
      })()}
      color={(() => {
        const v2Color = activeDesign.version?.sides?.find((s) => s.name === previewSide)?.layers?.find((l) => l.type === "text")?.color;
        return v2Color || activeDesign.color || "#000000";
      })()}
      template={activeDesign.template || "tshirt"}
      templateColor={activeDesign.templateColor || "#ffffff"}
      showTemplate={true}
      imageTintColor={previewColor || void 0}
      tintImage={true}
      image={(() => {
        const sideData = activeDesign.version?.sides?.find((s) => s.name === previewSide);
        const imgLayer = sideData?.layers?.find((l) => l.type === "image");
        let v2Image = imgLayer?.asset?.url || imgLayer?.asset?.dataUrl || null;
        if (!v2Image && imgLayer?.asset?.asset_id) v2Image = `/api/assets/${imgLayer.asset.asset_id}`;
        return v2Image || (previewSide === "front" ? activeDesign.image : activeDesign.back_image) || null;
      })()}
      imageScale={(() => {
        const v2Scale = activeDesign.version?.sides?.find((s) => s.name === previewSide)?.layers?.find((l) => l.type === "image")?.scale;
        if (typeof v2Scale === "number") return v2Scale;
        const legacyScale = previewSide === "front" ? activeDesign.imageScale : activeDesign.back_image_scale;
        return typeof legacyScale === "number" ? legacyScale / 100 : 1;
      })()}
      imageRotation={(() => {
        const v2Rot = activeDesign.version?.sides?.find((s) => s.name === previewSide)?.layers?.find((l) => l.type === "image")?.rotation;
        if (typeof v2Rot === "number") return v2Rot;
        return (previewSide === "front" ? activeDesign.imageRotation : activeDesign.back_image_rotation) || 0;
      })()}
      imagePosition={(() => {
        const v2Pos = activeDesign.version?.sides?.find((s) => s.name === previewSide)?.layers?.find((l) => l.type === "image")?.position;
        return v2Pos || (previewSide === "front" ? activeDesign.imagePosition : activeDesign.back_image_position) || { x: 150, y: 150 };
      })()}
    />;
  })()}
              </div>
            </div>

            {
    /* Right side: Details & Controls */
  }
            <div className="w-full md:w-80 bg-white border-l border-slate-100 flex flex-col p-6">
              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Design Information</h3>
                <h2 className="text-xl font-bold text-slate-800">{activeDesign?.product || "Custom Design"}</h2>
                <p className="text-sm text-slate-500 mt-1">Code: {getMaskedCode(activeDesign?.id, "DSG")}</p>
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Available Colors</h3>
                <div className="flex flex-wrap gap-3">
                  {(activeDesign?.version?.metadata?.selected_colors || []).map((c, i) => <button
    key={i}
    className={`w-10 h-10 rounded-full border-2 transition-all duration-200 ${previewColor === (c.hex || c.id) ? "border-sky-500 ring-2 ring-sky-100 scale-110 shadow-md" : "border-slate-100 hover:border-slate-300"}`}
    style={{ backgroundColor: c.hex || "#ddd" }}
    onClick={() => setPreviewColor(c.hex || c.id)}
    title={c.name}
  />)}
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <Button className="w-full bg-sky-600 hover:bg-sky-700 h-11" onClick={() => copyLink(activeDesign)}>
                  <Copy className="h-4 w-4 mr-2" /> Copy Design Data
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" className="w-full h-11 text-slate-500">
                    Close Preview
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {
    /* Styled Project Alert Dialog for Deleting Saved Designs */
  }
      <AlertDialog open={designToDelete !== null} onOpenChange={(open) => {
    if (!open) setDesignToDelete(null);
  }}>
        <AlertDialogContent className="rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">Delete Design</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 mt-2">
              Are you sure you want to delete this saved design? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
    onClick={() => {
      if (designToDelete !== null) executeDeleteDesign(designToDelete);
    }}
    className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold"
  >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}
