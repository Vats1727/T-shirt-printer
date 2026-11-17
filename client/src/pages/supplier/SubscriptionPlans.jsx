import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/utils/cn";
import {
  Sparkles,
  Check,
  CreditCard,
  RefreshCw,
  Clock,
  ShieldCheck,
  Zap,
  Package,
  Layers,
  ArrowRight,
  AlertCircle
} from "lucide-react";

// Helper to format numeric quota limits (treats -1, null, undefined as Unlimited)
function formatQuota(val, unit = "") {
  if (val === null || val === undefined || val === -1 || val === "-1" || Number(val) < 0) {
    return "Unlimited";
  }
  return unit ? `${val} ${unit}` : String(val);
}

export default function PartnerSubscriptionPlans() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);

  // 1. Fetch Current User's Subscription
  const { data: mySubData, isLoading: subLoading, refetch: refetchSub } = useQuery({
    queryKey: ["/api/subscriptions/my"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/my", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load your subscription");
      return res.json();
    },
    enabled: !!token
  });

  // 2. Fetch Available Plans for Role
  const effectiveRole = user?.role === 'designer' ? 'designer' : 'print_provider';
  const { data: plansData, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ["/api/subscriptions/plans", effectiveRole],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/plans?role=${encodeURIComponent(effectiveRole)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
    enabled: !!token
  });

  const activeSub = mySubData?.subscription;
  const entitlements = mySubData?.entitlements || {
    plan_tier: "starter",
    max_products: 10,
    max_designs: 10
  };
  const plans = plansData?.plans || [];

  // Initialize Razorpay checkout script if needed
  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  // Handle Upgrade Checkout
  async function handleUpgrade(plan) {
    setUpgradingPlanId(plan.id);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error("Razorpay checkout failed to load. Please check your internet connection.");
      }

      // Step A: Create subscription checkout order on server
      const idempotencyKey = `sub_${user?.id}_plan${plan.id}_${Date.now()}`;
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: plan.id,
          idempotencyKey
        })
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        throw new Error(orderData.message || "Failed to initialize subscription checkout.");
      }

      // Step B: Launch Razorpay Standard Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency || "INR",
        name: "PrintPortal SaaS",
        description: `${plan.name} Subscription (30 Days)`,
        order_id: orderData.razorpayOrderId,
        handler: async function (response) {
          try {
            // Step C: Verify payment signature on server
            const verifyRes = await fetch("/api/subscriptions/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.message || "Payment verification failed.");
            }

            toast({
              title: "Plan Upgraded Successfully!",
              description: `You are now active on ${plan.name}. Your limits have been updated.`
            });

            queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/my"] });
            queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/plans"] });
          } catch (err) {
            toast({
              title: "Verification Error",
              description: err.message,
              variant: "destructive"
            });
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email
        },
        theme: {
          color: "#4f46e5"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        toast({
          title: "Payment Cancelled or Failed",
          description: response.error.description || "The transaction could not be processed.",
          variant: "destructive"
        });
      });
      rzp.open();
    } catch (err) {
      toast({
        title: "Checkout Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setUpgradingPlanId(null);
    }
  }

  const isDesigner = user?.role === "designer" || user?.role === "supplier";
  const currentPlanCode = activeSub?.plan_snapshot?.name || "Starter Partner";
  const currentPrice = activeSub?.plan_snapshot?.price_paise
    ? `₹${Math.round(activeSub.plan_snapshot.price_paise / 100)}/mo`
    : "Free Lifetime (₹0)";

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Subscription & Entitlements
            </h1>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-[10px]">
              SaaS Billing
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your partner tier, product listing quotas, and high-resolution export privileges.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchSub();
            refetchPlans();
          }}
          disabled={subLoading || plansLoading}
          className="h-8 gap-1.5 border-slate-200 shadow-2xs hover:bg-slate-50 rounded-lg text-xs"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (subLoading || plansLoading) && "animate-spin")} />
          Refresh Status
        </Button>
      </div>

      {/* Available Plans Grid */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Select or Change Subscription Plan</h3>
            <p className="text-xs text-slate-500">
              Upgrade your facility or studio anytime. All payments are billed monthly via Razorpay.
            </p>
          </div>
          {activeSub && (
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold py-1 px-3 self-start sm:self-auto">
              Current: {currentPlanCode} {activeSub.expires_at ? `(Expires ${format(new Date(activeSub.expires_at), "dd-MM-yyyy")})` : ""}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const priceRupees = Math.round((plan.price_paise || 0) / 100);
            const isFree = priceRupees === 0;
            const isCurrent = activeSub?.plan_id === plan.id || (isFree && !activeSub?.plan_id);

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
                  {/* Plan Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-base">{plan.name}</h4>
                        {plan.is_popular && (
                          <Badge className="bg-indigo-600 text-white text-[9px] font-bold py-0 px-2 rounded-full">
                            Popular
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 capitalize">
                        {plan.target_role?.replace("_", " ")} tier
                      </p>
                    </div>

                    {isCurrent && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[10px]">
                        Current Plan
                      </Badge>
                    )}
                  </div>

                  {/* Price Display */}
                  <div className="py-2 border-y border-slate-100 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">
                      ₹{priceRupees.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {isFree ? "/ lifetime" : "/ month"}
                    </span>
                  </div>

                  {/* Limits */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Product Quota:</span>
                      {formatQuota(plan.limits?.max_products) === "Unlimited" ? (
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 py-0 px-1.5">
                          Unlimited
                        </Badge>
                      ) : (
                        <strong className="text-slate-900">{plan.limits?.max_products} garments</strong>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Design Quota:</span>
                      {formatQuota(plan.limits?.max_designs) === "Unlimited" ? (
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 py-0 px-1.5">
                          Unlimited
                        </Badge>
                      ) : (
                        <strong className="text-slate-900">{plan.limits?.max_designs} studio designs</strong>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Features</p>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {Array.isArray(plan.features) && plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-[11px]">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="p-4 bg-slate-50/60 border-t border-slate-100">
                  {isFree ? (
                    <Button
                      disabled
                      className="w-full text-xs h-9 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-medium"
                    >
                      {isCurrent ? "Active 7-Day Trial" : "7-Day Introductory Trial"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(plan)}
                      disabled={upgradingPlanId === plan.id}
                      className={cn(
                        "w-full text-xs h-9 font-semibold rounded-xl gap-1.5 shadow-2xs cursor-pointer",
                        plan.is_popular
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      )}
                    >
                      {upgradingPlanId === plan.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Opening Razorpay...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3.5 h-3.5" />
                          {isCurrent ? "Renew Plan (+30 Days)" : `Upgrade to ${plan.name}`}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

