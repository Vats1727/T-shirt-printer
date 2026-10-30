import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Radio,
  Sparkles,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/dateFormatter';

const TRACKING_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: ShieldCheck },
  { key: 'in_printing', label: 'In Printing', icon: Printer },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 }
];

function formatStepTime(timestamp) {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export default function CustomerOrders() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [copiedAwb, setCopiedAwb] = useState(null);

  // Live 5-second polling synchronized with the print provider's production flow
  const {
    data: ordersData,
    isLoading: loading,
    isFetching,
    refetch: loadOrders
  } = useQuery({
    queryKey: ['/api/customer/orders'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customer/orders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to load customer orders');
      return res.json();
    },
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const orders = Array.isArray(ordersData)
    ? ordersData
    : Array.isArray(ordersData?.orders)
    ? ordersData.orders
    : [];

  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleCopyAwb = (awb) => {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    setTimeout(() => setCopiedAwb(null), 2200);
  };

  const getStepIndex = (status) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'confirmed':
      case 'paid':
        return 1;
      case 'processing':
      case 'in_printing':
      case 'printing':
        return 2;
      case 'shipped':
        return 3;
      case 'delivered':
      case 'completed':
        return 4;
      default:
        return 1;
    }
  };

  const getStepTimestamp = (order, stepKey, sIdx, activeStepIdx) => {
    const timeline = order.tracking_info?.timeline;
    if (Array.isArray(timeline) && timeline.length > 0) {
      const event = timeline.find((e) => {
        if (stepKey === 'placed') return e.status === 'placed';
        if (stepKey === 'confirmed') return e.status === 'confirmed';
        if (stepKey === 'in_printing') return ['in_printing', 'processing', 'printing'].includes(e.status);
        if (stepKey === 'shipped') return e.status === 'shipped';
        if (stepKey === 'delivered') return ['delivered', 'completed'].includes(e.status);
        return false;
      });
      if (event?.timestamp) return formatStepTime(event.timestamp);
    }

    // Fallbacks if not recorded in timeline
    if (stepKey === 'placed' && sIdx <= activeStepIdx) {
      return formatStepTime(order.created_at);
    }
    if (sIdx === activeStepIdx) {
      return formatStepTime(order.updated_at || order.created_at);
    }
    return null;
  };

  const filteredOrders = orders.filter((o) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'printing') return ['processing', 'in_printing', 'printing'].includes(o.status);
    if (selectedFilter === 'shipped') return o.status === 'shipped';
    if (selectedFilter === 'delivered') return ['delivered', 'completed'].includes(o.status);
    return true;
  });

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16 font-sans">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
              <Package className="size-3.5" />
              <span>Customer Orders Portal</span>
            </div>

            {/* Live Sync Status Indicator */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-400"></span>
              </span>
              <span>Live Production Sync Active</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            My Garment Orders & Live Tracking
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Live synchronization with the print provider's fulfillment hub. Status, printing queue, and courier dispatch stages update automatically in real-time.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All Orders (${orders.length})` },
            { id: 'printing', label: 'In Printing' },
            { id: 'shipped', label: 'In Transit / Shipped' },
            { id: 'delivered', label: 'Delivered' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                selectedFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {isFetching && (
            <span className="text-[11px] font-semibold text-slate-400 animate-pulse hidden sm:inline-block">
              Auto-syncing...
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadOrders()}
            className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer h-8"
          >
            <RefreshCw className={cn('size-3.5', (loading || isFetching) && 'animate-spin text-indigo-600')} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="size-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold animate-pulse">Loading live orders data...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4">
          <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            <ShoppingBag className="size-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No Orders Found</h3>
            <p className="text-xs text-slate-500">
              {orders.length === 0
                ? "You haven't placed any apparel orders yet. Browse our creator storefronts to discover custom pieces."
                : 'No orders match the selected filter.'}
            </p>
          </div>
          <Button
            onClick={() => setLocation('/customer/dashboard')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 cursor-pointer"
          >
            Explore Stores & Garments
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isCancelled = order.status === 'cancelled';
            const activeStepIdx = getStepIndex(order.status);
            const isExpanded = Boolean(expandedOrders[order.id]);
            const trackingInfo = order.tracking_info || {};

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:border-slate-300 transition-all"
              >
                {/* Order Top Bar */}
                <div className="p-5 sm:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-base">{order.order_number}</span>

                      {/* Status Badge */}
                      <Badge
                        className={cn(
                          'text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border',
                          ['completed', 'delivered'].includes(order.status)
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : order.status === 'shipped'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : ['in_printing', 'processing', 'printing'].includes(order.status)
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : order.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        )}
                      >
                        <span className="size-1.5 rounded-full bg-current inline-block mr-1.5 animate-pulse" />
                        {order.status === 'in_printing' ? 'In Printing Production' : order.status?.replace('_', ' ')}
                      </Badge>

                      {/* Payment Status Badge */}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-bold uppercase',
                          order.payment_status === 'paid'
                            ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                            : 'text-amber-700 border-amber-200 bg-amber-50'
                        )}
                      >
                        {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid via Razorpay'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                      <span>Placed on {formatDate(order.created_at)}</span>
                      <span>•</span>
                      <span>
                        {(order.items || []).length} {order.items?.length === 1 ? 'Garment' : 'Garments'}
                      </span>
                      {order.designer_name && (
                        <>
                          <span>•</span>
                          <span>
                            Creator: <strong className="text-slate-700">{order.designer_name}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
                      <span className="text-base font-extrabold text-slate-900">
                        ₹{Number(order.total || 0).toFixed(2)}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpand(order.id)}
                      className="rounded-xl text-xs font-bold gap-1 cursor-pointer h-9"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                      {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* 5-Stage Live Production & Delivery Stepper OR Cancelled Notice */}
                {isCancelled ? (
                  <div className="p-6 bg-rose-50/60 border-b border-rose-100 flex items-start gap-3">
                    <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-rose-900">Order Declined / Cancelled</h4>
                      <p className="text-xs text-rose-700 leading-relaxed">
                        This order was declined or cancelled by the print provider. If payment was already processed, the refund will be credited back to your original payment method automatically within 3–5 business days.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 sm:px-8 py-6 border-b border-slate-100 bg-white">
                    <div className="relative flex items-center justify-between">
                      {/* Background Progress Bar */}
                      <div className="absolute left-6 right-6 top-5 -translate-y-1/2 h-1 bg-slate-100 -z-0">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                          style={{
                            width: `${(activeStepIdx / (TRACKING_STEPS.length - 1)) * 100}%`
                          }}
                        />
                      </div>

                      {/* Step Nodes */}
                      {TRACKING_STEPS.map((step, sIdx) => {
                        const isDone = sIdx <= activeStepIdx;
                        const isCurrent = sIdx === activeStepIdx;
                        const stepTime = getStepTimestamp(order, step.key, sIdx, activeStepIdx);
                        const Icon = step.icon;

                        return (
                          <div key={step.key} className="relative z-10 flex flex-col items-center">
                            <div
                              className={cn(
                                'size-10 rounded-full flex items-center justify-center transition-all duration-300 border-2',
                                isDone
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/25'
                                  : 'bg-white border-slate-200 text-slate-400',
                                isCurrent && 'ring-4 ring-indigo-600/25 scale-110'
                              )}
                            >
                              <Icon className={cn('size-4', isCurrent && isDone && 'animate-pulse')} />
                            </div>

                            <span
                              className={cn(
                                'text-[11px] font-bold mt-2 whitespace-nowrap text-center',
                                isDone ? 'text-indigo-950' : 'text-slate-400',
                                isCurrent && 'text-indigo-600 font-extrabold'
                              )}
                            >
                              {step.label}
                            </span>

                            {/* Recorded Timestamp */}
                            {stepTime ? (
                              <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap mt-0.5">
                                {stepTime}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-medium whitespace-nowrap mt-0.5">
                                Pending
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Active In-Printing Production Callout */}
                    {['in_printing', 'processing', 'printing'].includes(order.status) && (
                      <div className="mt-5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-300">
                        <div className="flex items-center gap-2.5 text-amber-950">
                          <span className="relative flex size-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full size-2.5 bg-amber-500"></span>
                          </span>
                          <span className="font-bold">
                            ⚡ Live Production Run: Your custom artwork is currently on the print platen undergoing DTF printing and heat curing.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Courier Dispatch Card */}
                    {trackingInfo.tracking_number && (
                      <div className="mt-5 p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-300">
                        <div className="flex items-center gap-2.5 text-indigo-950 flex-wrap">
                          <div className="size-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Truck className="size-4" />
                          </div>
                          <div>
                            <span className="font-medium text-slate-600">Dispatched via </span>
                            <strong className="text-indigo-950 font-extrabold">
                              {trackingInfo.courier || 'Courier Express'}
                            </strong>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-slate-500 text-[11px]">AWB Tracking #:</span>
                              <code className="bg-white px-2 py-0.5 rounded border border-indigo-200 font-mono font-bold text-indigo-900 text-[11px]">
                                {trackingInfo.tracking_number}
                              </code>
                              <button
                                onClick={() => handleCopyAwb(trackingInfo.tracking_number)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                                title="Copy tracking code"
                              >
                                {copiedAwb === trackingInfo.tracking_number ? (
                                  <Check className="size-3 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {trackingInfo.tracking_url && (
                          <a
                            href={trackingInfo.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors self-start sm:self-auto shadow-xs"
                          >
                            <span>Track Package</span>
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable Order Details (Items, Delivery, Timeline History) */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 bg-slate-50/40 space-y-6 animate-in fade-in duration-200 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Items List */}
                      <div className="md:col-span-8 space-y-3">
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                          Garments in this Order
                        </h4>
                        <div className="space-y-2">
                          {(order.items || []).map((it) => (
                            <div
                              key={it.id}
                              className="p-3 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={it.preview_url || '/templates/tshirt.png'}
                                  alt={it.title}
                                  className="size-14 rounded-xl bg-slate-50 border p-1 object-contain"
                                />
                                <div className="space-y-1">
                                  <h5 className="font-bold text-xs text-slate-900">{it.title}</h5>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {it.color_name && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                        <span
                                          className="size-2 rounded-full border border-black/10"
                                          style={{ backgroundColor: it.color_hex }}
                                        />
                                        <span>{it.color_name}</span>
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                      Size: {it.size}
                                    </span>
                                    <span className="text-[10px] text-slate-400">Qty: {it.quantity}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-extrabold text-slate-900 block">
                                  ₹{Number(it.total_price || 0).toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ₹{Number(it.unit_price || 0).toFixed(2)} each
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery Address & Payout Summary */}
                      <div className="md:col-span-4 space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2">
                          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-indigo-600" />
                            <span>Delivery Address</span>
                          </h4>
                          <div className="text-xs text-slate-600 space-y-0.5 leading-relaxed">
                            <p className="font-bold text-slate-900">{order.customer_name}</p>
                            <p>{order.shipping_address?.address}</p>
                            <p>
                              {order.shipping_address?.city}, {order.shipping_address?.state} -{' '}
                              <strong>{order.shipping_address?.pincode}</strong>
                            </p>
                            <p className="text-slate-400 text-[11px] pt-1">
                              Phone: {order.customer_phone || order.shipping_address?.phone || 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Cost Breakdown */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span>₹{Number(order.subtotal || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>Shipping</span>
                            <span>
                              {order.shipping_cost > 0 ? `₹${Number(order.shipping_cost).toFixed(2)}` : 'FREE'}
                            </span>
                          </div>
                          <div className="flex justify-between font-extrabold text-slate-900 pt-1.5 border-t">
                            <span>Total Paid</span>
                            <span className="text-indigo-600">₹{Number(order.total || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Audit Trail */}
                    {Array.isArray(trackingInfo.timeline) && trackingInfo.timeline.length > 0 && (
                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3">
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-indigo-600" />
                          <span>Production & Delivery Log</span>
                        </h4>
                        <div className="space-y-2 border-l-2 border-indigo-100 ml-2 pl-3">
                          {trackingInfo.timeline.map((event, eIdx) => (
                            <div key={eIdx} className="relative space-y-0.5">
                              <span className="absolute -left-[19px] top-1.5 size-2 rounded-full bg-indigo-600" />
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800">{event.title}</span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {formatStepTime(event.timestamp)}
                                </span>
                              </div>
                              {event.description && (
                                <p className="text-[11px] text-slate-500">{event.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
