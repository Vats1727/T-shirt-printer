import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime } from "@/utils/dateFormatter";
import {
  DollarSign,
  Truck,
  Percent,
  Palette,
  Factory,
  Save,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  HelpCircle,
  Coins,
  Receipt,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Package,
  Store
} from "lucide-react";
import B2BFinancialSettings from "./B2BFinancialSettings";

const DEFAULT_SETTINGS = {
  standard_shipping_charge: 50.00,
  free_shipping_threshold: 500.00,
  shipping_enabled: true,
  platform_fee_percent: 10.00,
  platform_fixed_fee: 0.00,
  designer_margin_percent: 35.00,
  min_designer_margin_percent: 10.00,
  provider_margin_percent: 55.00,
  min_provider_margin_percent: 50.00,
  tax_percent: 5.00,
  gst_enabled: true,
  notes: "Global financial governance rules set by Portal Superadmin"
};

export default function FinancialSettings() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeGovernanceTab, setActiveGovernanceTab] = useState("b2c"); // 'b2c' | 'b2b'
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [simulatedPrice, setSimulatedPrice] = useState(500);

  // Fetch active settings from server
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/portal/financial-settings"],
    queryFn: async () => {
      const res = await fetch("/api/portal/financial-settings", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to load financial settings");
      return res.json();
    },
    enabled: !!token
  });

  useEffect(() => {
    if (data?.settings) {
      setForm({
        standard_shipping_charge: Number(data.settings.standard_shipping_charge ?? 50),
        free_shipping_threshold: Number(data.settings.free_shipping_threshold ?? 500),
        shipping_enabled: Boolean(data.settings.shipping_enabled ?? true),
        platform_fee_percent: Number(data.settings.platform_fee_percent ?? 10),
        platform_fixed_fee: Number(data.settings.platform_fixed_fee ?? 0),
        designer_margin_percent: Number(data.settings.designer_margin_percent ?? 35),
        min_designer_margin_percent: Number(data.settings.min_designer_margin_percent ?? 10),
        provider_margin_percent: Number(data.settings.provider_margin_percent ?? 55),
        min_provider_margin_percent: Number(data.settings.min_provider_margin_percent ?? 50),
        tax_percent: Number(data.settings.tax_percent ?? 5),
        gst_enabled: Boolean(data.settings.gst_enabled ?? true),
        notes: data.settings.notes || ""
      });
    }
  }, [data]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const platformPercent = Number(form.platform_fee_percent || 0);
  const designerPercent = Number(form.designer_margin_percent || 0);
  const providerPercent = Number(form.provider_margin_percent || 0);
  const totalSplitPercent = Number((platformPercent + designerPercent + providerPercent).toFixed(2));
  const isSplitValid = Math.abs(totalSplitPercent - 100) < 0.01;
  const splitDiff = Number((100 - totalSplitPercent).toFixed(2));

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    // Strictly verify percentage sum equals exactly 100%
    const totalSplit = Number((Number(form.platform_fee_percent || 0) + Number(form.designer_margin_percent || 0) + Number(form.provider_margin_percent || 0)).toFixed(2));
    if (Math.abs(totalSplit - 100) > 0.01) {
      const diff = Number((100 - totalSplit).toFixed(2));
      const differenceNotice = diff > 0
        ? `Under by ${diff}% (Current sum: ${totalSplit}%). You need to allocate +${diff}% more.`
        : `Over by ${Math.abs(diff)}% (Current sum: ${totalSplit}%). You need to reduce by ${Math.abs(diff)}%.`;

      toast({
        title: "Total Allocation Must Equal 100%",
        description: `Total commission percentages must equal exactly 100.00%. (Platform: ${form.platform_fee_percent}%, Designer: ${form.designer_margin_percent}%, Provider: ${form.provider_margin_percent}%). ${differenceNotice}`,
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/portal/financial-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(form)
      });
      const js = await res.json();
      if (!res.ok || !js.success) {
        throw new Error(js.message || "Failed to update settings");
      }

      toast({
        title: "Financial Governance Rules Enforced!",
        description: `Successfully applied: Platform Commission ${form.platform_fee_percent}%, Designer Margin ${form.designer_margin_percent}%, Print Provider Share ${form.provider_margin_percent}% (Total: 100%).`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/financial-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/financial"] });
    } catch (err) {
      toast({
        title: "Save Failed",
        description: err.message || "Could not save financial settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_SETTINGS);
    toast({
      title: "Reset to Baseline (Option 1)",
      description: "Reset to default 100% split: 10% Platform Commission, 35% Designer Margin, 55% Print Provider Share. Click Save to enforce."
    });
  };

  // Calculations for live profit simulator
  const simSubtotal = Math.max(0, Number(simulatedPrice || 0));
  const simShipping = (form.shipping_enabled && simSubtotal < form.free_shipping_threshold && simSubtotal > 0)
    ? Number(form.standard_shipping_charge)
    : 0;
  const simGstRate = Number(form.tax_percent || 0);
  const simGst = (form.gst_enabled && simGstRate > 0)
    ? Number(((simSubtotal * simGstRate) / 100).toFixed(2))
    : 0;
  const simPlatformFee = Math.round(simSubtotal * (Number(form.platform_fee_percent) / 100));
  const simProvider = Math.round(simSubtotal * (Number(form.provider_margin_percent) / 100));
  const simDesigner = Math.max(0, simSubtotal - simProvider - simPlatformFee);
  const simTotalCustomer = Number((simSubtotal + simShipping + simGst).toFixed(2));

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="size-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm font-medium animate-pulse">Loading global financial governance settings...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl shadow-md">
            <DollarSign className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Financial Governance & Global Margins
              </h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                Live & Enforced
              </Badge>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 max-w-2xl">
              Centrally govern customer shipping charges, platform commissions, designer profit margins, and print facility splits across all storefronts.
            </p>
          </div>
        </div>

        {activeGovernanceTab === "b2c" && (
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              className="h-10 px-3.5 border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset Defaults</span>
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !isSplitValid}
              className={`h-10 px-5 text-white rounded-xl text-xs font-bold shadow-md gap-2 cursor-pointer transition-all ${
                isSplitValid
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                  : "bg-slate-400 opacity-60 cursor-not-allowed hover:bg-slate-400"
              }`}
              title={!isSplitValid ? `Cannot save: Sum is ${totalSplitPercent}% (must equal 100.0%)` : "Save global rules"}
            >
              {saving ? (
                <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span>Save Global Rules</span>
            </Button>
          </div>
        )}
      </div>

      {/* Governance Scope Switcher: Retail B2C Storefront vs Designer Wholesale B2B */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl w-fit border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveGovernanceTab("b2c")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeGovernanceTab === "b2c"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Store className="size-3.5" />
          <span>Retail Storefront Split (B2C)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGovernanceTab("b2b")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeGovernanceTab === "b2b"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Factory className="size-3.5" />
          <span>Designer Wholesale & Sample Governance (B2B)</span>
          <Badge className="bg-indigo-100 text-indigo-700 border-none text-[9px] px-1.5 py-0 font-extrabold uppercase">
            Isolated
          </Badge>
        </button>
      </div>

      {activeGovernanceTab === "b2b" ? (
        <B2BFinancialSettings />
      ) : (
        <>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Shipping Card */}
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Standard Shipping</span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Truck className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">₹{Number(form.standard_shipping_charge).toFixed(2)}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Free over <strong className="text-emerald-600">₹{Number(form.free_shipping_threshold).toFixed(2)}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Platform Fee Card */}
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Platform Commission</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Percent className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">{Number(form.platform_fee_percent).toFixed(1)}%</div>
            <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
              Pure % platform revenue
            </p>
          </CardContent>
        </Card>

        {/* Designer Margin Card */}
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Designer Share</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Palette className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-purple-700">{Number(form.designer_margin_percent).toFixed(1)}%</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Min. {Number(form.min_designer_margin_percent).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* Print Provider Margin Card */}
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Provider Share</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Factory className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-amber-700">{Number(form.provider_margin_percent).toFixed(1)}%</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Min. {Number(form.min_provider_margin_percent).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* Apparel GST Card */}
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Apparel GST</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Receipt className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              {form.gst_enabled ? `${Number(form.tax_percent).toFixed(1)}%` : "0.0%"}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {form.gst_enabled ? (
                <span className="text-emerald-600 font-bold">Added at Checkout (Option A)</span>
              ) : (
                <span className="text-slate-400">Disabled</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Commission Allocation Validation Status Banner */}
      {!isSplitValid ? (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                  Total Commission Allocation Must Equal Exactly 100%
                </h4>
                <Badge className="bg-rose-200 text-rose-900 border-rose-300 text-[10px] font-black uppercase tracking-wider">
                  Save Blocked
                </Badge>
              </div>
              <p className="text-xs text-rose-700 mt-1">
                Current total is <strong className="text-rose-950 underline font-black">{totalSplitPercent.toFixed(2)}%</strong> (Platform {platformPercent}% + Designer {designerPercent}% + Provider {providerPercent}%).
                {" "}
                <span className="font-bold text-rose-900">
                  {splitDiff > 0
                    ? `⚠️ You need to allocate +${splitDiff.toFixed(2)}% more across parties to reach 100.00%.`
                    : `⚠️ Split exceeds 100% by ${Math.abs(splitDiff).toFixed(2)}%. Please reduce percentages.`}
                </span>
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs font-extrabold text-rose-800 bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200">
              {splitDiff > 0 ? `-${splitDiff.toFixed(2)}% Deficit` : `+${Math.abs(splitDiff).toFixed(2)}% Surplus`}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Commission Allocation Balanced (100.00%)
                </h4>
                <Badge className="bg-emerald-200 text-emerald-900 border-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Ready to Save
                </Badge>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Platform Commission ({platformPercent}%) + Designer Royalty ({designerPercent}%) + Print Provider Share ({providerPercent}%) = <strong className="text-emerald-950 font-black">100.00%</strong>.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300">
              100.00% Exact Split
            </span>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Governance Settings Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Shipping Charges */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                  <Truck className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">1. Customer Shipping Charges</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Controls default courier fees and the free delivery eligibility threshold.
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] font-bold">
                Customer Facing
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Standard Delivery Charge (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={form.standard_shipping_charge}
                      onChange={(e) => handleChange("standard_shipping_charge", e.target.value)}
                      className="pl-7 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">Charged on checkout when order is below threshold.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Free Shipping Threshold (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={form.free_shipping_threshold}
                      onChange={(e) => handleChange("free_shipping_threshold", e.target.value)}
                      className="pl-7 rounded-xl text-xs font-bold text-emerald-700"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">Cart subtotals equal to or above this amount receive ₹0 shipping.</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800">Enable Automated Shipping Collection</span>
                  <p className="text-[11px] text-slate-500">If toggled off, all storefront orders will have free shipping applied.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange("shipping_enabled", !form.shipping_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.shipping_enabled ? "bg-indigo-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                      form.shipping_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Portal Admin Commission (Percentage Only) */}
          <Card className="rounded-2xl border-indigo-200/90 bg-gradient-to-br from-indigo-50/30 via-white to-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-indigo-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Percent className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-extrabold text-slate-900">
                    2. Portal Admin Platform Commission (%)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Your percentage commission retained directly on every garment sold across all storefronts.
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px] font-black uppercase tracking-wider">
                Platform Earnings
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Manage Portal Admin Commission Rate (%)
                </label>
                <div className="relative max-w-sm">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.platform_fee_percent}
                    onChange={(e) => handleChange("platform_fee_percent", e.target.value)}
                    className="pr-8 rounded-xl text-sm font-black text-indigo-700 h-11 border-indigo-200 focus-visible:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-black">%</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Percentage automatically credited to Portal Admin from garment subtotal. (Pure percentage, no flat fees).
                </p>
              </div>

              {/* Quick Auto-Balance Assistant */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Auto-Adjust Remaining {Number((100 - Number(form.platform_fee_percent || 0)).toFixed(2))}%
                  </span>
                  <span className="text-[10px] text-slate-400">1-click balance helper</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const adminP = Number(form.platform_fee_percent || 0);
                      const rem = Math.max(0, 100 - adminP);
                      const desgP = Number(form.designer_margin_percent || 35);
                      const provP = Number((rem - desgP).toFixed(2));
                      setForm((prev) => ({
                        ...prev,
                        provider_margin_percent: Math.max(0, provP)
                      }));
                    }}
                    className="h-7 text-[10px] font-bold rounded-lg bg-white hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer"
                  >
                    Adjust Provider Share
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const adminP = Number(form.platform_fee_percent || 0);
                      const rem = Math.max(0, 100 - adminP);
                      const provP = Number(form.provider_margin_percent || 55);
                      const desgP = Number((rem - provP).toFixed(2));
                      setForm((prev) => ({
                        ...prev,
                        designer_margin_percent: Math.max(0, desgP)
                      }));
                    }}
                    className="h-7 text-[10px] font-bold rounded-lg bg-white hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer"
                  >
                    Adjust Designer Share
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const adminP = Number(form.platform_fee_percent || 0);
                      const rem = Math.max(0, 100 - adminP);
                      const provRatio = 55 / 90;
                      const provP = Number((rem * provRatio).toFixed(1));
                      const desgP = Number((rem - provP).toFixed(1));
                      setForm((prev) => ({
                        ...prev,
                        provider_margin_percent: provP,
                        designer_margin_percent: desgP
                      }));
                    }}
                    className="h-7 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 cursor-pointer"
                  >
                    Balance Both Pro-Rata
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Designer Profit Margin */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Palette className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">3. Designer Profit Margin Rules</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Defines royalty distribution credited to fashion creators when products sell.
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold">
                Creator Royalty
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Default Designer Margin (%)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.designer_margin_percent}
                      onChange={(e) => handleChange("designer_margin_percent", e.target.value)}
                      className="pr-7 rounded-xl text-xs font-bold text-purple-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Share of subtotal credited to designer on sales.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Minimum Allowed Designer Margin (%)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.min_designer_margin_percent}
                      onChange={(e) => handleChange("min_designer_margin_percent", e.target.value)}
                      className="pr-7 rounded-xl text-xs font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Floor threshold when designer customizes retail price.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Print Provider Margin & Manufacturing Share */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Factory className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">4. Print Provider Manufacturing Share</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Compensates verified printing hubs for blank garments, DTG ink printing, curing, and packaging.
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                Facility Payout
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Default Production Share (%)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.provider_margin_percent}
                      onChange={(e) => handleChange("provider_margin_percent", e.target.value)}
                      className="pr-7 rounded-xl text-xs font-bold text-amber-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Guaranteed production revenue to manufacturer.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Minimum Provider Base Share (%)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.min_provider_margin_percent}
                      onChange={(e) => handleChange("min_provider_margin_percent", e.target.value)}
                      className="pr-7 rounded-xl text-xs font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Protects manufacturing partners from deficit production.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: GST & Taxation Governance (Option A) */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Receipt className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">5. GST & Taxation Governance</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Governs retail apparel GST applied to customers at checkout (Option A).
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                Option A &bull; Customer Checkout
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Apparel Retail GST Rate (%)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="28"
                      step="0.5"
                      value={form.tax_percent}
                      onChange={(e) => handleChange("tax_percent", e.target.value)}
                      className="pr-7 rounded-xl text-xs font-bold text-emerald-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Added to order subtotal at checkout (Standard apparel rate: 5% or 12%).</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Tax Application Model</label>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 font-bold flex items-center justify-between">
                    <span>Option A (Transparent at Checkout)</span>
                    <Badge variant="outline" className="text-[10px] bg-white border-emerald-300 text-emerald-700">Active</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">Garment subtotal is 100% split across participants; GST is held in tax ledger.</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800">Enable Automated GST Collection</span>
                  <p className="text-[11px] text-slate-500">If toggled off, 0% tax is collected on customer checkout.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange("gst_enabled", !form.gst_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    form.gst_enabled ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                      form.gst_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Profit Split Simulator & Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Simulator */}
          <Card className="rounded-2xl border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 via-white to-white shadow-md sticky top-6">
            <CardHeader className="p-5 pb-3 border-b border-indigo-100">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-indigo-600" />
                <CardTitle className="text-sm font-extrabold text-slate-900">
                  Live Financial Split Simulator
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Preview how funds will be divided on an incoming customer garment purchase.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Simulator Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Simulate Retail Price:</span>
                  <span className="font-black text-indigo-600 text-base">₹{Number(simulatedPrice).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">₹</span>
                  <Input
                    type="number"
                    min="10"
                    step="50"
                    value={simulatedPrice}
                    onChange={(e) => setSimulatedPrice(Math.max(0, Number(e.target.value)))}
                    className="rounded-xl text-xs font-extrabold"
                  />
                  <div className="flex gap-1">
                    {[299, 499, 999].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSimulatedPrice(p)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                      >
                        ₹{p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visual Split Distribution Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>Margin Allocation Split</span>
                  <span className={isSplitValid ? "text-emerald-600 font-extrabold" : "text-rose-600 font-extrabold"}>
                    {totalSplitPercent.toFixed(1)}% / 100.0% {isSplitValid ? "✓ (Balanced)" : "✗ (Unbalanced)"}
                  </span>
                </div>
                <div className={`h-4 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner border transition-all ${
                  isSplitValid ? "border-emerald-300" : "border-rose-400 ring-2 ring-rose-200"
                }`}>
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, Number(form.provider_margin_percent)))}%` }}
                    className="bg-amber-500 transition-all"
                    title={`Print Provider: ${form.provider_margin_percent}%`}
                  />
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, Number(form.designer_margin_percent)))}%` }}
                    className="bg-purple-500 transition-all"
                    title={`Designer: ${form.designer_margin_percent}%`}
                  />
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, Number(form.platform_fee_percent)))}%` }}
                    className="bg-indigo-600 transition-all"
                    title={`Platform Fee: ${form.platform_fee_percent}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" /> Provider ({form.provider_margin_percent}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-purple-500" /> Designer ({form.designer_margin_percent}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-indigo-600" /> Platform ({form.platform_fee_percent}%)
                  </span>
                </div>
              </div>

              {/* Financial Breakdown Receipt */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Product Subtotal</span>
                  <strong className="text-slate-900">₹{simSubtotal.toFixed(2)}</strong>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>Delivery Charge</span>
                    {simShipping === 0 && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 rounded-full font-bold">
                        FREE
                      </span>
                    )}
                  </span>
                  <strong className={simShipping === 0 ? "text-emerald-600" : "text-slate-900"}>
                    {simShipping === 0 ? "₹0.00" : `₹${simShipping.toFixed(2)}`}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>GST ({form.tax_percent}%)</span>
                    {!form.gst_enabled && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full font-bold">
                        DISABLED
                      </span>
                    )}
                  </span>
                  <strong className={simGst === 0 ? "text-slate-400" : "text-emerald-700"}>
                    {simGst === 0 ? "₹0.00" : `₹${simGst.toFixed(2)}`}
                  </strong>
                </div>

                <div className="border-t border-slate-200 pt-2 flex items-center justify-between font-extrabold text-sm text-slate-900">
                  <span>Customer Pays Total</span>
                  <span className="text-indigo-600 text-base">₹{simTotalCustomer.toFixed(2)}</span>
                </div>

                <div className="border-t border-dashed border-slate-200 pt-3 space-y-2">
                  <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                    Automatic Fund Settlement
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 text-amber-900">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Factory className="size-3.5 text-amber-600" />
                      <span>Print Provider Payout ({form.provider_margin_percent}%)</span>
                    </span>
                    <strong className="font-black">₹{simProvider.toFixed(2)}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/70 border border-purple-200/60 text-purple-900">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Palette className="size-3.5 text-purple-600" />
                      <span>Designer Royalty ({form.designer_margin_percent}%)</span>
                    </span>
                    <strong className="font-black">₹{simDesigner.toFixed(2)}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/70 border border-indigo-200/60 text-indigo-900">
                    <span className="flex items-center gap-1.5 font-bold">
                      <DollarSign className="size-3.5 text-indigo-600" />
                      <span>Platform Commission ({form.platform_fee_percent}%)</span>
                    </span>
                    <strong className="font-black">₹{simPlatformFee.toFixed(2)}</strong>
                  </div>

                  {simGst > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-emerald-900">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Receipt className="size-3.5 text-emerald-600" />
                        <span>Govt. GST Escrow Ledger ({form.tax_percent}%)</span>
                      </span>
                      <strong className="font-black">₹{simGst.toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Note */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                <span>
                  Last modified: {data?.settings?.updated_at ? formatDateTime(data.settings.updated_at) : "System Default"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

