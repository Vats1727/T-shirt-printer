import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  CreditCard,
  Check,
  RefreshCw,
  Sparkles,
  Lock
} from 'lucide-react';
import { cn } from '@/utils/cn';

function formatQuota(val, unit = "") {
  if (val === null || val === undefined || val === -1 || val === "-1" || Number(val) < 0) {
    return "Unlimited";
  }
  return unit ? `${val} ${unit}` : String(val);
}

export default function TrialExpiredModal({ isOpen, onSuccess }) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);

  // Fetch Available Paid Plans for this Role
  const effectiveRole = user?.role === 'designer' ? 'designer' : 'print_provider';
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['/api/subscriptions/plans', effectiveRole],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/plans?role=${encodeURIComponent(effectiveRole)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load plans');
      return res.json();
    },
    enabled: !!token && isOpen
  });

  const allPlans = plansData?.plans || [];
  // Filter out free Starter plan; user must choose a paid tier to reactivate
  const paidPlans = allPlans.filter((p) => Number(p.price_paise) > 0);

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handleActivatePlan(plan) {
    setUpgradingPlanId(plan.id);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay secure checkout failed to load. Please check your internet connection.');
      }

      // 1. Create checkout order on server
      const idempotencyKey = `reactivate_${user?.id || user?.sub}_plan${plan.id}_${Date.now()}`;
      const res = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: plan.id,
          idempotencyKey
        })
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        throw new Error(orderData.message || 'Failed to initialize subscription order.');
      }

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency || 'INR',
        name: 'PrintPortal Platform',
        description: `${plan.name} Plan Activation (30 Days)`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || ''
        },
        theme: {
          color: '#4f46e5'
        },
        handler: async function (response) {
          try {
            // 3. Verify payment signature on server
            const verifyRes = await fetch('/api/subscriptions/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
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
              throw new Error(verifyData.message || 'Payment verification failed.');
            }

            toast({
              title: 'Account Reactivated!',
              description: `Successfully subscribed to ${plan.name}. Your access is fully restored.`
            });

            queryClient.invalidateQueries();
            if (onSuccess) onSuccess();
            // Force reload to refresh auth state and unlock UI
            setTimeout(() => {
              window.location.reload();
            }, 800);
          } catch (err) {
            toast({
              title: 'Verification Failed',
              description: err.message,
              variant: 'destructive'
            });
          } finally {
            setUpgradingPlanId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setUpgradingPlanId(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast({
        title: 'Checkout Error',
        description: err.message,
        variant: 'destructive'
      });
      setUpgradingPlanId(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-2xl rounded-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-2 pb-3 border-b border-slate-100 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                  Your 7-Day Free Trial Has Ended
                </DialogTitle>
                <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold">
                  Access Paused
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
                Your 7-day introductory trial period has concluded. To continue adding garment blanks, fulfilling incoming orders, and managing your store, please activate a subscription plan below.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Plan Cards Grid */}
        <div className="py-3 space-y-3">
          {plansLoading ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Loading available plans...</p>
            </div>
          ) : paidPlans.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-xl">
              No subscription plans currently configured for your role. Please contact portal support.
            </div>
          ) : (
            <div className={cn("grid gap-4", paidPlans.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
              {paidPlans.map((plan) => {
                const priceRupees = Math.round((plan.price_paise || 0) / 100);

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "rounded-xl border p-4.5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md",
                      plan.is_popular
                        ? "border-indigo-400 bg-gradient-to-b from-indigo-50/50 via-white to-white ring-2 ring-indigo-400/40"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-base">{plan.name}</h4>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            {plan.target_role?.replace("_", " ")} Plan
                          </span>
                        </div>
                        {plan.is_popular && (
                          <Badge className="bg-indigo-600 text-white text-[9px] font-bold py-0.5 px-2 rounded-full">
                            Recommended
                          </Badge>
                        )}
                      </div>

                      {/* Price */}
                      <div className="py-1.5 border-y border-slate-100 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900">
                          ₹{priceRupees.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">/ month</span>
                      </div>

                      {/* Quotas */}
                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex justify-between items-center">
                          <span>Product Limit:</span>
                          <strong className="text-slate-900">{formatQuota(plan.limits?.max_products, "blanks")}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Design Limit:</span>
                          <strong className="text-slate-900">{formatQuota(plan.limits?.max_designs, "designs")}</strong>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Features</p>
                        <ul className="space-y-1 text-xs text-slate-600">
                          {Array.isArray(plan.features) && plan.features.slice(0, 4).map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-1.5 text-[11px]">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button
                        onClick={() => handleActivatePlan(plan)}
                        disabled={upgradingPlanId === plan.id}
                        className={cn(
                          "w-full h-9 rounded-xl text-xs font-bold gap-1.5 shadow-sm cursor-pointer",
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
                            Pay & Activate Access
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Instant automated reactivation upon Razorpay verification
          </span>
          <span className="font-mono">GST Invoicing Included</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

