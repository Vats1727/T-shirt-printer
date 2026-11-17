import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Mail,
  Calendar,
  UserCheck,
  Search,
  ChevronRight,
  RefreshCw,
  Percent,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Sliders,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { encodeId } from "@/utils/idEncoder";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function AdminDesigners() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("designers"); // "designers" | "payouts"
  const [designers, setDesigners] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedText, setCopiedText] = useState("");

  // Margins State
  const [margins, setMargins] = useState({
    designerMarginPercent: 35,
    providerMarginPercent: 60,
    platformFeePercent: 5,
    minDesignerMarginPercent: 10
  });
  const [isMarginModalOpen, setIsMarginModalOpen] = useState(false);
  const [customMarginInput, setCustomMarginInput] = useState(35);
  const [savingMargin, setSavingMargin] = useState(false);

  // Settlement Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settling, setSettling] = useState(false);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchDesigners();
    fetchMargins();
    fetchPayoutRequests();
  }, [token]);

  async function fetchMargins() {
    try {
      let res = await fetch("/api/admin/margins", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.status === 404) {
        res = await fetch("/api/payouts/provider/margins", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
      }
      if (res.ok) {
        const data = await res.json();
        if (data.margins) {
          setMargins(data.margins);
          setCustomMarginInput(data.margins.designerMarginPercent);
        }
      }
    } catch (e) {
      console.warn("Could not load margins", e);
    }
  }

  async function handleSaveMargins(e) {
    e.preventDefault();
    setSavingMargin(true);
    try {
      let res = await fetch("/api/admin/margins", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ designerMarginPercent: Number(customMarginInput) })
      });
      if (res.status === 404) {
        res = await fetch("/api/payouts/provider/margins", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({ designerMarginPercent: Number(customMarginInput) })
        });
      }
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Margins Updated",
          description: `Designer royalty margin set to ${customMarginInput}%.`
        });
        setIsMarginModalOpen(false);
        fetchMargins();
      } else {
        toast({
          title: "Update Failed",
          description: data.message || "Failed to update margin.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSavingMargin(false);
    }
  }

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

  async function fetchPayoutRequests() {
    try {
      let res = await fetch("/api/admin/payout-requests", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.status === 404) {
        res = await fetch("/api/payouts/provider/requests", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
      }
      if (res.ok) {
        const data = await res.json();
        setPayoutRequests(data.requests || []);
      }
    } catch (e) {
      console.warn("Could not load payout requests", e);
    }
  }

  function handleCopy(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(""), 2000);
    toast({
      title: "Copied to clipboard",
      description: text
    });
  }

  async function handleSettlePayout(e) {
    e.preventDefault();
    if (!utrNumber.trim()) {
      toast({
        title: "UTR Required",
        description: "Please enter the bank transfer UTR or transaction reference number.",
        variant: "destructive"
      });
      return;
    }
    setSettling(true);
    try {
      let res = await fetch(`/api/admin/payout-requests/${selectedPayout.id}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          settlementReferenceUtr: utrNumber.trim(),
          notes: settlementNotes.trim()
        })
      });
      if (res.status === 404) {
        res = await fetch(`/api/payouts/provider/requests/${selectedPayout.id}/settle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({
            settlementReferenceUtr: utrNumber.trim(),
            notes: settlementNotes.trim()
          })
        });
      }
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Payout Settled",
          description: `Payment of ₹${(selectedPayout.amount_cents / 100).toFixed(2)} marked as settled.`
        });
        setSettleModalOpen(false);
        setSelectedPayout(null);
        setUtrNumber("");
        setSettlementNotes("");
        fetchPayoutRequests();
      } else {
        toast({
          title: "Settlement Failed",
          description: data.message || "Failed to settle request.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSettling(false);
    }
  }

  async function handleRejectPayout(e) {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please specify why this payout request is being rejected.",
        variant: "destructive"
      });
      return;
    }
    setRejecting(true);
    try {
      let res = await fetch(`/api/admin/payout-requests/${selectedPayout.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ rejectedReason: rejectReason.trim() })
      });
      if (res.status === 404) {
        res = await fetch(`/api/payouts/provider/requests/${selectedPayout.id}/reject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({ rejectedReason: rejectReason.trim() })
        });
      }
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Payout Rejected",
          description: "The payout request has been rejected."
        });
        setRejectModalOpen(false);
        setSelectedPayout(null);
        setRejectReason("");
        fetchPayoutRequests();
      } else {
        toast({
          title: "Rejection Failed",
          description: data.message,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setRejecting(false);
    }
  }

  const pendingCount = payoutRequests.filter((r) => r.status === "pending").length;

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
    <div className="w-full space-y-5 pb-12 animate-in fade-in duration-300">
      {/* 1. Provider Margin Configuration Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Percent className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold tracking-tight text-white">
              Designer Royalty & Profit Margin Split
            </h2>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider">
              Provider Controlled
            </Badge>
          </div>
          <p className="text-xs text-slate-300">
            For retail sales fulfilled by your facility:{" "}
            <span className="font-semibold text-emerald-400">
              {margins.designerMarginPercent}% Designer Royalty
            </span>{" "}
            •{" "}
            <span className="font-semibold text-indigo-300">
              {margins.providerMarginPercent}% Manufacturing Retained
            </span>
          </p>
        </div>

        <Button
          onClick={() => {
            setCustomMarginInput(margins.designerMarginPercent);
            setIsMarginModalOpen(true);
          }}
          className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow-xs shrink-0 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
          Customize Margin
        </Button>
      </div>

      {/* 2. Navigation Tabs (Connected Designers vs Royalty Payout Requests) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("designers")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "designers"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Connected Designers ({designers.length})
          </button>

          <button
            onClick={() => setActiveTab("payouts")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "payouts"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Royalty Payout Requests
            {pendingCount > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 rounded-full font-black">
                {pendingCount}
              </Badge>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "designers" && (
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search designer..."
                className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg shadow-2xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchDesigners();
              fetchPayoutRequests();
              fetchMargins();
            }}
            disabled={loading}
            className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab 1: Designers Directory */}
      {activeTab === "designers" && (
        <div className="space-y-3">
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

                      <div>
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {designer.name || "Anonymous Designer"}
                        </h3>
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{designer.email}</span>
                        </p>
                      </div>

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
      )}

      {/* Tab 2: Royalty Payout Requests */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          {payoutRequests.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 mb-1">No payout requests</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When designers request withdrawals of their accumulated sales royalties, their settlement details will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Designer</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Payout Method</th>
                      <th className="py-3 px-4">Destination Details</th>
                      <th className="py-3 px-4">Requested At</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payoutRequests.map((req) => {
                      const isPending = req.status === "pending";
                      const isSettled = req.status === "settled";
                      const isRejected = req.status === "rejected";
                      const details = req.payout_details || {};

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{req.designer_name}</div>
                            <div className="text-[11px] text-slate-500">{req.designer_email}</div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-sm text-slate-900">
                              ₹{(Number(req.amount_cents) / 100).toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold uppercase">
                              {req.payout_method === "upi" ? "UPI VPA" : "Direct Bank"}
                            </Badge>
                          </td>

                          <td className="py-3 px-4">
                            {req.payout_method === "upi" ? (
                              <div className="flex items-center gap-1.5 font-mono text-slate-800 text-[11px]">
                                <span>{details.upi_id || "N/A"}</span>
                                {details.upi_id && (
                                  <button
                                    onClick={() => handleCopy(details.upi_id)}
                                    className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                                    title="Copy UPI ID"
                                  >
                                    {copiedText === details.upi_id ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-700 space-y-0.5">
                                <div className="font-semibold">{details.account_holder_name}</div>
                                <div className="font-mono text-slate-500 flex items-center gap-1">
                                  <span>{details.account_number}</span>
                                  <span>•</span>
                                  <span className="uppercase">{details.ifsc}</span>
                                  <button
                                    onClick={() => handleCopy(details.account_number)}
                                    className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                                    title="Copy Account Number"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-500">
                            {req.created_at ? format(new Date(req.created_at), "MMM dd, yyyy HH:mm") : "-"}
                          </td>

                          <td className="py-3 px-4">
                            {isPending && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1 font-bold">
                                <Clock className="w-3 h-3" />
                                Pending Settlement
                              </Badge>
                            )}
                            {isSettled && (
                              <div className="space-y-0.5">
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Settled
                                </Badge>
                                {req.settlement_reference_utr && (
                                  <div className="font-mono text-[10px] text-slate-500">
                                    UTR: {req.settlement_reference_utr}
                                  </div>
                                )}
                              </div>
                            )}
                            {isRejected && (
                              <div className="space-y-0.5">
                                <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] gap-1 font-bold">
                                  <XCircle className="w-3 h-3" />
                                  Rejected
                                </Badge>
                                {req.rejected_reason && (
                                  <div className="text-[10px] text-rose-600 truncate max-w-xs">
                                    {req.rejected_reason}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayout(req);
                                    setUtrNumber("");
                                    setSettlementNotes("");
                                    setSettleModalOpen(true);
                                  }}
                                  className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg shadow-2xs cursor-pointer"
                                >
                                  Settle Payout
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayout(req);
                                    setRejectReason("");
                                    setRejectModalOpen(true);
                                  }}
                                  className="h-7 px-2 text-rose-600 hover:bg-rose-50 border-rose-200 text-[11px] rounded-lg cursor-pointer"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Completed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Modal: Adjust Designer Royalty Margin */}
      <Dialog open={isMarginModalOpen} onOpenChange={setIsMarginModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Configure Designer Royalty Margin
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Set the percentage of retail garment sales distributed as royalties to connected designers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMargins} className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <Label htmlFor="marginInput">Designer Royalty Percentage</Label>
                <span className="font-mono text-sm text-indigo-600 font-black">
                  {customMarginInput}%
                </span>
              </div>
              <Input
                id="marginInput"
                type="number"
                min={margins.minDesignerMarginPercent || 10}
                max={80}
                step={0.5}
                value={customMarginInput}
                onChange={(e) => setCustomMarginInput(e.target.value)}
                className="text-sm font-semibold"
                required
              />
              <p className="text-[11px] text-slate-500">
                Platform minimum required: {margins.minDesignerMarginPercent}%. Maximum allowed: 80%.
              </p>
            </div>

            {/* Live Calculation Preview Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Simulated Order Breakdown (For ₹1,000 Retail Sale)
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Designer Royalty ({customMarginInput}%):</span>
                <span className="font-mono font-bold text-emerald-600">
                  +₹{((1000 * Number(customMarginInput || 0)) / 100).toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                <span>You Retain (Manufacturing & Blanks):</span>
                <span className="font-mono font-black text-indigo-700">
                  ₹{Math.max(0, 1000 - (1000 * Number(customMarginInput || 0)) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMarginModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingMargin}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {savingMargin ? "Saving..." : "Save Margin Rules"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Modal: Settle Royalty Payout */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Settle Designer Royalty Payout
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Transfer funds to the designer and enter the bank transaction reference number for auditing.
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <form onSubmit={handleSettlePayout} className="space-y-4 py-2">
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Designer:</span>
                  <span className="font-bold text-slate-900">{selectedPayout.designer_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Requested Amount:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    ₹{(Number(selectedPayout.amount_cents) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-emerald-100">
                  <span className="text-slate-600">Destination:</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {selectedPayout.payout_details?.upi_id || selectedPayout.payout_details?.account_number}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="utrInput" className="text-xs font-semibold text-slate-700">
                  Bank UTR / Transaction Reference Number <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="utrInput"
                  placeholder="e.g. 432109876543 or CMS12345678"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="font-mono text-xs uppercase"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Found on your UPI transfer receipt or Net Banking confirmation.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settleNotes" className="text-xs font-semibold text-slate-700">
                  Notes (Optional)
                </Label>
                <Input
                  id="settleNotes"
                  placeholder="e.g. Cleared via HDFC Corporate UPI"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSettleModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={settling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  {settling ? "Confirming..." : "Confirm & Mark Settled"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Modal: Reject Payout */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <XCircle className="w-5 h-5 text-rose-600" />
              Reject Payout Request
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Rejecting will return these funds back to the designer's available wallet balance.
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <form onSubmit={handleRejectPayout} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="rejectReasonInput" className="text-xs font-semibold text-slate-700">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="rejectReasonInput"
                  placeholder="e.g. Invalid UPI ID / Returned by beneficiary bank"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={rejecting}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  {rejecting ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
