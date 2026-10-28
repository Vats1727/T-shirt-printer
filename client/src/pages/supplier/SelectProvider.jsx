import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import {
  Factory,
  Building2,
  Check,
  CheckCircle2,
  Package,
  Users,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

export default function SelectProvider() {
  const { user, token, updateUser } = useAuth();
  const [, setLocation] = useLocation();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState(null);

  const currentProviderId = user?.associated_provider_id ? Number(user.associated_provider_id) : null;

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let list = [];

      // 1. Try supplier/providers endpoint
      try {
        const res = await fetch('/api/supplier/providers', { headers });
        if (res.ok) {
          const js = await res.json();
          list = Array.isArray(js) ? js : (js.providers || []);
        }
      } catch (e) {
        console.warn('Could not fetch from /api/supplier/providers', e);
      }

      // 2. Fallback to /api/public/providers
      if (!list || list.length === 0) {
        try {
          const res2 = await fetch('/api/public/providers', { headers });
          if (res2.ok) {
            const js2 = await res2.json();
            list = Array.isArray(js2) ? js2 : (js2.providers || []);
          }
        } catch (e) {
          console.warn('Could not fetch from /api/public/providers', e);
        }
      }

      // Ensure valid list format
      const cleanList = (list || []).filter((p) => p && p.id);
      setProviders(cleanList);
    } catch (err) {
      console.error('Error fetching providers:', err);
      toast({
        variant: 'destructive',
        title: 'Error Loading Providers',
        description: err?.message || 'Could not fetch available print providers.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [token]);

  const handleSelectProvider = async (provider) => {
    if (!provider || !provider.id) return;
    setSelectingId(provider.id);

    try {
      const res = await fetch('/api/supplier/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          associated_provider_id: Number(provider.id)
        })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || '');
        throw new Error(txt || 'Failed to select print provider');
      }

      // Update user state in AuthContext & localStorage
      updateUser({
        associated_provider_id: Number(provider.id)
      });

      toast({
        title: '🎉 Print Provider Connected!',
        description: `You are now linked with ${provider.name || provider.store_name}. All studio features are unlocked.`
      });

      // Quick delay to allow UI feedback before navigating
      setTimeout(() => {
        setLocation('/supplier/dashboard');
      }, 700);
    } catch (err) {
      console.error('Select provider error:', err);
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: err?.message || 'Unable to update your fulfillment provider.'
      });
    } finally {
      setSelectingId(null);
    }
  };

  const activeProvider = providers.find((p) => Number(p.id) === currentProviderId);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16 pt-2">
      {/* Lock Status Notification / Active Provider Summary */}
      {!currentProviderId ? (
        <div className="rounded-2xl border-2 border-amber-300/80 bg-amber-50/90 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                Action Required: Choose a Production Partner
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  Locked Mode
                </span>
              </h3>
              <p className="text-xs text-amber-800/90">
                Studio Dashboard, Saved Designs, Storefront Customizer, and Add New Listing are locked. Select one of the available print providers below to unlock all features immediately.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/80 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <Check className="size-5 stroke-[2.5]" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-emerald-950 text-sm">
                  Active Production Partner Connected
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Unlocked
                </span>
              </div>
              <p className="text-xs text-emerald-800">
                Your studio is currently fulfilling through{' '}
                <strong className="font-bold text-emerald-950">
                  {activeProvider?.name || activeProvider?.store_name || `Provider #${currentProviderId}`}
                </strong>
                . All studio tabs are open. You can switch providers below at any time.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setLocation('/supplier/dashboard')}
            className="w-full sm:w-auto h-10 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-sm shrink-0"
          >
            <span>Enter Studio Dashboard</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Available Providers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Available Production Facilities
            </h2>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-bold">
              {providers.length} {providers.length === 1 ? 'Provider' : 'Providers'} Online
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchProviders}
            disabled={loading}
            className="text-xs text-slate-600 hover:text-indigo-600 gap-1.5 rounded-lg h-8"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white rounded-2xl border border-slate-200/80">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
            <span className="text-xs font-semibold text-slate-600">Discovering verified print providers...</span>
          </div>
        ) : providers.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-4">
            <div className="size-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Building2 className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-base">No Print Providers Available</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No active print providers were found in the network. Please contact support or try refreshing.
              </p>
            </div>
            <Button
              onClick={fetchProviders}
              variant="outline"
              className="text-xs font-semibold rounded-xl"
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Check Again
            </Button>
          </div>
        ) : (
          /* Card View Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((p) => {
              const isSelected = Number(p.id) === currentProviderId;
              const isChoosing = selectingId === p.id;
              const facilityInitial = (p.name || p.email || 'P').charAt(0).toUpperCase();

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border-2 transition-all duration-200 bg-white flex flex-col justify-between overflow-hidden group ${
                    isSelected
                      ? 'border-emerald-600 shadow-lg shadow-emerald-600/10 ring-4 ring-emerald-500/10'
                      : 'border-slate-200/90 hover:border-indigo-400 hover:shadow-md'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-12 rounded-2xl flex items-center justify-center text-lg font-black transition-transform group-hover:scale-105 ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                              : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                          }`}
                        >
                          {facilityInitial}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                            {p.name || p.store_name || 'Print Provider'}
                          </h3>
                          <span className="text-xs text-slate-400 font-medium block truncate max-w-[180px]">
                            {p.email}
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          <Check className="size-3 stroke-[3]" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          <span className="size-1.5 rounded-full bg-emerald-500" /> Verified
                        </span>
                      )}
                    </div>

                    {/* Facility Capabilities */}
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Package className="size-3.5 text-indigo-600" /> Blank Garments:
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {p.products_count || '10+'} styles
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Users className="size-3.5 text-indigo-600" /> Active Creators:
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {p.designers_count || 1} designers
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <ShieldCheck className="size-3.5 text-emerald-600" /> Print Technology:
                        </span>
                        <span className="font-bold text-slate-800">
                          DTG & Blanks
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Offers high-volume automated Direct-to-Garment fulfillment with color-accurate curing, custom tags, and tracking-enabled global shipping.
                    </p>
                  </div>

                  {/* Card Action Button */}
                  <div className="p-5 pt-0">
                    {isSelected ? (
                      <Button
                        type="button"
                        disabled
                        className="w-full h-11 rounded-xl bg-emerald-600 text-white font-bold text-xs gap-2 shadow-xs cursor-default opacity-95"
                      >
                        <Check className="size-4 stroke-[3]" />
                        <span>Connected Production Partner</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => handleSelectProvider(p)}
                        disabled={isChoosing}
                        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                      >
                        {isChoosing ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            <span>Connecting Partner...</span>
                          </>
                        ) : (
                          <>
                            <span>Select as My Provider</span>
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
