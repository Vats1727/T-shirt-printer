import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/utils/cn";
import {
  CreditCard,
  Sparkles,
  Users,
  IndianRupee,
  Search,
  RefreshCw,
  Plus,
  Edit3,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Palette,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  ShieldAlert
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

// Helper to format numeric quota limits (treats -1, null, undefined as Unlimited)
function formatQuota(val, unit = "") {
  if (val === null || val === undefined || val === -1 || val === "-1" || Number(val) < 0) {
    return "Unlimited";
  }
  return unit ? `${val} ${unit}` : String(val);
}

export default function PortalSubscriptions() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("plans"); // 'plans' | 'subscribers'
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPlan, setEditingPlan] = useState(null);
  const [grantingUser, setGrantingUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states for Plan Editing
  const [editPriceRupees, setEditPriceRupees] = useState("");
  const [editMaxProducts, setEditMaxProducts] = useState("");
  const [editMaxDesigns, setEditMaxDesigns] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsPopular, setEditIsPopular] = useState(false);

  // Form states for Granting Subscriptions
  const [grantPlanId, setGrantPlanId] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [grantReason, setGrantReason] = useState("");

  // 1. Fetch Subscription Stats
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/portal/subscriptions/stats"],
    queryFn: async () => {
      const res = await fetch("/api/portal/subscriptions/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load subscription stats");
      return res.json();
    },
    enabled: !!token
  });

  // 2. Fetch All Subscription Plans
  const { data: plansData, isLoading: plansLoading, isFetching: plansFetching, refetch: refetchPlans } = useQuery({
    queryKey: ["/api/portal/subscriptions/plans"],
    queryFn: async () => {
      const res = await fetch("/api/portal/subscriptions/plans", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load subscription plans");
      return res.json();
    },
    enabled: !!token
  });

  // 3. Fetch Subscribers Ledger
  const { data: subscribersData, isLoading: subsLoading, isFetching: subsFetching, refetch: refetchSubs } = useQuery({
    queryKey: ["/api/portal/subscriptions/subscribers"],
    queryFn: async () => {
      const res = await fetch("/api/portal/subscriptions/subscribers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load subscribers ledger");
      return res.json();
    },
    enabled: !!token
  });

  const stats = statsData?.stats || {};
  const activePaidSubscribers = stats.activePaidSubscribers ?? stats.active_paid_subscribers ?? 0;
  const activePaidProviders = stats.activePaidProviders ?? stats.active_providers_paid ?? 0;
  const activePaidDesigners = stats.activePaidDesigners ?? stats.active_designers_paid ?? 0;
  const mrrVal = stats.mrrRupees ?? (Math.round((stats.mrrPaise || stats.mrr_paise || 0) / 100));

  const plans = plansData?.plans || [];
  const subscribers = subscribersData?.subscribers || [];

  // Open Edit Modal
  function handleOpenEdit(plan) {
    setEditingPlan(plan);
    setEditPriceRupees(String(Math.round((plan.price_paise || 0) / 100)));
    const pLimit = plan.limits?.max_products;
    setEditMaxProducts(pLimit === -1 || pLimit === null || pLimit === undefined ? "" : String(pLimit));
    const dLimit = plan.limits?.max_designs;
    setEditMaxDesigns(dLimit === -1 || dLimit === null || dLimit === undefined ? "" : String(dLimit));
    setEditIsActive(Boolean(plan.is_active));
    setEditIsPopular(Boolean(plan.is_popular));
  }

  // Save Plan Edits Mutation
  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      const pricePaise = Math.round(Number(editPriceRupees || 0) * 100);
      const parsedProducts = editMaxProducts.trim() === "" || Number(editMaxProducts) <= -1 ? -1 : Number(editMaxProducts);
      const parsedDesigns = editMaxDesigns.trim() === "" || Number(editMaxDesigns) <= -1 ? -1 : Number(editMaxDesigns);
      const limits = {
        ...editingPlan.limits,
        max_products: parsedProducts,
        max_designs: parsedDesigns
      };

      const res = await fetch(`/api/portal/subscriptions/plans/${editingPlan.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pricePaise,
          limits,
          isActive: editIsActive,
          isPopular: editIsPopular
        })
      });

      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Failed to update plan");
      return js;
    },
    onSuccess: () => {
      toast({
        title: "Subscription Plan Updated",
        description: `Plan "${editingPlan?.name}" has been updated successfully.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions/plans"] });
      setEditingPlan(null);
    },
    onError: (err) => {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Grant Subscription Mutation
  const grantSubMutation = useMutation({
    mutationFn: async () => {
      if (!grantPlanId) throw new Error("Please select a plan to grant.");
      if (!grantReason.trim()) throw new Error("Please provide an administrative reason for the audit trail.");

      const res = await fetch(`/api/portal/subscriptions/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: grantingUser.user_id,
          planId: Number(grantPlanId),
          durationDays: Number(grantDays),
          grantReason: grantReason.trim(),
          grantType: "complimentary"
        })
      });

      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Failed to grant subscription");
      return js;
    },
    onSuccess: () => {
      toast({
        title: "Tier Granted Successfully",
        description: `Subscription granted to ${grantingUser?.user_name} for ${grantDays} days.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions/subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions/stats"] });
      setGrantingUser(null);
      setGrantReason("");
    },
    onError: (err) => {
      toast({
        title: "Grant Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Filtered subscribers list
  const filteredSubscribers = subscribers.filter((sub) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const sName = (sub.name || sub.user_name || "").toLowerCase();
    const sEmail = (sub.email || sub.user_email || "").toLowerCase();
    const sPlan = (sub.plan_name || "").toLowerCase();
    const sRole = (sub.role || sub.user_role || "").toLowerCase();
    return sName.includes(term) || sEmail.includes(term) || sPlan.includes(term) || sRole.includes(term);
  });

  const mrrRupees = Number(mrrVal || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              SaaS Subscription Governance
            </h1>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-[10px]">
              Platform Monetization
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Superadmin console to govern platform subscription tiers, monthly pricing, quota limits, and subscriber accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPlans();
              refetchStats();
              refetchSubs();
            }}
            disabled={plansFetching || subsFetching}
            className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", (plansFetching || subsFetching) && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards (4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: MRR */}
        <Card className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Platform MRR
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">₹{mrrRupees}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Active recurring SaaS billing
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Active Paid Subscribers */}
        <Card className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Paid Subscribers
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              {activePaidSubscribers}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Partners on active paid tiers
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Paid Providers */}
        <Card className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Paid Print Providers
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              {activePaidProviders}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Pro & Enterprise facilities
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Paid Designers */}
        <Card className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200">
          <CardHeader className="p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Paid Designers
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Palette className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900">
              {activePaidDesigners}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Pro Designer studio creators
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("plans")}
          className={cn(
            "pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2",
            activeTab === "plans"
              ? "text-indigo-600 border-b-2 border-indigo-600 font-black"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Subscription Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("subscribers")}
          className={cn(
            "pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2",
            activeTab === "subscribers"
              ? "text-indigo-600 border-b-2 border-indigo-600 font-black"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          Partner Subscribers Ledger ({subscribers.length})
        </button>
      </div>

      {/* TAB 1: Subscription Plans Management */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const priceRupees = Math.round((plan.price_paise || 0) / 100);
              const isFree = priceRupees === 0;

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md",
                    plan.is_popular
                      ? "border-indigo-400 bg-gradient-to-b from-indigo-50/40 via-white to-white ring-1 ring-indigo-400/50"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm">
                            {plan.name}
                          </h3>
                          {plan.is_popular && (
                            <Badge className="bg-indigo-600 text-white text-[9px] font-bold py-0 px-1.5 rounded-full">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {plan.plan_code}
                        </p>
                      </div>

                      <Badge
                        className={cn(
                          "text-[10px] font-semibold py-0 px-1.5 capitalize",
                          plan.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Pricing */}
                    <div className="py-2 border-y border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900">
                          ₹{priceRupees.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {isFree ? "/ lifetime" : `/${plan.billing_interval || "mo"}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Role: <span className="font-semibold text-slate-700 capitalize">{plan.target_role?.replace("_", " ")}</span>
                      </p>
                    </div>

                    {/* Limits & Quotas */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Product Limit:</span>
                        {formatQuota(plan.limits?.max_products) === "Unlimited" ? (
                          <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 py-0 px-2 rounded-md">
                            Unlimited
                          </Badge>
                        ) : (
                          <span className="font-bold text-slate-900">{plan.limits?.max_products}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Design Limit:</span>
                        {formatQuota(plan.limits?.max_designs) === "Unlimited" ? (
                          <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 py-0 px-2 rounded-md">
                            Unlimited
                          </Badge>
                        ) : (
                          <span className="font-bold text-slate-900">{plan.limits?.max_designs}</span>
                        )}
                      </div>
                    </div>

                    {/* Features Checklist */}
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Included Features</p>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {Array.isArray(plan.features) && plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-1.5 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(plan)}
                      className="h-8 px-3 text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-white rounded-xl shadow-2xs font-semibold"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      Edit Plan
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Subscribers Ledger */}
      {activeTab === "subscribers" && (
        <Card className="rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden bg-white">
          <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Partner Subscription Directory
              </CardTitle>
              <p className="text-xs text-slate-500">
                Ledger of all active and historical subscriptions held by print facilities and designers.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search partner or plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-xs rounded-xl border-slate-200"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60 text-slate-600 text-xs">
                    <TableHead className="font-bold">Partner Account</TableHead>
                    <TableHead className="font-bold">Role</TableHead>
                    <TableHead className="font-bold">Current Plan</TableHead>
                    <TableHead className="font-bold">Grant Type</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold">Period Expiry</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscribers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                        No subscription records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubscribers.map((sub) => {
                      const isDesigner = (sub.role || sub.user_role) === "designer";
                      const pName = sub.name || sub.user_name || "Unnamed";
                      const pEmail = sub.email || sub.user_email;
                      const subStatus = sub.subscription_status || sub.sub_status || (sub.plan_name ? "active" : "starter");

                      return (
                        <TableRow key={sub.user_id} className="text-xs hover:bg-slate-50/50">
                          <TableCell>
                            <div>
                              <p className="font-bold text-slate-900">{pName}</p>
                              <p className="text-[11px] text-slate-500 font-mono">{pEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[10px] font-bold py-0.5 px-2",
                                isDesigner
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              )}
                            >
                              {isDesigner ? "Designer" : "Print Provider"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">{sub.plan_name || "Starter Partner"}</span>
                              {sub.plan_tier && (
                                <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] uppercase font-bold py-0 px-1">
                                  {sub.plan_tier}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="capitalize text-slate-600 font-medium">
                              {sub.grant_type || "default"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[10px] font-bold py-0.5 px-2",
                                subStatus === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              )}
                            >
                              {subStatus === "active" ? "Active" : "Starter"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-slate-600 font-mono text-[11px]">
                              {sub.expires_at ? format(new Date(sub.expires_at), "dd-MM-yyyy") : "Lifetime"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setGrantingUser({ ...sub, user_name: pName });
                                setGrantPlanId(String(plans[0]?.id || ""));
                              }}
                              className="h-7 px-2.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 rounded-lg shadow-2xs font-semibold"
                            >
                              Grant Tier
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: Edit Subscription Plan */}
      <Dialog open={Boolean(editingPlan)} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Edit {editingPlan?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Update monthly pricing, quota caps, and active visibility for this plan.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Monthly Price Field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Monthly Price (₹ INR)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editPriceRupees}
                  onChange={(e) => setEditPriceRupees(e.target.value)}
                  className="pl-7 font-bold text-sm h-9 rounded-lg"
                  placeholder="0"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Stored in integer paise ({Math.round(Number(editPriceRupees || 0) * 100)} paise).
              </p>
            </div>

            {/* Quota Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-slate-700">Max Products Cap</Label>
                  <span className="text-[10px] font-bold text-slate-500">
                    {editMaxProducts === "" || Number(editMaxProducts) <= -1 ? "Unlimited" : `${editMaxProducts} items`}
                  </span>
                </div>
                <Input
                  type="number"
                  placeholder="Blank for unlimited"
                  value={editMaxProducts}
                  onChange={(e) => setEditMaxProducts(e.target.value)}
                  className="text-xs h-9 rounded-lg"
                />
                <p className="text-[10px] text-slate-400">Leave blank for unlimited product listings.</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-slate-700">Max Designs Cap</Label>
                  <span className="text-[10px] font-bold text-slate-500">
                    {editMaxDesigns === "" || Number(editMaxDesigns) <= -1 ? "Unlimited" : `${editMaxDesigns} items`}
                  </span>
                </div>
                <Input
                  type="number"
                  placeholder="Blank for unlimited"
                  value={editMaxDesigns}
                  onChange={(e) => setEditMaxDesigns(e.target.value)}
                  className="text-xs h-9 rounded-lg"
                />
                <p className="text-[10px] text-slate-400">Leave blank for unlimited design uploads.</p>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Plan Active Status</p>
                  <p className="text-[10px] text-slate-500">Visible to partners for subscription checkout.</p>
                </div>
                <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Featured / Popular Badge</p>
                  <p className="text-[10px] text-slate-500">Highlight this plan on the upgrade screen.</p>
                </div>
                <Switch checked={editIsPopular} onCheckedChange={setEditIsPopular} />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingPlan(null)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updatePlanMutation.isPending}
              onClick={() => updatePlanMutation.mutate()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl"
            >
              {updatePlanMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Administrative Tier Grant */}
      <Dialog open={Boolean(grantingUser)} onOpenChange={(open) => !open && setGrantingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Grant Tier: {grantingUser?.user_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Grant a complimentary or extended subscription tier with mandatory audit reason.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Select Plan</Label>
              <select
                value={grantPlanId}
                onChange={(e) => setGrantPlanId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white text-slate-800"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.target_role}) — ₹{Math.round(p.price_paise / 100)}/mo
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Extension Duration</Label>
              <select
                value={grantDays}
                onChange={(e) => setGrantDays(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white text-slate-800"
              >
                <option value="30">30 Days (1 Month)</option>
                <option value="90">90 Days (1 Quarter)</option>
                <option value="180">180 Days (Half Year)</option>
                <option value="365">365 Days (1 Year)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Audit Reason <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="text"
                placeholder="e.g. VIP onboarding trial grant, pilot partnership..."
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                className="text-xs h-9 rounded-lg"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGrantingUser(null)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={grantSubMutation.isPending}
              onClick={() => grantSubMutation.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl"
            >
              {grantSubMutation.isPending ? "Granting..." : "Confirm Grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
