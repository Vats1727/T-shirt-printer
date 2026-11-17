import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Receipt,
  Download,
  Calendar,
  Search,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Users,
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/utils/cn";

const PAGE_SIZE = 10;

export default function ProviderLedger() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const queryStr = params.toString() ? `?${params.toString()}` : "";

      let res = await fetch(`/api/admin/ledger${queryStr}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.status === 404) {
        res = await fetch(`/api/payouts/provider/ledger${queryStr}`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
      }
      if (res.ok) {
        const data = await res.json();
        setLedgerData(data);
        setCurrentPage(1);
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error("Provider Ledger fetch error:", res.status, errJson);
        toast({
          title: `Server Status: ${res.status}`,
          description: errJson.message || "Could not load provider ledger. If you just updated the code, please restart the server.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Failed to fetch provider ledger", err);
      toast({
        title: "Error",
        description: "Failed to load financial ledger.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [token]);

  const handleExportCSV = () => {
    if (!ledgerData?.orders || ledgerData.orders.length === 0) {
      toast({
        title: "No Data",
        description: "No ledger transactions available to export.",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      "Order Number",
      "Date",
      "Customer Name",
      "Customer Email",
      "Designer",
      "Gross Total (INR)",
      "Factory Share (INR)",
      "Designer Royalty (INR)",
      "Order Status",
      "Payment Status"
    ];

    const rows = ledgerData.orders.map((o) => [
      `"${o.order_number}"`,
      `"${format(new Date(o.created_at), "yyyy-MM-dd HH:mm")}"`,
      `"${o.customer_name || ""}"`,
      `"${o.customer_email || ""}"`,
      `"${o.designer_name || "Direct Sale"}"`,
      Number(o.total || 0).toFixed(2),
      Number(o.provider_retained || 0).toFixed(2),
      Number(o.designer_royalty || 0).toFixed(2),
      `"${o.status}"`,
      `"${o.payment_status}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Provider_Ledger_Statement_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Ledger Exported",
      description: "Financial report downloaded as CSV."
    });
  };

  const summary = ledgerData?.summary || {
    totalGrossRupees: 0,
    totalRetainedRupees: 0,
    totalRoyaltiesRupees: 0,
    settledRoyaltiesRupees: 0,
    pendingRoyaltiesRupees: 0,
    unpaidAccruedRoyalties: 0,
    orderCount: 0
  };

  const orders = ledgerData?.orders || [];

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return orders.slice(start, start + PAGE_SIZE);
  }, [orders, currentPage]);

  return (
    <div className="w-full space-y-5 pb-12 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Receipt className="w-4 h-4" />
            </span>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              Facility Financial Ledger & Sales Report
            </h1>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
              Live Gateway Settlement
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Real-time accounting ledger of gross customer payments, factory manufacturing earnings, and designer royalties.
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
            Export CSV Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLedger}
            disabled={loading}
            className="h-8 gap-1.5 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross Retail Collections */}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Gross Collections
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{summary.totalGrossRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              100% of customer inflows into your Razorpay
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Factory Manufacturing Net */}
        <Card className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
              Factory Share Retained
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-indigo-900 font-mono">
              ₹{summary.totalRetainedRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-indigo-600 mt-0.5 font-medium">
              Net revenue for blanks & printing operations
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Designer Royalties Accrued */}
        <Card className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Designer Royalties
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
              <Users className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-900 font-mono">
              ₹{summary.totalRoyaltiesRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500">
              <span>Settled: <strong className="text-emerald-700">₹{summary.settledRoyaltiesRupees.toFixed(2)}</strong></span>
              <span>Pending: <strong className="text-amber-600">₹{summary.unpaidAccruedRoyalties.toFixed(2)}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Total Orders Settled */}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Paid Sales Volume
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{summary.orderCount}</div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Completed customer storefront orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden bg-white">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search order #, customer, designer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLedger()}
                className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs bg-white border-slate-200 rounded-lg w-36"
              />
              <span>To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs bg-white border-slate-200 rounded-lg w-36"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={fetchLedger}
                className="h-8 text-xs font-semibold px-3"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading ledger transactions...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Receipt className="w-8 h-8 text-slate-300" />
              <p className="font-bold text-slate-800 text-sm">No ledger transactions found</p>
              <p className="text-xs text-slate-400">
                Customer purchases fulfilled by your facility will generate financial entries here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order Ref & Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Designer</th>
                    <th className="py-3 px-4">Gross Inflow (100%)</th>
                    <th className="py-3 px-4 text-indigo-700">Factory Share</th>
                    <th className="py-3 px-4 text-emerald-700">Designer Royalty</th>
                    <th className="py-3 px-4 text-right pr-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div>{o.order_number}</div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          {format(new Date(o.created_at), "MMM dd, yyyy HH:mm")}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{o.customer_name || "Guest Customer"}</div>
                        <div className="text-[11px] text-slate-400">{o.customer_email || "-"}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {o.designer_name ? (
                          <div>
                            <div className="font-semibold text-slate-800">{o.designer_name}</div>
                            <div className="text-[11px] text-slate-400">{o.designer_email}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">In-house / Direct</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-slate-900">
                        ₹{Number(o.total || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-indigo-700 bg-indigo-50/30">
                        ₹{Number(o.provider_retained || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-emerald-700 bg-emerald-50/30">
                        +₹{Number(o.designer_royalty || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right pr-6">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase">
                          Payment Captured
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Data Table Pagination Controls - 10 rows per page */}
        {orders.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, orders.length)} of{" "}
              {orders.length} orders
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
                        ? "bg-indigo-600 text-white shadow-xs hover:bg-indigo-700"
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
    </div>
  );
}
