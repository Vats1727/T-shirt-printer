import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { encodeId } from "@/utils/idEncoder";
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
export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [productToDelete, setProductToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [userData, setUserData] = useState(null);
  const blocked = !!(userData && userData.status && userData.status !== "active");
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  useEffect(() => {
    if (userData && userData.status && userData.status !== "active") setShowBlockedDialog(true);
  }, [userData]);
  async function fetchUserStatus() {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/profile`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) {
        const me = await res.json();
        if (me) setUserData(me);
      }
    } catch (e) {
    }
  }
  async function executeDeleteProduct(id) {
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE", headers: { Authorization: token ? `Bearer ${token}` : "" } });
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        toast({ title: "Delete Failed", description: js.message || "Failed to delete product", variant: "destructive" });
      } else {
        toast({ title: "Product Deleted", description: "Product has been removed from catalog." });
        fetchProducts();
      }
    } catch (err) {
      toast({ title: "Error", description: err?.message || "Failed to delete", variant: "destructive" });
    } finally {
      setProductToDelete(null);
    }
  }
  useEffect(() => {
    fetchProducts();
    fetchUserStatus();
  }, [token]);
  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", { headers: { Authorization: token ? `Bearer ${token}` : "" } });
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cardSides, setCardSides] = useState({});
  const filteredProducts = products.filter((p) => {
    if (selectedCategory === "all") return true;
    const cat = p.category || (p.slug?.includes("women") ? "women" : "men");
    return cat === selectedCategory;
  });
  const menCount = products.filter((p) => (p.category || (p.slug?.includes("women") ? "women" : "men")) === "men").length;
  const womenCount = products.filter((p) => (p.category || (p.slug?.includes("women") ? "women" : "men")) === "women").length;
  return <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Print Provider Console</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your catalog, inventory and orders.</p>
        </div>
      </div>

      {userData?.status === "pending" && <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 flex items-start gap-4 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-yellow-200 p-3 rounded-full">
            <Clock className="text-yellow-700 w-6 h-6" />
          </div>
          <div>
            <h3 className="text-yellow-900 font-bold text-lg">Registration Pending</h3>
            <p className="text-yellow-800">Your account is currently being reviewed by our administrators. Some features may be restricted until approval.</p>
          </div>
        </div>}

      {userData?.status === "suspended" && <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-4">
          <div className="bg-red-200 p-3 rounded-full">
            <AlertTriangle className="text-red-700 w-6 h-6" />
          </div>
          <div>
            <h3 className="text-red-900 font-bold text-lg">Account Suspended</h3>
            <p className="text-red-800">Your account has been suspended. Please contact portal support for more information.</p>
          </div>
        </div>}

      {
    /* Blocking dialog for non-active accounts - prevents actions */
  }
      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{userData?.status === "pending" ? "Registration Pending" : userData?.status === "suspended" ? "Account Restricted" : "Account Restricted"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {userData?.status === "pending" && <p>Your account is currently under review by our administrators. Some features are restricted until approval.</p>}
            {userData?.status === "suspended" && <p>Your account has been suspended. Please contact portal support for assistance and more information.</p>}
            {userData && !["pending", "suspended"].includes(userData.status) && <p>Your account status is '{userData.status}'. Access is restricted. Contact support for help.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBlockedDialog(false)}>Close</Button>
            <Button variant="secondary" onClick={() => {
    try {
      window.open("mailto:support@example.com");
    } catch {
    }
  }}>Contact Support</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Manage products, inventory and size charts</h2>
          <p className="text-sm text-muted-foreground mt-1">Create and manage products, sizes, colors and inventory from a single place.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={blocked} onClick={() => setLocation("/admin/clothes")} className={`inline-flex items-center gap-2 px-4 py-2 ${blocked ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white"} rounded shadow hover:bg-blue-700 transition`}>Create Product</button>
          <button disabled={blocked} onClick={() => setLocation("/admin/designers")} className={`inline-flex items-center gap-2 px-4 py-2 ${blocked ? "bg-gray-200 text-gray-500" : "bg-indigo-600 text-white"} rounded shadow hover:bg-indigo-700 transition`}><Users className="w-4 h-4" /> Designers</button>
          <button disabled={blocked} onClick={() => setLocation("/admin/orders")} className={`inline-flex items-center gap-2 px-4 py-2 ${blocked ? "bg-gray-200 text-gray-500" : "bg-slate-100 text-slate-900"} rounded hover:bg-slate-200 transition`}>View Orders</button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Garment Blanks & Products</h2>
          {
    /* Category Filter Tabs */
  }
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-sm">
            <button
    onClick={() => setSelectedCategory("all")}
    className={`px-3 py-1.5 rounded-md font-medium transition-all ${selectedCategory === "all" ? "bg-white text-indigo-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
  >
              All Blanks ({products.length})
            </button>
            <button
    onClick={() => setSelectedCategory("men")}
    className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${selectedCategory === "men" ? "bg-white text-blue-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
  >
              <span>👨</span> Men's Farmo ({menCount})
            </button>
            <button
    onClick={() => setSelectedCategory("women")}
    className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${selectedCategory === "women" ? "bg-white text-pink-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
  >
              <span>👩</span> Women's Farmo ({womenCount})
            </button>
          </div>
        </div>

        {loading && <div className="text-sm text-muted-foreground">Loading products…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {message && <div className="text-sm text-green-600">{message}</div>}
        {!loading && filteredProducts.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center bg-gray-50 rounded-lg border border-dashed">No products found in this category.</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
          {filteredProducts.map((p) => {
    const formatPrice = (v) => {
      const n = Number(v);
      return isNaN(n) ? "0.00" : n.toFixed(2);
    };
    const currentSide = cardSides[p.id] || "front";
    const cat = p.category || (p.slug?.includes("women") ? "women" : "men");

    const normalizeImage = (raw) => {
      if (!raw) return null;
      let img = raw.image || raw.image_data || raw.file_name || raw.filename || raw.image_url || raw.image_src || raw.back_image || null;
      if (!img && typeof raw === "string") img = raw;
      if (!img) return null;
      img = String(img);
      if (!img.startsWith("data:") && !img.startsWith("http") && !img.startsWith("/")) {
        img = `/uploads/${img}`;
      }
      return img;
    };

    const rawDesigns = p.designs;
    let frontImg = null;
    let backImg = null;

    if (Array.isArray(rawDesigns)) {
      const frontObj = rawDesigns.find((d) => d && String(d.side || "").toLowerCase() === "front");
      const backObj = rawDesigns.find((d) => d && String(d.side || "").toLowerCase() === "back");
      frontImg = normalizeImage(frontObj) || (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
      backImg = normalizeImage(backObj) || (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
    } else if (rawDesigns && typeof rawDesigns === "object") {
      frontImg = normalizeImage(rawDesigns.front) || (rawDesigns[0] ? normalizeImage(rawDesigns[0]) : null);
      backImg = normalizeImage(rawDesigns.back) || (rawDesigns[1] ? normalizeImage(rawDesigns[1]) : null);
    }

    if (!frontImg && p.front_image) frontImg = normalizeImage(p.front_image);
    if (!backImg && p.back_image) backImg = normalizeImage(p.back_image);
    if (!frontImg && p.image) frontImg = normalizeImage(p.image);

    const activeImg = currentSide === "back" && backImg ? backImg : (frontImg || backImg);
    return <div key={p.id} className="p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="relative h-48 flex items-center justify-center bg-slate-50/70 rounded-lg mb-3 overflow-hidden p-2 group">
                    {
      /* Category pill */
    }
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${cat === "women" ? "bg-pink-100 text-pink-700 border border-pink-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                        {cat === "women" ? "Women" : "Men"}
                      </span>
                    </div>

                    {
      /* Front / Back Side Switcher */
    }
                    {frontImg && backImg && <div className="absolute top-2.5 right-2.5 z-10 flex bg-white/90 backdrop-blur rounded-full p-0.5 shadow-sm border border-slate-200 text-[11px] font-medium">
                        <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setCardSides((prev) => ({ ...prev, [p.id]: "front" }));
      }}
      className={`px-2 py-0.5 rounded-full transition-all ${currentSide === "front" ? "bg-indigo-600 text-white shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"}`}
    >
                          Front
                        </button>
                        <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setCardSides((prev) => ({ ...prev, [p.id]: "back" }));
      }}
      className={`px-2 py-0.5 rounded-full transition-all ${currentSide === "back" ? "bg-indigo-600 text-white shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"}`}
    >
                          Back
                        </button>
                      </div>}

                    {activeImg ? <img src={activeImg} alt={p.name} className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" onError={(e) => {
                      if (e.currentTarget.dataset.retried) return;
                      e.currentTarget.dataset.retried = "true";
                      if (activeImg.startsWith('/uploads/')) {
                        e.currentTarget.src = activeImg.replace('/uploads/', '/attached_assets/');
                      } else if (activeImg.startsWith('/attached_assets/')) {
                        e.currentTarget.src = activeImg.replace('/attached_assets/', '/uploads/');
                      }
                    }} /> : <div className="text-sm text-muted-foreground">No preview</div>}
                  </div>

                  <div className="mb-2">
                    <div className="font-semibold text-slate-900 text-base flex items-center justify-between">
                      <span>{p.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{p.slug}</div>
                  </div>

                  <div className="text-sm mb-4 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Single unit:</span>
                      <strong>₹{formatPrice(p.single_price)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bulk min qty:</span>
                      <strong>{p.bulk_min || 0} pcs</strong>
                    </div>
                    <div className="flex justify-between text-indigo-700">
                      <span>Bulk price:</span>
                      <strong>₹{formatPrice(p.bulk_price)}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button disabled={blocked} onClick={() => setLocation("/admin/clothes?productId=" + encodeId(p.id))} className={`flex-1 py-1.5 ${blocked ? "bg-gray-200 text-gray-500" : "bg-indigo-600 hover:bg-indigo-700 text-white"} rounded-md text-sm font-medium transition`}>Edit</button>
                  <button disabled={blocked} onClick={() => {
      navigator.clipboard?.writeText(window.location.origin + "/product/" + p.slug);
    }} className={`px-3 py-1.5 ${blocked ? "bg-gray-100 text-gray-400" : "bg-slate-100 hover:bg-slate-200 text-slate-700"} rounded-md text-sm font-medium transition`}>Copy URL</button>
                  <button disabled={blocked} onClick={() => setProductToDelete(p.id)} className={`px-3 py-1.5 ${blocked ? "bg-gray-200 text-gray-500" : "bg-red-50 hover:bg-red-100 text-red-600"} rounded-md text-sm font-medium transition`}>Delete</button>
                </div>
              </div>;
  })}
        </div>
      </div>

      <AlertDialog open={productToDelete !== null} onOpenChange={(open) => {
    if (!open) setProductToDelete(null);
  }}>
        <AlertDialogContent className="rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 mt-2">
              Are you sure you want to remove this product from your catalog? This will soft delete the product.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
    onClick={() => {
      if (productToDelete !== null) executeDeleteProduct(productToDelete);
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
