import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/utils/dateFormatter";
import {
  Factory,
  Palette,
  DollarSign,
  Receipt,
  Search,
  RefreshCw,
  Eye,
  Store,
  FileText,
  Sliders,
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  Download
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

export default function PartnerLedger() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();

  const PAGE_SIZE = 8;
  const [activeTab, setActiveTab] = useState("providers"); // 'providers' | 'designers'
  const [searchTerm, setSearchTerm] = useState("");
  const [statementPartner, setStatementPartner] = useState(null); // Partner object to view modal
  const [currentPage, setCurrentPage] = useState(1);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  // Reset page when switching tabs or filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // 1. Fetch Print Providers Ledger
  const {
    data: providerData,
    isLoading: loadingProviders,
    isFetching: fetchingProviders,
    refetch: refetchProviders
  } = useQuery({
    queryKey: ["/api/portal/ledger/providers"],
    queryFn: async () => {
      const res = await fetch("/api/portal/ledger/providers", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load provider ledger");
      return res.json();
    },
    enabled: !!token
  });

  // 2. Fetch Designers Ledger
  const {
    data: designerData,
    isLoading: loadingDesigners,
    isFetching: fetchingDesigners,
    refetch: refetchDesigners
  } = useQuery({
    queryKey: ["/api/portal/ledger/designers"],
    queryFn: async () => {
      const res = await fetch("/api/portal/ledger/designers", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load designer ledger");
      return res.json();
    },
    enabled: !!token
  });

  // 3. Fetch Statement Orders when a partner is selected
  const {
    data: statementData,
    isLoading: loadingStatement
  } = useQuery({
    queryKey: ["/api/portal/ledger/statement", statementPartner?.id],
    queryFn: async () => {
      if (!statementPartner?.id) return null;
      const res = await fetch(`/api/portal/ledger/statement/${statementPartner.id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load partner statement");
      return res.json();
    },
    enabled: !!statementPartner?.id && !!token
  });

  const providers = providerData?.providers || [];
  const provSummary = providerData?.summary || {};

  const designers = designerData?.designers || [];
  const desgSummary = designerData?.summary || {};

  // Combined totals across entire network
  const totalPlatformCommission = Number(((provSummary.total_platform_commission || 0) + (desgSummary.total_platform_commission || 0)).toFixed(2));
  const totalGstCollected = Number(((provSummary.total_gst_collected || 0) + (desgSummary.total_gst_collected || 0)).toFixed(2));
  const totalProviderPayouts = provSummary.total_provider_payouts || 0;
  const totalDesignerRoyalties = desgSummary.total_designer_royalties || 0;

  // Filtered providers
  const filteredProviders = providers.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.provider_name || "").toLowerCase().includes(term) ||
      (p.provider_email || "").toLowerCase().includes(term)
    );
  });

  // Filtered designers
  const filteredDesigners = designers.filter((d) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (d.designer_name || "").toLowerCase().includes(term) ||
      (d.designer_email || "").toLowerCase().includes(term) ||
      (d.store_name || "").toLowerCase().includes(term) ||
      (d.associated_provider_name || "").toLowerCase().includes(term)
    );
  });

  const activeList = activeTab === "providers" ? filteredProviders : filteredDesigners;
  const totalRecords = activeList.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const paginatedProviders = filteredProviders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const paginatedDesigners = filteredDesigners.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleExportExcel = () => {
    try {
      setIsDownloadingExcel(true);
      const isProv = activeTab === "providers";
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Partner_Ledger_${isProv ? "Print_Providers" : "Designers"}_${dateStr}.csv`;

      let csvRows = [];
      csvRows.push([`"PRINT PORTAL FINANCIAL LEDGER REPORT - ${isProv ? "PRINT PROVIDERS" : "DESIGNERS & CREATORS"}"`]);
      csvRows.push([`"Generated At"`, `"${new Date().toLocaleString()}"`]);
      csvRows.push([`"Active Scope"`, `"${isProv ? providers.length + " Registered Hubs" : designers.length + " Active Creators"}"`]);
      csvRows.push([`"Platform Commission Retained"`, `"INR ${totalPlatformCommission.toFixed(2)}"`]);
      csvRows.push([`"Govt. GST Escrow Handled"`, `"INR ${totalGstCollected.toFixed(2)}"`]);
      csvRows.push([]);

      if (isProv) {
        csvRows.push([
          `"Print Facility Partner"`,
          `"Contact Email"`,
          `"Status"`,
          `"Orders Fulfilled"`,
          `"Gross GMV (INR)"`,
          `"Provider Payout (INR)"`,
          `"Platform Commission (INR)"`,
          `"GST Handled (INR)"`
        ]);

        filteredProviders.forEach((p) => {
          csvRows.push([
            `"${(p.provider_name || "").replace(/"/g, '""')}"`,
            `"${(p.provider_email || "").replace(/"/g, '""')}"`,
            `"${(p.provider_status || "ACTIVE").toUpperCase()}"`,
            p.total_orders,
            Number(p.gross_volume).toFixed(2),
            Number(p.provider_earnings).toFixed(2),
            Number(p.platform_commission).toFixed(2),
            Number(p.gst_collected).toFixed(2)
          ]);
        });

        csvRows.push([]);
        csvRows.push([
          `"TOTALS"`,
          `""`,
          `""`,
          provSummary.total_orders_count || 0,
          Number(provSummary.total_gross_volume || 0).toFixed(2),
          Number(provSummary.total_provider_payouts || 0).toFixed(2),
          Number(provSummary.total_platform_commission || 0).toFixed(2),
          Number(provSummary.total_gst_collected || 0).toFixed(2)
        ]);
      } else {
        csvRows.push([
          `"Designer Name"`,
          `"Designer Email"`,
          `"Storefront Name"`,
          `"Associated Printing Hub"`,
          `"Customer Sales"`,
          `"Store Gross Revenue (INR)"`,
          `"Designer Royalty (INR)"`,
          `"Platform Commission (INR)"`,
          `"GST Handled (INR)"`
        ]);

        filteredDesigners.forEach((d) => {
          csvRows.push([
            `"${(d.designer_name || "").replace(/"/g, '""')}"`,
            `"${(d.designer_email || "").replace(/"/g, '""')}"`,
            `"${(d.store_name || "").replace(/"/g, '""')}"`,
            `"${(d.associated_provider_name || "Global Provider Pool").replace(/"/g, '""')}"`,
            d.total_sales,
            Number(d.gross_volume).toFixed(2),
            Number(d.designer_royalties).toFixed(2),
            Number(d.platform_commission).toFixed(2),
            Number(d.gst_collected).toFixed(2)
          ]);
        });

        csvRows.push([]);
        csvRows.push([
          `"TOTALS"`,
          `""`,
          `""`,
          `""`,
          desgSummary.total_sales_count || 0,
          Number(desgSummary.total_gross_volume || 0).toFixed(2),
          Number(desgSummary.total_designer_royalties || 0).toFixed(2),
          Number(desgSummary.total_platform_commission || 0).toFixed(2),
          Number(desgSummary.total_gst_collected || 0).toFixed(2)
        ]);
      }

      const csvString = csvRows.map((r) => r.join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Excel Export Complete",
        description: `Downloaded ${fileName} with full financial data.`
      });
    } catch (err) {
      toast({
        title: "Excel Export Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const dateStr = new Date().toISOString().slice(0, 10);
      const isProv = activeTab === "providers";
      const fileName = `Partner_Ledger_${isProv ? "Print_Providers" : "Designers"}_${dateStr}.pdf`;

      const res = await fetch(`/api/portal/ledger/export/pdf?type=${activeTab}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });

      if (!res.ok) {
        throw new Error("Server error generating PDF report");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Report Downloaded",
        description: `Downloaded ${fileName} successfully.`
      });
    } catch (err) {
      console.error("PDF download error:", err);
      toast({
        title: "PDF Download Failed",
        description: err.message || "Could not generate PDF",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const isRefreshing = fetchingProviders || fetchingDesigners;
  const handleRefresh = () => {
    refetchProviders();
    refetchDesigners();
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-md">
            <FileText className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Partner Financial Ledger & Settlement
              </h1>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                Live Statements
              </Badge>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 max-w-2xl">
              Track manufacturing payouts, creator royalties, GST tax, and platform commission earned per partner facility.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Download Report Dropdown Box (Excel / PDF) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isDownloadingExcel || isDownloadingPdf}
                className="h-9 gap-2 border-slate-200 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs"
                title="Select format to download report"
              >
                <Download className="size-3.5 text-indigo-600" />
                <span>
                  {isDownloadingPdf
                    ? "Generating PDF..."
                    : isDownloadingExcel
                    ? "Exporting Excel..."
                    : "Download Report"}
                </span>
                <ChevronDown className="size-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5 border border-slate-200 bg-white shadow-xl z-50">
              <DropdownMenuItem
                onClick={handleExportExcel}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl cursor-pointer text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">Download Excel</span>
                  <span className="text-[10px] text-slate-400 font-normal">Spreadsheet (.csv)</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleExportPdf}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl cursor-pointer text-slate-700 hover:bg-rose-50 hover:text-rose-900 transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <FileText className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">Download PDF</span>
                  <span className="text-[10px] text-slate-400 font-normal">Official Report (.pdf)</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Network Financial KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Platform Commission Card */}
        <Card className="rounded-2xl border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-white to-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Platform Commission</span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <DollarSign className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-indigo-950">₹{totalPlatformCommission.toFixed(2)}</div>
            <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
              Accumulated platform revenue
            </p>
          </CardContent>
        </Card>

        {/* Print Provider Payouts Card */}
        <Card className="rounded-2xl border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Provider Payouts</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Factory className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-amber-950">₹{Number(totalProviderPayouts).toFixed(2)}</div>
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
              {providers.length} registered printing hubs
            </p>
          </CardContent>
        </Card>

        {/* Designer Royalties Card */}
        <Card className="rounded-2xl border-purple-200/80 bg-gradient-to-br from-purple-50/40 via-white to-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Designer Royalties</span>
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Palette className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-purple-950">₹{Number(totalDesignerRoyalties).toFixed(2)}</div>
            <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
              {designers.length} active storefront creators
            </p>
          </CardContent>
        </Card>

        {/* GST Tax Escrow Card */}
        <Card className="rounded-2xl border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Govt. GST Escrow</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <Receipt className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-950">₹{totalGstCollected.toFixed(2)}</div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              Tax collected for government filing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Ledger Card with Tabs & Search */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* Navigation & Search Strip */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("providers")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "providers"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <Factory className="size-3.5" />
              <span>Print Providers Ledger ({providers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("designers")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "designers"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <Palette className="size-3.5" />
              <span>Designers Ledger ({designers.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder={activeTab === "providers" ? "Search provider name or email..." : "Search designer or store name..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs rounded-xl bg-white"
            />
          </div>
        </div>

        {/* Tab 1: Print Providers Ledger Table */}
        {activeTab === "providers" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Print Facility Partner
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">
                    Orders Fulfilled
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">
                    Gross GMV (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-amber-800 text-right">
                    Provider Payout (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 text-right">
                    Platform Commission (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 text-right">
                    GST Handled (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">
                    Statement
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {loadingProviders ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      Loading print providers financial ledger...
                    </TableCell>
                  </TableRow>
                ) : filteredProviders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      No print providers match your search filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProviders.map((p) => (
                    <TableRow key={p.provider_id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                            <Factory className="size-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 block">{p.provider_name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{p.provider_email}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${(p.provider_status || "").toLowerCase() === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                        >
                          {p.provider_status || "Active"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-bold text-xs text-slate-700">
                        {p.total_orders} orders
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-slate-900">
                        ₹{Number(p.gross_volume).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-amber-700">
                        ₹{Number(p.provider_earnings).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-indigo-700">
                        ₹{Number(p.platform_commission).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-emerald-700">
                        ₹{Number(p.gst_collected).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStatementPartner({ id: p.provider_id, name: p.provider_name, role: "print_provider", email: p.provider_email })}
                          className="h-7 px-2.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 border-indigo-200 rounded-lg gap-1 cursor-pointer"
                        >
                          <Eye className="size-3" />
                          <span>Statement</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Tab 2: Designers Ledger Table */}
        {activeTab === "designers" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Designer & Storefront
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Associated Printing Hub
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">
                    Customer Sales
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">
                    Store Revenue (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-purple-800 text-right">
                    Designer Royalty (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 text-right">
                    Platform Commission (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 text-right">
                    GST Handled (₹)
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">
                    Statement
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {loadingDesigners ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      Loading designers financial ledger...
                    </TableCell>
                  </TableRow>
                ) : filteredDesigners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      No designers match your search filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDesigners.map((d) => (
                    <TableRow key={d.designer_id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                            <Palette className="size-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 block">{d.designer_name}</span>
                            <span className="text-[11px] text-purple-700 font-semibold">{d.store_name}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-slate-600 font-medium">{d.associated_provider_name}</span>
                      </TableCell>

                      <TableCell className="text-right font-bold text-xs text-slate-700">
                        {d.total_sales} sales
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-slate-900">
                        ₹{Number(d.gross_volume).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-purple-700">
                        ₹{Number(d.designer_royalties).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-indigo-700">
                        ₹{Number(d.platform_commission).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right font-black text-xs text-emerald-700">
                        ₹{Number(d.gst_collected).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStatementPartner({ id: d.designer_id, name: d.designer_name, role: "designer", email: d.designer_email, store_name: d.store_name })}
                          className="h-7 px-2.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 border-indigo-200 rounded-lg gap-1 cursor-pointer"
                        >
                          <Eye className="size-3" />
                          <span>Statement</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Data Table Pagination Controls */}
        {totalRecords > 0 && (
          <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRecords)} to{" "}
              {Math.min(currentPage * PAGE_SIZE, totalRecords)} of {totalRecords}{" "}
              {activeTab === "providers" ? "print facility partners" : "storefront creators"}
            </span>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0 rounded-lg border-slate-200"
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
                    className={`h-8 w-8 p-0 rounded-lg text-xs font-semibold ${
                      currentPage === num
                        ? activeTab === "providers"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-purple-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {num}
                  </Button>
                ))}
              </div>

              <Button
                size="icon"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 p-0 rounded-lg border-slate-200"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Partner Itemized Financial Statement Modal */}
      <Dialog open={!!statementPartner} onOpenChange={(open) => !open && setStatementPartner(null)}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl text-white ${statementPartner?.role === 'print_provider' ? 'bg-amber-600' : 'bg-purple-600'}`}>
                {statementPartner?.role === 'print_provider' ? <Factory className="size-5" /> : <Palette className="size-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  {statementPartner?.name} — Financial Statement
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {statementPartner?.email} &bull; {statementPartner?.role === 'print_provider' ? 'Verified Print Facility' : (statementPartner?.store_name || 'Creator Storefront')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Statement Orders Table */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-700 uppercase tracking-wider">
                Credited Orders ({statementData?.orders?.length || 0})
              </span>
            </div>

            {loadingStatement ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading itemized statement...</div>
            ) : !statementData?.orders || statementData.orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">No orders credited to this partner yet.</div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500">Order Ref & Date</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500">Customer</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-right">Order Subtotal</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-right">Partner Share</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-right">Portal Cut</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 text-xs">
                    {statementData.orders.map((o) => {
                      const isProv = statementPartner?.role === 'print_provider';
                      const partnerEarn = isProv ? Number(o.provider_earnings) : Number(o.designer_earnings);
                      return (
                        <TableRow key={o.id} className="hover:bg-slate-50/50">
                          <TableCell className="py-2.5">
                            <span className="font-bold text-slate-900 block font-mono text-[11px]">{o.order_number}</span>
                            <span className="text-[10px] text-slate-400">{formatDate(o.created_at)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-slate-800 block text-[11px]">{o.customer_name || 'Storefront Client'}</span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-700">
                            ₹{Number(o.subtotal).toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-right font-black ${isProv ? 'text-amber-700' : 'text-purple-700'}`}>
                            +₹{partnerEarn.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-black text-indigo-700">
                            +₹{Number(o.platform_commission).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase">
                              {o.status || 'Confirmed'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

