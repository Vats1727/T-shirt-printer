import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  CreditCard,
  Building2,
  Palette
} from "lucide-react";
import { cn } from "@/utils/cn";

export default function ManageSubscriptionDialog({
  open,
  onOpenChange,
  user,
  plans = [],
  onSuccess
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("grant"); // 'grant' | 'extend' | 'suspend'
  
  // Grant / Change Plan form
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [grantReason, setGrantReason] = useState("");

  // Extend form
  const [extendDays, setExtendDays] = useState("30");
  const [customExpiryDate, setCustomExpiryDate] = useState("");
  const [extendReason, setExtendReason] = useState("");

  // Suspend form
  const [suspendReason, setSuspendReason] = useState("");

  const isSuspended = (user?.subscription_status || "").toLowerCase() === "suspended";
  const isDesigner = (user?.role || user?.user_role) === "designer";
  const userId = user?.user_id || user?.id;

  // Initialize selected plan when dialog opens
  useEffect(() => {
    if (user && plans.length > 0) {
      const match = plans.find((p) => p.tier === user.plan_tier || p.tier === user.subscription_tier);
      setSelectedPlanId(String(match?.id || plans[0]?.id || ""));
      setActiveTab(isSuspended ? "suspend" : "grant");
      setGrantReason("");
      setExtendReason("");
      setSuspendReason("");
    }
  }, [user, plans, isSuspended]);

  // 1. Grant / Change Plan Mutation
  const grantPlanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId) throw new Error("Please select a plan.");
      if (!grantReason.trim()) throw new Error("Please provide an audit reason.");

      const selectedPlan = plans.find((p) => String(p.id) === String(selectedPlanId));
      const targetTier = selectedPlan?.tier || "pro";

      const res = await fetch("/api/portal/subscriptions/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          userId: Number(userId),
          tier: targetTier,
          planId: Number(selectedPlanId),
          durationDays: Number(grantDays),
          grantReason: grantReason.trim(),
          grantType: "complimentary"
        })
      });

      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Failed to update subscription plan");
      return js;
    },
    onSuccess: (data) => {
      toast({
        title: "Subscription Updated",
        description: `Plan updated successfully for ${user?.name || "user"}.`
      });
      invalidateAll();
      onOpenChange?.(false);
      onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // 2. Extend Validity Mutation
  const extendMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        userId: Number(userId),
        reason: extendReason.trim() || "Validity extended by Portal Admin"
      };

      if (customExpiryDate) {
        payload.newExpiryDate = customExpiryDate;
      } else {
        payload.extendDays = Number(extendDays);
      }

      const res = await fetch("/api/portal/subscriptions/extend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });

      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Failed to extend subscription validity");
      return js;
    },
    onSuccess: (data) => {
      toast({
        title: "Validity Extended",
        description: data.message || `Subscription period extended successfully.`
      });
      invalidateAll();
      onOpenChange?.(false);
      onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: "Extension Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // 3. Suspend Subscription Mutation
  const suspendMutation = useMutation({
    mutationFn: async () => {
      if (!suspendReason.trim()) {
        throw new Error("Please specify a reason for suspending this subscription.");
      }

      const res = await fetch("/api/portal/subscriptions/suspend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          userId: Number(userId),
          reason: suspendReason.trim()
        })
      });

      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Failed to suspend subscription");
      return js;
    },
    onSuccess: (data) => {
      toast({
        title: "Subscription Suspended",
        description: data.message || `Subscription for ${user?.name} has been suspended.`
      });
      invalidateAll();
      onOpenChange?.(false);
      onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: "Suspension Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // 4. Resume / Reactivate Subscription Mutation
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/subscriptions/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          userId: Number(userId)
        })
      });

      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Failed to reactivate subscription");
      return js;
    },
    onSuccess: (data) => {
      toast({
        title: "Subscription Reactivated",
        description: data.message || `Subscription for ${user?.name} has been reactivated.`
      });
      invalidateAll();
      onOpenChange?.(false);
      onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: "Reactivation Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions/subscribers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions/revenue-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portal/providers"] });
  }

  if (!user) return null;

  const currentExpiry = user.expires_at || user.subscription_expiry;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border shrink-0",
              isSuspended
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            )}>
              {isSuspended ? <ShieldAlert className="w-5 h-5 text-rose-600" /> : <CreditCard className="w-5 h-5 text-indigo-600" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Manage Subscription
                {isSuspended ? (
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[10px]">
                    Suspended
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                    Active
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-mono">
                {user.name} ({user.email}) · #{userId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current State Summary Card */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2 my-2">
          <div>
            <span className="text-slate-400 block text-[10px]">Current Plan</span>
            <strong className="text-indigo-900 font-bold">
              {user.plan_name || user.subscription_plan_name || "Starter (Free)"}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Validity Expiry</span>
            <strong className="text-slate-800 font-mono">
              {currentExpiry ? format(new Date(currentExpiry), "dd-MMM-yyyy") : "Lifetime / Trial"}
            </strong>
          </div>
        </div>

        {/* Tabs: Change Plan | Extend | Suspend */}
        <div className="flex border-b border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("grant")}
            className={cn(
              "pb-2 px-3 transition-all relative flex items-center gap-1.5",
              activeTab === "grant"
                ? "text-indigo-700 border-b-2 border-indigo-600 font-bold"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Plan & Tier
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("extend")}
            className={cn(
              "pb-2 px-3 transition-all relative flex items-center gap-1.5",
              activeTab === "extend"
                ? "text-indigo-700 border-b-2 border-indigo-600 font-bold"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Extend
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suspend")}
            className={cn(
              "pb-2 px-3 transition-all relative flex items-center gap-1.5",
              activeTab === "suspend"
                ? isSuspended
                  ? "text-emerald-700 border-b-2 border-emerald-600 font-bold"
                  : "text-rose-700 border-b-2 border-rose-600 font-bold"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {isSuspended ? "Reactivate" : "Suspend"}
          </button>
        </div>

        {/* TAB 1: Change / Grant Plan */}
        {activeTab === "grant" && (
          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Assign Subscription Plan</Label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
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
              <Label className="text-xs font-semibold text-slate-700">Duration</Label>
              <select
                value={grantDays}
                onChange={(e) => setGrantDays(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white text-slate-800"
              >
                <option value="7">7 Days (Introductory Trial)</option>
                <option value="30">30 Days (1 Month)</option>
                <option value="90">90 Days (1 Quarter)</option>
                <option value="180">180 Days (Half Year)</option>
                <option value="365">365 Days (1 Full Year)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Audit Reason <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="text"
                placeholder="e.g. Upgraded plan per annual agreement, VIP tier grant..."
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                className="text-xs h-9 rounded-lg"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange?.(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={grantPlanMutation.isPending}
                onClick={() => grantPlanMutation.mutate()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl"
              >
                {grantPlanMutation.isPending ? "Applying..." : "Save & Apply Plan"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* TAB 2: Extend Validity */}
        {activeTab === "extend" && (
          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Quick Extension Days</Label>
              <div className="grid grid-cols-4 gap-2">
                {["7", "15", "30", "90"].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setExtendDays(days);
                      setCustomExpiryDate("");
                    }}
                    className={cn(
                      "py-1.5 rounded-lg border text-xs font-bold transition-all",
                      extendDays === days && !customExpiryDate
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    +{days} Days
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Or Set Custom Expiry Date</Label>
              <Input
                type="date"
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                className="text-xs h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Audit Reason</Label>
              <Input
                type="text"
                placeholder="e.g. Courtesy renewal grace period, dispute settlement..."
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                className="text-xs h-9 rounded-lg"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange?.(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={extendMutation.isPending}
                onClick={() => extendMutation.mutate()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl"
              >
                {extendMutation.isPending ? "Extending..." : "Confirm Extension"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* TAB 3: Suspend / Reactivate */}
        {activeTab === "suspend" && (
          <div className="space-y-3.5 py-2 text-xs">
            {isSuspended ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Subscription is currently Suspended
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Reactivating will restore the partner's previous plan benefits, reset quota limits, and set the subscription status back to Active.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Warning: Subscription Suspension
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Suspending this subscription will immediately revoke premium quotas (reverting catalog to free Starter), freeze plan access, and flag the partner's account.
                </p>
              </div>
            )}

            {!isSuspended && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Reason for Suspension <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Non-payment, chargeback notice, quality compliance..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="text-xs h-9 rounded-lg"
                  required
                />
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange?.(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              {isSuspended ? (
                <Button
                  size="sm"
                  disabled={resumeMutation.isPending}
                  onClick={() => resumeMutation.mutate()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl"
                >
                  {resumeMutation.isPending ? "Reactivating..." : "Reactivate Subscription"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={suspendMutation.isPending}
                  onClick={() => suspendMutation.mutate()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl"
                >
                  {suspendMutation.isPending ? "Suspending..." : "Confirm Suspension"}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
