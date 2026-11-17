import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import {
  Wallet,
  Download,
  Calendar,
  RefreshCw,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Building,
  QrCode,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/utils/cn";

const PAGE_SIZE = 10;

export default function DesignerLedger() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Withdrawal modal state
  const [requestPayoutModalOpen, setRequestPayoutModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutProfile, setPayoutProfile] = useState(null);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      let res = await fetch("/api/supplier/ledger", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.status === 404) {
        res = await fetch("/api/payouts/designer/ledger", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
      }
      if (res.ok) {
        const data = await res.json();
        setLedgerData(data);
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error("Designer Ledger fetch error:", res.status, errJson);
        toast({
          title: `Server Status: ${res.status}`,
          description: errJson.message || "Could not load designer ledger. If you just updated the code, please restart the server.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Failed to fetch designer ledger", err);
      toast({
        title: "Error",
        description: "Failed to load royalty ledger.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPayoutProfile = async () => {
    try {
      let res = await fetch("/api/supplier/payout-profile", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.status === 404) {
        res = await fetch("/api/payouts/designer/profile", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
      }
      if (res.ok) {
        const data = await res.json();
        setPayoutProfile(data.payoutSettings);
      }
    } catch (e) {
      console.warn("Could not load payout profile", e);
    }
  };

  useEffect(() => {
    fetchLedger();
    fetchPayoutProfile();
  }, [token]);

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    const amountNum = Number(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 100) {
      toast({
        title: "Invalid Amount",
        description: "Minimum withdrawal amount is ₹100.",
        variant: "destructive"
      });
      return;
    }

    const available = ledgerData?.summary?.availableBalanceRupees || 0;
    if (amountNum > available) {
      toast({
        title: "Insufficient Balance",
        description: `Requested amount exceeds available balance of ₹${available.toFixed(2)}.`,
        variant: "destructive"
      });
      return;
    }

    setRequestingPayout(true);
    try {
      let res = await fetch("/api/supplier/request-payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          amountRupees: amountNum,
          notes: withdrawNotes.trim()
        })
      });
      if (res.status === 404) {
        res = await fetch("/api/payouts/designer/request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({
            amountRupees: amountNum,
            notes: withdrawNotes.trim()
          })
        });
      }
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Payout Requested",
          description: `Withdrawal request for ₹${amountNum.toFixed(2)} submitted to your print provider.`
        });
        setRequestPayoutModalOpen(false);
        setWithdrawAmount("");
        setWithdrawNotes("");
        fetchLedger();
      } else {
        toast({
          title: "Request Failed",
          description: data.message || "Failed to submit payout request.",
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
      setRequestingPayout(false);
    }
  };

  const handleExportCSV = () => {
    if (!ledgerData?.statement || ledgerData.statement.length === 0) {
      toast({
        title: "No Data",
        description: "No ledger transactions available to export.",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Category",
      "Reference",
      "Fulfillment Hub",
      "Amount (INR)",
      "Running Balance (INR)",
      "Status",
      "Details"
    ];

    const rows = ledgerData.statement.map((t) => [
      `"${format(new Date(t.date), "yyyy-MM-dd HH:mm")}"`,
      `"${t.type}"`,
      `"${t.category}"`,
      `"${t.reference}"`,
      `"${t.partner}"`,
      t.type === "CREDIT" ? `+${Number(t.amount || 0).toFixed(2)}` : `-${Number(t.amount || 0).toFixed(2)}`,
      Number(t.runningBalance || 0).toFixed(2),
      `"${t.status}"`,
      `"${t.details}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Designer_Royalty_Statement_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Statement Exported",
      description: "Royalty statement downloaded as CSV."
    });
  };

  const summary = ledgerData?.summary || {
    lifetimeEarnedRupees: 0,
    settledWithdrawnRupees: 0,
    pendingWithdrawnRupees: 0,
    availableBalanceRupees: 0,
    salesCount: 0
  };

  const statement = ledgerData?.statement || [];
  const hasDestination = Boolean(payoutProfile?.upi_id || payoutProfile?.account_number);

  const totalPages = Math.max(1, Math.ceil(statement.length / PAGE_SIZE));
  const paginatedStatement = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return statement.slice(start, start + PAGE_SIZE);
  }, [statement, currentPage]);

  return (
    <div className="w-full space-y-5 pb-12 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Wallet className="w-4 h-4" />
            </span>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              Designer Royalty Statement & Ledger
            </h1>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
              Automated Royalty Ledger
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Audit trail of customer sales royalties credited to your wallet and withdrawal payouts transferred by print providers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 gap-1.5 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs cursor-pointer font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Download Statement
          </Button>

          <Button
            size="sm"
            onClick={() => setRequestPayoutModalOpen(true)}
            disabled={summary.availableBalanceRupees < 100}
            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer font-bold"
          >
            <Wallet className="w-3.5 h-3.5" />
            Withdraw Funds
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Available to Withdraw */}
        <Card className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-white shadow-xs ring-1 ring-emerald-400/20">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Available to Withdraw
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{summary.availableBalanceRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Cleared funds ready for bank / UPI payout
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Lifetime Sales Royalties */}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Royalties Earned
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{summary.lifetimeEarnedRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Cumulative earnings from {summary.salesCount} customer sales
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Settled Payouts */}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Transferred to Bank / UPI
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{summary.settledWithdrawnRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Successfully disbursed with bank UTR proof
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Pending Clearance */}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Pending in Transfer
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{summary.pendingWithdrawnRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Awaiting provider payout processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Royalty Statement Table */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden bg-white">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-xs">Royalty Statement Ledger</span>
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
              {statement.length} Transactions
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLedger}
            disabled={loading}
            className="h-7 text-xs text-slate-500 hover:text-slate-900"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            Refresh
          </Button>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <p className="text-xs font-medium">Loading statement transactions...</p>
            </div>
          ) : statement.length === 0 ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Wallet className="w-8 h-8 text-slate-300" />
              <p className="font-bold text-slate-800 text-sm">No statement transactions yet</p>
              <p className="text-xs text-slate-400 max-w-sm">
                When customers purchase your designed garments, your royalty credits and withdrawals will appear here in chronological order.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Reference / Order #</th>
                    <th className="py-3 px-4">Partner Facility</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Running Balance</th>
                    <th className="py-3 px-4 text-right pr-6">Status / Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStatement.map((t) => {
                    const isCredit = t.type === "CREDIT";

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {format(new Date(t.date), "MMM dd, yyyy HH:mm")}
                        </td>

                        <td className="py-3.5 px-4">
                          {isCredit ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                              Royalty Credit
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-bold gap-1">
                              <ArrowUpRight className="w-3 h-3 text-slate-500" />
                              Payout Debit
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <div>{t.reference}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{t.details}</div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {t.partner}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-black text-sm">
                          {isCredit ? (
                            <span className="text-emerald-700">+₹{Number(t.amount || 0).toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-900">-₹{Number(t.amount || 0).toFixed(2)}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-sm text-slate-900">
                          ₹{Number(t.runningBalance || 0).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4 text-right pr-6">
                          {t.status === "cleared" || t.status === "settled" ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                              ✓ Cleared
                            </Badge>
                          ) : t.status === "pending" ? (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                              ⏳ In Transfer
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                              Rejected
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Data Table Pagination Controls - 10 rows per page */}
        {statement.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, statement.length)} of{" "}
              {statement.length} transactions
            </span>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0 rounded-lg border-slate-200 cursor-pointer disabled:opacity-40"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                  <Button
                    key={num}
                    size="icon"
                    variant={currentPage === num ? "default" : "ghost"}
                    onClick={() => setCurrentPage(num)}
                    className={cn(
                      "h-8 w-8 p-0 rounded-lg text-xs font-semibold cursor-pointer",
                      currentPage === num
                        ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {num}
                  </Button>
                ))}
              </div>

              <Button
                size="icon"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 p-0 rounded-lg border-slate-200 cursor-pointer disabled:opacity-40"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Withdrawal Dialog Modal */}
      <Dialog open={requestPayoutModalOpen} onOpenChange={setRequestPayoutModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Request Royalty Withdrawal
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Withdraw available sales royalties to your verified bank or UPI destination.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestPayout} className="space-y-4 py-2">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Available to Withdraw:</span>
                <span className="font-mono font-black text-emerald-700 text-base">
                  ₹{summary.availableBalanceRupees.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payout Destination Info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  Destination Account
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRequestPayoutModalOpen(false);
                    setLocation("/supplier/profile");
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold underline cursor-pointer"
                >
                  Edit in Profile
                </button>
              </div>
              {hasDestination ? (
                <div className="font-mono text-slate-800 text-xs font-semibold pt-1">
                  {payoutProfile?.method === "upi" ? (
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span>UPI: {payoutProfile.upi_id}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{payoutProfile.account_holder_name} • {payoutProfile.account_number} ({payoutProfile.ifsc})</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-amber-600 text-[11px] font-medium pt-1">
                  ⚠️ No UPI or Bank details saved. Please add your payout destination in Profile before requesting.
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="payoutAmt">Amount to Withdraw (₹)</label>
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(String(summary.availableBalanceRupees))}
                  className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold cursor-pointer underline"
                >
                  Max Available
                </button>
              </div>
              <Input
                id="payoutAmt"
                type="number"
                min={100}
                max={summary.availableBalanceRupees || 100}
                step={1}
                placeholder="Minimum ₹100"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="font-mono font-bold text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="payoutNotes" className="text-xs font-semibold text-slate-700">
                Notes for Provider (Optional)
              </label>
              <Input
                id="payoutNotes"
                placeholder="e.g. Sales withdrawal batch"
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRequestPayoutModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={requestingPayout || !hasDestination || summary.availableBalanceRupees < 100}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {requestingPayout ? "Submitting..." : "Submit Payout Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
