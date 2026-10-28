import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Mail,
  Calendar,
  UserCheck,
  ArrowLeft,
  Search,
  ChevronRight,
  RefreshCw,
  LayoutTemplate,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { encodeId } from "@/utils/idEncoder";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";

export default function AdminDesigners() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const [designers, setDesigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDesigners();
  }, [token]);

  async function fetchDesigners() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/designers", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      const desList = Array.isArray(data)
        ? data
        : Array.isArray(data?.designers)
        ? data.designers
        : [];
      setDesigners(desList);
    } catch (err) {
      setError(err?.message || "Failed to load designers");
    } finally {
      setLoading(false);
    }
  }

  const filteredDesigners = designers.filter(
    (d) =>
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name) => {
    if (!name) return "D";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full space-y-4 pb-12 animate-in fade-in duration-300">
      {/* Designers Directory Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-medium px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 text-base">Designers Directory</span>
            <span className="text-slate-400 font-semibold">({filteredDesigners.length})</span>
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
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg shadow-2xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchDesigners}
              disabled={loading}
              className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
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
              onClick={fetchDesigners}
            >
              Try Again
            </Button>
          </div>
        ) : filteredDesigners.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">No designers found</h3>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? "No matching designers found for your search query."
                : "When creative designers associate with your print hub, they will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDesigners.map((designer) => {
              const initials = getInitials(designer.name);
              const isActive = designer.status === "active";

              return (
                <div
                  key={designer.id}
                  className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Row: Initials Avatar + Status Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
                        {initials}
                      </div>
                      <Badge
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {designer.status || "active"}
                      </Badge>
                    </div>

                    {/* Designer Details */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {designer.name || "Anonymous Designer"}
                      </h3>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{designer.email}</span>
                      </p>
                    </div>

                    {/* Member Since Row */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        Member Since
                      </span>
                      <span className="font-medium text-slate-700">
                        {designer.createdAt
                          ? format(new Date(designer.createdAt), "MMM dd, yyyy")
                          : "Recent"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    <Button
                      size="sm"
                      className="flex-1 h-8 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs group/btn"
                      onClick={() =>
                        setLocation(
                          `/admin/designer-designs?designerId=${encodeId(designer.id)}`
                        )
                      }
                    >
                      <span>View Saved Designs</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-70 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 shrink-0 shadow-2xs"
                      onClick={() => window.open(`mailto:${designer.email}`)}
                      title={`Send email to ${designer.email}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

