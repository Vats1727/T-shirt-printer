import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Factory,
  DollarSign,
  Truck,
  Percent,
  Receipt,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap
} from "lucide-react";

const DEFAULT_B2B_SETTINGS = {
  single_platform_fee_percent: 10.00,
  single_provider_margin_percent: 90.00,
  bulk_platform_fee_percent: 8.00,
  bulk_provider_margin_percent: 92.00,
  bulk_min_qty: 2,
  platform_fee_percent: 10.00,
  provider_margin_percent: 90.00,
  standard_shipping_charge: 120.00,
  free_shipping_threshold: 2500.00,
  shipping_enabled: true,
  tax_percent: 5.00,
  gst_enabled: true,
  notes: "Global B2B wholesale rules configured by Portal Superadmin"
};

export default function B2BFinancialSettings() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(DEFAULT_B2B_SETTINGS);
  const [saving, setSaving] = useState(false);

  // Simulator controls
  const [simUnits, setSimUnits] = useState(50);
  const [simUnitPrice, setSimUnitPrice] = useState(240);

  // Fetch active B2B settings
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/portal/b2b-financial-settings"],
    queryFn: async () => {
      const res = await fetch("/api/portal/b2b-financial-settings", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load B2B financial settings");
      return res.json();
    },
    enabled: !!token
  });

  useEffect(() => {
    if (data?.settings) {
      setForm({
        single_platform_fee_percent: Number(data.settings.single_platform_fee_percent ?? data.settings.platform_fee_percent ?? 10.00),
        single_provider_margin_percent: Number(data.settings.single_provider_margin_percent ?? data.settings.provider_margin_percent ?? 90.00),
        bulk_platform_fee_percent: Number(data.settings.bulk_platform_fee_percent ?? 8.00),
        bulk_provider_margin_percent: Number(data.settings.bulk_provider_margin_percent ?? 92.00),
        bulk_min_qty: Number(data.settings.bulk_min_qty ?? 2),
        platform_fee_percent: Number(data.settings.single_platform_fee_percent ?? data.settings.platform_fee_percent ?? 10.00),
        provider_margin_percent: Number(data.settings.single_provider_margin_percent ?? data.settings.provider_margin_percent ?? 90.00),
        standard_shipping_charge: Number(data.settings.standard_shipping_charge ?? 120.00),
        free_shipping_threshold: Number(data.settings.free_shipping_threshold ?? 2500.00),
        shipping_enabled: Boolean(data.settings.shipping_enabled ?? true),
        tax_percent: Number(data.settings.tax_percent ?? 5.00),
        gst_enabled: Boolean(data.settings.gst_enabled ?? true),
        notes: data.settings.notes || ""
      });
    }
  }, [data]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 1. Single commission checks
  const singlePlatform = Number(form.single_platform_fee_percent || 0);
  const singleProvider = Number(form.single_provider_margin_percent || 0);
  const singleTotal = Number((singlePlatform + singleProvider).toFixed(2));
  const isSingleValid = Math.abs(singleTotal - 100) < 0.01;
  const singleDiff = Number((100 - singleTotal).toFixed(2));

  // 2. Bulk commission checks
  const bulkPlatform = Number(form.bulk_platform_fee_percent || 0);
  const bulkProvider = Number(form.bulk_provider_margin_percent || 0);
  const bulkTotal = Number((bulkPlatform + bulkProvider).toFixed(2));
  const isBulkValid = Math.abs(bulkTotal - 100) < 0.01;
  const bulkDiff = Number((100 - bulkTotal).toFixed(2));

  const isAllValid = isSingleValid && isBulkValid;

  // Auto-adjust helpers for Single
  const handleAutoAdjustSingleProvider = () => {
    const adjusted = Math.max(0, Number((100 - singlePlatform).toFixed(2)));
    setForm((prev) => ({ ...prev, single_provider_margin_percent: adjusted }));
    toast({
      title: "Single Provider Share Auto-Adjusted",
      description: `Updated to ${adjusted}% so single allocation equals exactly 100.00%.`
    });
  };

  const handleAutoAdjustSinglePlatform = () => {
    const adjusted = Math.max(0, Number((100 - singleProvider).toFixed(2)));
    setForm((prev) => ({ ...prev, single_platform_fee_percent: adjusted }));
    toast({
      title: "Single Admin Commission Auto-Adjusted",
      description: `Updated to ${adjusted}% so single allocation equals exactly 100.00%.`
    });
  };

  // Auto-adjust helpers for Bulk
  const handleAutoAdjustBulkProvider = () => {
    const adjusted = Math.max(0, Number((100 - bulkPlatform).toFixed(2)));
    setForm((prev) => ({ ...prev, bulk_provider_margin_percent: adjusted }));
    toast({
      title: "Bulk Provider Share Auto-Adjusted",
      description: `Updated to ${adjusted}% so bulk allocation equals exactly 100.00%.`
    });
  };

  const handleAutoAdjustBulkPlatform = () => {
    const adjusted = Math.max(0, Number((100 - bulkProvider).toFixed(2)));
    setForm((prev) => ({ ...prev, bulk_platform_fee_percent: adjusted }));
    toast({
      title: "Bulk Admin Commission Auto-Adjusted",
      description: `Updated to ${adjusted}% so bulk allocation equals exactly 100.00%.`
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!isSingleValid) {
      toast({
        title: "Single Commission Must Equal 100%",
        description: `Single product commission must equal exactly 100.00%. Current sum: ${singleTotal}%.`,
        variant: "destructive"
      });
      return;
    }

    if (!isBulkValid) {
      toast({
        title: "Bulk Commission Must Equal 100%",
        description: `Bulk wholesale commission (> 1 product) must equal exactly 100.00%. Current sum: ${bulkTotal}%.`,
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        platform_fee_percent: singlePlatform,
        provider_margin_percent: singleProvider
      };

      const res = await fetch("/api/portal/b2b-financial-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to update B2B settings");

      queryClient.invalidateQueries({ queryKey: ["/api/portal/b2b-financial-settings"] });
      toast({
        title: "B2B Financial Governance Saved",
        description: "Single & Bulk commission rates saved and enforced across all B2B orders."
      });
    } catch (err) {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_B2B_SETTINGS);
    toast({
      title: "Reset B2B Defaults",
      description: "Reset to default: Single (10% Admin, 90% Provider), Bulk (8% Admin, 92% Provider)."
    });
  };

  // Simulator calculation
  const units = Math.max(1, Number(simUnits || 1));
  const unitPrice = Math.max(1, Number(simUnitPrice || 1));
  const isBulkMode = units > 1;

  const simPlatformPercent = isBulkMode ? bulkPlatform : singlePlatform;
  const simProviderPercent = isBulkMode ? bulkProvider : singleProvider;

  const rawTotal = units * unitPrice;
  const simNetSubtotal = rawTotal;
  const simShipping = (form.shipping_enabled && simNetSubtotal < form.free_shipping_threshold)
    ? Number(form.standard_shipping_charge)
    : 0;
  const simGst = (form.gst_enabled && form.tax_percent > 0)
    ? (simNetSubtotal * Number(form.tax_percent)) / 100
    : 0;
  const simAdminCut = (simNetSubtotal * simPlatformPercent) / 100;
  const simProviderEarn = simNetSubtotal - simAdminCut;
  const simGrandTotal = simNetSubtotal + simShipping + simGst;

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="size-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm font-medium animate-pulse">Loading B2B wholesale financial settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header for B2B */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Factory className="size-4 text-indigo-600" />
            <span>Dedicated B2B Wholesale & Sample Governance</span>
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] font-bold">
              Autonomous Policy
            </Badge>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Governs commission splits when Designers purchase single samples (1 product) or bulk wholesale batches (&gt; 1 product) directly from Print Providers.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            className="h-9 px-3 border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !isAllValid}
            className={`h-9 px-4 text-white rounded-xl text-xs font-bold shadow-md gap-2 cursor-pointer transition-all ${
              isAllValid
                ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                : "bg-slate-400 opacity-60 cursor-not-allowed hover:bg-slate-400"
            }`}
          >
            {saving ? (
              <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>Save B2B Governance</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Single Sample Commission</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Package className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-indigo-950">{singlePlatform.toFixed(1)}%</div>
            <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">Applied when buying 1 product</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Bulk Wholesale Commission</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Zap className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-950">{bulkPlatform.toFixed(1)}%</div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Applied when buying &gt; 1 product</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">B2B Courier Freight</span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Truck className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">₹{Number(form.standard_shipping_charge).toFixed(2)}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Free over <strong className="text-emerald-600">₹{Number(form.free_shipping_threshold).toFixed(0)}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Wholesale GST</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Receipt className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-purple-950">{Number(form.tax_percent).toFixed(1)}%</div>
            <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
              {form.gst_enabled ? "Active on B2B invoices" : "GST disabled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Configuration Grid & Live Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Configuration Cards */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Single Product (Sample) Commission Split */}
          <Card className={`rounded-2xl border bg-white shadow-xs transition-all ${!isSingleValid ? "border-rose-300 ring-2 ring-rose-200" : "border-slate-200/80"}`}>
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                    <Package className="size-3.5" />
                  </div>
                  <span>1. Single Product Commission (1 Product)</span>
                </CardTitle>
                <Badge className={isSingleValid ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold" : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold"}>
                  {isSingleValid ? "100.00% Balanced" : `Sum: ${singleTotal}%`}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Applied when a Designer orders <strong>1 single sample product</strong> to test fabric, print alignment, or color output.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Portal Admin Commission (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.single_platform_fee_percent}
                      onChange={(e) => handleChange("single_platform_fee_percent", parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs font-bold text-indigo-950 pr-7 rounded-xl"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Platform fee retained on single sample orders.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Print Provider Share (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.single_provider_margin_percent}
                      onChange={(e) => handleChange("single_provider_margin_percent", parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs font-bold text-amber-950 pr-7 rounded-xl"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Revenue paid to manufacturer for single item.</p>
                </div>
              </div>

              {!isSingleValid && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-900">
                  <span>Single split total is {singleTotal}% (must equal 100%).</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAutoAdjustSingleProvider}
                    className="h-7 text-[11px] bg-white text-rose-800 border-rose-300 font-bold"
                  >
                    Set Provider to {Number((100 - singlePlatform).toFixed(2))}%
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Bulk Wholesale Commission Split */}
          <Card className={`rounded-2xl border bg-white shadow-xs transition-all ${!isBulkValid ? "border-rose-300 ring-2 ring-rose-200" : "border-slate-200/80"}`}>
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                    <Zap className="size-3.5" />
                  </div>
                  <span>2. Bulk Wholesale Commission (&gt; 1 Product)</span>
                </CardTitle>
                <Badge className={isBulkValid ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold" : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold"}>
                  {isBulkValid ? "100.00% Balanced" : `Sum: ${bulkTotal}%`}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Applied automatically whenever a Designer purchases <strong>more than 1 product</strong> (2 or more items across the Color &times; Size matrix).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Portal Admin Bulk Commission (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.bulk_platform_fee_percent}
                      onChange={(e) => handleChange("bulk_platform_fee_percent", parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs font-bold text-emerald-950 pr-7 rounded-xl"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Platform fee retained when order quantity is &gt; 1 product.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Print Provider Bulk Share (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.bulk_provider_margin_percent}
                      onChange={(e) => handleChange("bulk_provider_margin_percent", parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs font-bold text-amber-950 pr-7 rounded-xl"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Wholesale manufacturing earnings paid to facility.</p>
                </div>
              </div>

              {!isBulkValid && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-900">
                  <span>Bulk split total is {bulkTotal}% (must equal 100%).</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAutoAdjustBulkProvider}
                    className="h-7 text-[11px] bg-white text-rose-800 border-rose-300 font-bold"
                  >
                    Set Provider to {Number((100 - bulkPlatform).toFixed(2))}%
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Wholesale Logistics */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1 rounded-md bg-sky-100 text-sky-700">
                  <Truck className="size-3.5" />
                </div>
                <span>3. Wholesale Logistics & Courier Freight</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Configure standard packaging freight and free delivery threshold for bulk wholesale orders.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Standard Courier Freight (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={form.standard_shipping_charge}
                    onChange={(e) => handleChange("standard_shipping_charge", parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs font-bold text-slate-900 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Applied on orders below free shipping threshold.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Free Shipping Threshold (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={form.free_shipping_threshold}
                    onChange={(e) => handleChange("free_shipping_threshold", parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs font-bold text-slate-900 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Subtotals at or above this amount receive free freight.</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Enable Automated Courier Freight</span>
                  <span className="text-[10px] text-slate-400">If toggled off, all B2B orders receive free freight.</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.shipping_enabled}
                  onChange={(e) => handleChange("shipping_enabled", e.target.checked)}
                  className="size-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Wholesale GST */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1 rounded-md bg-purple-100 text-purple-700">
                  <Receipt className="size-3.5" />
                </div>
                <span>4. Wholesale GST & Government Tax</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Legal GST tax invoice rate for wholesale manufacturing procurement.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">B2B GST Tax Rate (%)</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="28"
                    value={form.tax_percent}
                    onChange={(e) => handleChange("tax_percent", parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs font-bold text-slate-900 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Mandatory apparel tax rate (standard is 5% in India).</p>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 h-9">
                    <span className="text-xs font-bold text-slate-800">Collect B2B GST</span>
                    <input
                      type="checkbox"
                      checked={form.gst_enabled}
                      onChange={(e) => handleChange("gst_enabled", e.target.checked)}
                      className="size-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Attach tax line item on wholesale invoice.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 5 Cols: Live B2B Settlement Simulator */}
        <div className="lg:col-span-5 sticky top-6">
          <Card className="rounded-3xl border-slate-200 shadow-md bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-indigo-300" />
                  Live B2B Split Simulator
                </span>
                <Badge className="bg-white/10 text-white text-[10px] font-bold border-white/20">Real-Time</Badge>
              </div>
              <p className="text-xs text-indigo-200">
                Preview how funds are calculated and divided between Provider, Platform, and GST on single sample vs bulk orders.
              </p>
            </div>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Simulate Order Units</label>
                  <Input
                    type="number"
                    min="1"
                    value={simUnits}
                    onChange={(e) => setSimUnits(parseInt(e.target.value) || 1)}
                    className="h-8 text-xs font-bold rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Unit Wholesale Price (₹)</label>
                  <Input
                    type="number"
                    min="1"
                    value={simUnitPrice}
                    onChange={(e) => setSimUnitPrice(parseInt(e.target.value) || 240)}
                    className="h-8 text-xs font-bold rounded-lg"
                  />
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
                <button
                  type="button"
                  onClick={() => setSimUnits(1)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                    simUnits === 1 ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  1 (Sample)
                </button>
                <button
                  type="button"
                  onClick={() => setSimUnits(10)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                    simUnits === 10 ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  10 pcs (Bulk)
                </button>
                <button
                  type="button"
                  onClick={() => setSimUnits(50)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                    simUnits === 50 ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  50 pcs (Bulk)
                </button>
                <button
                  type="button"
                  onClick={() => setSimUnits(100)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                    simUnits === 100 ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  100 pcs (Bulk)
                </button>
              </div>

              {/* Status Notice */}
              <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                isBulkMode
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-indigo-50/70 border-indigo-200 text-indigo-900"
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${isBulkMode ? "bg-emerald-600" : "bg-indigo-600"}`} />
                  <span className="font-bold">
                    {isBulkMode ? `Bulk Wholesale (> 1 Product)` : `Single Product Sample (1 Product)`}
                  </span>
                </div>
                <Badge className={isBulkMode ? "bg-emerald-600 text-white text-[10px]" : "bg-indigo-600 text-white text-[10px]"}>
                  {isBulkMode ? `Bulk Commission: ${bulkPlatform}%` : `Single Commission: ${singlePlatform}%`}
                </Badge>
              </div>

              {/* Calculation Breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Base Wholesale Subtotal ({units} &times; ₹{unitPrice}):</span>
                  <span className="font-bold text-slate-900">₹{rawTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Bulk Courier Freight:</span>
                  <span className={`font-bold ${simShipping === 0 ? "text-emerald-600" : "text-slate-900"}`}>
                    {simShipping === 0 ? "FREE" : `+₹${simShipping.toFixed(2)}`}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Govt. GST ({Number(form.tax_percent)}%):</span>
                  <span className="font-bold text-slate-900">+₹{simGst.toFixed(2)}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-black text-slate-900">Designer Pays Total:</span>
                  <span className="text-lg font-black text-slate-900">₹{simGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Revenue Division Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Automatic Fund Settlement ({isBulkMode ? `Bulk Rate: ${bulkProvider}% / ${bulkPlatform}%` : `Single Rate: ${singleProvider}% / ${singlePlatform}%`})
                </span>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                    <Factory className="size-3 text-amber-600" />
                    Print Provider Payout ({simProviderPercent}%):
                  </span>
                  <span className="font-black text-slate-900">₹{simProviderEarn.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-indigo-800 font-semibold flex items-center gap-1.5">
                    <Percent className="size-3 text-indigo-600" />
                    Portal Admin Commission ({simPlatformPercent}%):
                  </span>
                  <span className="font-black text-slate-900">₹{simAdminCut.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
