import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/layouts/Header";
import Footer from "@/layouts/Footer";
import { encodeId, decodeId } from "@/utils/idEncoder";
import {
  ShoppingBag,
  Trash2,
  Sparkles,
  Store as StoreIcon,
  Shirt,
  Paintbrush,
  Search,
  Instagram,
  Twitter,
  Globe,
  Flame,
  ArrowRight,
  Lock
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
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
const THEME_STYLES = {
  midnight: {
    heroBg: "bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900",
    heroText: "text-white",
    heroBadge: "bg-indigo-500/20 border-indigo-400/30 text-indigo-300",
    heroBorder: "border-indigo-950/40",
    accentBtn: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30",
    cardHover: "hover:border-indigo-400/60",
    announcementBg: "bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white"
  },
  minimal_light: {
    heroBg: "bg-gradient-to-r from-slate-100 via-white to-slate-100",
    heroText: "text-slate-900",
    heroBadge: "bg-slate-200/80 border-slate-300 text-slate-800",
    heroBorder: "border-slate-200",
    accentBtn: "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20",
    cardHover: "hover:border-slate-400",
    announcementBg: "bg-slate-900 text-white"
  },
  streetwear_dark: {
    heroBg: "bg-gradient-to-r from-neutral-950 via-zinc-900 to-neutral-950",
    heroText: "text-white",
    heroBadge: "bg-amber-500/20 border-amber-400/30 text-amber-300",
    heroBorder: "border-zinc-800",
    accentBtn: "bg-amber-500 hover:bg-amber-400 text-black font-extrabold shadow-amber-500/20",
    cardHover: "hover:border-amber-400/60",
    announcementBg: "bg-amber-500 text-black font-extrabold"
  },
  cyber_neon: {
    heroBg: "bg-gradient-to-r from-slate-950 via-purple-950 to-cyan-950",
    heroText: "text-white",
    heroBadge: "bg-cyan-500/20 border-cyan-400/30 text-cyan-300",
    heroBorder: "border-purple-900/40",
    accentBtn: "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold shadow-cyan-500/30",
    cardHover: "hover:border-cyan-400/60",
    announcementBg: "bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white"
  },
  sunset_amber: {
    heroBg: "bg-gradient-to-r from-slate-900 via-amber-950 to-orange-950",
    heroText: "text-white",
    heroBadge: "bg-orange-500/20 border-orange-400/30 text-orange-300",
    heroBorder: "border-orange-950/40",
    accentBtn: "bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/30",
    cardHover: "hover:border-orange-400/60",
    announcementBg: "bg-gradient-to-r from-orange-600 to-amber-600 text-white"
  },
  emerald_luxury: {
    heroBg: "bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-950",
    heroText: "text-white",
    heroBadge: "bg-emerald-500/20 border-emerald-400/30 text-emerald-300",
    heroBorder: "border-emerald-950/40",
    accentBtn: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30",
    cardHover: "hover:border-emerald-400/60",
    announcementBg: "bg-gradient-to-r from-emerald-700 to-teal-800 text-white"
  }
};
function StoreCard({
  listing,
  supplierId,
  isOwner,
  onDelete,
  themeStyle
}) {
  const [, setLocation] = useLocation();
  const [activeSide, setActiveSide] = useState("front");
  const [selectedColor, setSelectedColor] = useState(null);

  const pg = listing.preview_group;
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
  const currentImg = activeSide === "back" && backImg ? backImg : frontImg;
  const hasBothSides = Boolean(frontImg && backImg);
  const productUrl = `/listing/id/${encodeId(listing.id)}${supplierId ? `?supplier=${encodeId(supplierId)}` : ""}${selectedColor?.hex ? `&color=${encodeURIComponent(selectedColor.hex)}` : ""}`;
  const handleCardClick = () => {
    setLocation(productUrl);
  };
  return <Card
    onClick={handleCardClick}
    className={`group cursor-pointer overflow-hidden border border-slate-200/90 ${themeStyle.cardHover} hover:shadow-xl transition-all duration-300 rounded-3xl bg-white flex flex-col hover:-translate-y-1`}
  >
      {
    /* Mockup Image Area */
  }
      <div className="aspect-[4/5] bg-gradient-to-b from-slate-50/80 via-white to-slate-100/50 p-6 flex items-center justify-center relative overflow-hidden">
        <img
    src={currentImg}
    alt={listing.title}
    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out drop-shadow-sm"
    onError={(e) => {
      e.currentTarget.src = "/templates/tshirt.png";
    }}
  />

        {
    /* Side switcher chips (e.stopPropagation prevents triggering card navigation) */
  }
        {hasBothSides && <div
    className="absolute top-3.5 left-3.5 flex bg-white/95 backdrop-blur-md rounded-xl p-1 border border-slate-200/70 shadow-xs z-10 opacity-90 group-hover:opacity-100 transition-opacity"
    onClick={(e) => e.stopPropagation()}
  >
            <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      setActiveSide("front");
    }}
    className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg transition-all ${activeSide === "front" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
  >
              Front
            </button>
            <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      setActiveSide("back");
    }}
    className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg transition-all ${activeSide === "back" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
  >
              Back
            </button>
          </div>}

        {
    /* Price Badge */
  }
        <div className="absolute top-3.5 right-3.5 z-10">
          <Badge className="bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200 font-extrabold shadow-sm px-2.5 py-1 text-sm">
            ₹{Number(listing.price || 29.99).toFixed(2)}
          </Badge>
        </div>

        {
    /* Hover Quick Action Indicator */
  }
        <div className="absolute inset-x-0 bottom-0 py-2.5 bg-gradient-to-t from-slate-900/60 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold gap-1">
          <span>Click to View Product</span>
          <ArrowRight className="size-3.5" />
        </div>
      </div>

      <CardContent className="p-5 flex flex-col flex-grow justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold uppercase tracking-wider">
              <Shirt className="size-3.5" />
              <span>Custom Apparel</span>
            </div>
            {listing.designer_name && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 truncate max-w-[130px]" title={`Designed by ${listing.designer_name}`}>
                by {listing.designer_name}
              </span>
            )}
          </div>
          <h3 className="font-extrabold text-base text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-1">
            {listing.title}
          </h3>
          {listing.description && <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
              {listing.description}
            </p>}
        </div>

        {/* Actual Available Colors & Sizes for this Design */}
        {((listing.available_colors && listing.available_colors.length > 0) || (listing.available_sizes && listing.available_sizes.length > 0)) && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {listing.available_colors && listing.available_colors.length > 0 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Colors:</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {listing.available_colors.slice(0, 6).map((c, i) => {
                    const isSelected = selectedColor?.hex?.toLowerCase() === c.hex?.toLowerCase();
                    return (
                      <button
                        key={c.id || i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColor(c);
                        }}
                        onMouseEnter={() => setSelectedColor(c)}
                        className={`size-3.5 rounded-full border transition-all inline-block cursor-pointer ${
                          isSelected ? "ring-2 ring-indigo-600 scale-125 border-white shadow-xs" : "border-slate-300 hover:scale-110"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    );
                  })}
                  {listing.available_colors.length > 6 && (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      +{listing.available_colors.length - 6}
                    </span>
                  )}
                </div>
              </div>
            )}

            {listing.available_sizes && listing.available_sizes.length > 0 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Sizes:</span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {listing.available_sizes.map((s, i) => {
                    const label = typeof s === 'object' ? s.label : s;
                    return (
                      <span
                        key={s.id || label || i}
                        className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
          <span className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 group-hover:bg-indigo-600 text-white text-xs font-extrabold transition-colors shadow-xs">
            <ShoppingBag className="size-3.5" />
            View & Order
          </span>

          {isOwner && <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onDelete(listing.id);
    }}
    className="p-2.5 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors z-10"
    title="Delete Listing"
  >
              <Trash2 className="size-4" />
            </button>}
        </div>
      </CardContent>
    </Card>;
}
export default function StorePage() {
  const [, setLocation] = useLocation();
  const rawPath = typeof window !== "undefined" && window.location && window.location.pathname ? window.location.pathname : "";
  const rawParam = rawPath.split("/").filter(Boolean).pop() || "";
  const supplierId = decodeId(rawParam) || rawParam;
  const [listings, setListings] = useState([]);
  const [designer, setDesigner] = useState(null);
  const [storeSettings, setStoreSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      setUser(raw ? JSON.parse(raw) : null);
    } catch (e) {
      setUser(null);
    }
    try {
      setToken(localStorage.getItem("token"));
    } catch (e) {
      setToken(null);
    }
  }, []);

  // Ensure store page always scrolls to the very top header upon opening or route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const topEl = document.getElementById("storefront-top");
    if (topEl) {
      topEl.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, [supplierId]);

  const [isPrivate, setIsPrivate] = useState(false);
  useEffect(() => {
    (async () => {
      setLoading(true);
      setIsPrivate(false);
      try {
        const storedToken = localStorage.getItem("token");
        const res = await fetch(`/api/store/${encodeURIComponent(supplierId)}`, {
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {}
        });
        const js = await res.json().catch(() => ({}));
        if (res.status === 403 || js.is_private) {
          setIsPrivate(true);
          setStoreSettings(js.store_settings || {});
          setDesigner(js.designer || null);
          setListings([]);
          return;
        }
        if (!res.ok) {
          setListings([]);
          return;
        }
        setListings(js.listings || []);
        setDesigner(js.designer || null);
        setStoreSettings(js.store_settings || {});
      } catch (e) {
        setListings([]);
      } finally {
        setLoading(false);
        // Force scroll to top header once products are loaded
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    })();
  }, [supplierId]);
  const isOwner = Boolean(
    user && (user.role === "supplier" || user.role === "designer" || user.role === "admin" || user.role === "print_provider") && (String(user.id) === String(supplierId) || Number(user.id) === Number(supplierId))
  );
  const [listingToDelete, setListingToDelete] = useState(null);
  const { toast } = useToast();
  const executeDeleteListing = async (id) => {
    try {
      const endpoint = (user?.role === "admin" || user?.role === "print_provider")
        ? `/api/admin/listings/${encodeURIComponent(id)}`
        : `/api/supplier/listings/${encodeURIComponent(id)}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || "");
        toast({
          title: "Delete Failed",
          description: txt || "Failed to remove listing from storefront.",
          variant: "destructive"
        });
        return;
      }
      setListings((prev) => prev.filter((x) => Number(x.id) !== Number(id)));
      toast({
        title: "Listing Removed",
        description: "Product listing removed from storefront."
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Error deleting listing.",
        variant: "destructive"
      });
    } finally {
      setListingToDelete(null);
    }
  };
  const activeThemeKey = storeSettings?.theme || "midnight";
  const themeStyle = THEME_STYLES[activeThemeKey] || THEME_STYLES.midnight;
  const filteredListings = useMemo(() => {
    let list = [...listings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) => l.title && l.title.toLowerCase().includes(q) || l.description && l.description.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== "all") {
      const cat = selectedCategory.toLowerCase();
      list = list.filter((l) => {
        const t = (l.title || "").toLowerCase();
        const d = (l.description || "").toLowerCase();
        return t.includes(cat) || d.includes(cat);
      });
    }
    if (sortBy === "price-asc") {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else {
      list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    }
    return list;
  }, [listings, searchQuery, selectedCategory, sortBy]);
  const storeTitle = storeSettings?.store_name || (designer?.name ? `${designer.name}'s Collection` : "Designer Storefront");
  const storeTagline = storeSettings?.tagline || "Exclusive custom apparel crafted with precision and printed on high quality blanks.";
  const announcementText = storeSettings?.announcement || "";
  const showAnnouncement = storeSettings?.show_announcement && announcementText;

  if (isPrivate && !isOwner) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center font-sans">
        <div className="max-w-md w-full space-y-6 bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="size-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">
              {storeSettings?.store_name || "Private Storefront"}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              This storefront is currently set to private or offline by the store owner. Please check back later or contact the creator.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => setLocation(user?.role === "customer" ? "/customer/dashboard" : "/")}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-10 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              Browse Available Storefronts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="storefront-top" className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Private Store Preview Alert for Owner */}
      {isOwner && storeSettings?.is_public === false && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2">
          <Lock className="size-3.5 text-amber-600 shrink-0" />
          <span>Private Storefront Preview: This store is currently offline to customers and visitors. Only you can view this preview.</span>
          <button
            onClick={() => setLocation(user?.role === "admin" || user?.role === "print_provider" ? "/admin/customize-store" : "/supplier/customize-store")}
            className="underline text-indigo-700 hover:text-indigo-900 font-bold ml-1 cursor-pointer"
          >
            Manage Privacy
          </button>
        </div>
      )}
      {
    /* Redesigned Storefront Header & Brand Bar */
  }
      <Header
        storeSettings={storeSettings}
        storeTitle={storeTitle}
        isOwner={isOwner}
        onLogoUpdated={(newLogoUrl) => setStoreSettings((prev) => ({ ...prev, logo_url: newLogoUrl }))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Top Announcement Bar if enabled by designer */}
      {showAnnouncement && (
        <div className={`${themeStyle.announcementBg} py-2.5 px-4 text-center text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-xs`}>
          <Flame className="size-4 animate-pulse" />
          <span>{announcementText}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="border-b border-slate-200 bg-white shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Product count or Owner Actions */}
          <div className="flex items-center gap-3">
            {isOwner && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setLocation(user?.role === "admin" || user?.role === "print_provider" ? "/admin/customize-store" : "/supplier/customize-store")}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all flex items-center gap-1.5 border border-slate-200"
                >
                  <Paintbrush className="size-3.5 text-indigo-600" />
                  <span>Redesign Store</span>
                </Button>
                <Button
                  onClick={() => setLocation(user?.role === "admin" || user?.role === "print_provider" ? "/admin/listings/create" : "/supplier/listings/create")}
                  className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white shadow-xs bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-1.5"
                >
                  <StoreIcon className="size-3.5" />
                  <span>+ Add New Listing</span>
                </Button>
              </div>
            )}
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {filteredListings.length} {filteredListings.length === 1 ? "Product" : "Products"}
            </span>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search storefront..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent bg-slate-50/50"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {
    /* Products Grid */
  }
      <main className="max-w-7xl mx-auto px-6 py-10 flex-grow w-full">
        {loading ? <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="size-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm font-medium animate-pulse">Loading storefront items...</p>
          </div> : filteredListings.length === 0 ? <div className="py-24 text-center max-w-md mx-auto space-y-4">
            <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
              <ShoppingBag className="size-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-800">
                {listings.length === 0 ? "No Products in Store Yet" : "No Matching Garments Found"}
              </h2>
              <p className="text-sm text-slate-500">
                {listings.length === 0 ? "This designer hasn't published any public apparel listings yet. Check back soon!" : "Try clearing your search or category filter to discover more products."}
              </p>
            </div>
            {isOwner && listings.length === 0 && <Button
    onClick={() => setLocation("/supplier/listings/create")}
    className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
  >
                + Create Your First Listing
              </Button>}
            {listings.length > 0 && <Button
    variant="outline"
    onClick={() => {
      setSearchQuery("");
      setSelectedCategory("all");
    }}
    className="mt-2 text-xs"
  >
                Clear Filters
              </Button>}
          </div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing) => <StoreCard
    key={listing.id}
    listing={listing}
    supplierId={supplierId}
    isOwner={isOwner}
    onDelete={(id) => setListingToDelete(id)}
    themeStyle={themeStyle}
  />)}
          </div>}
      </main>

      <Footer
    storeSettings={storeSettings}
    storeTitle={storeTitle}
    storeTagline={storeTagline}
    isOwner={isOwner}
    onLogoUpdated={(newLogoUrl) => setStoreSettings((prev) => ({ ...prev, logo_url: newLogoUrl }))}
    onSelectCategory={setSelectedCategory}
  />

      {
    /* Styled Project Alert Dialog for Deleting Listings */
  }
      <AlertDialog open={listingToDelete !== null} onOpenChange={(open) => {
    if (!open) setListingToDelete(null);
  }}>
        <AlertDialogContent className="rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">Remove Listing</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 mt-2">
              Are you sure you want to remove this product listing from your storefront?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
    onClick={() => {
      if (listingToDelete !== null) executeDeleteListing(listingToDelete);
    }}
    className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold"
  >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
