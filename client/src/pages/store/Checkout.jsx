import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import {
  ShieldCheck,
  CreditCard,
  Banknote,
  CheckCircle2,
  ArrowLeft,
  ShoppingBag,
  Truck,
  Lock,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/utils/dateFormatter';
import Footer from '@/layouts/Footer';

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { cart, cartCount, cartSubtotal, clearCart } = useCart();

  const [shippingAddress, setShippingAddress] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // 'razorpay' | 'cod'
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [financialSettings, setFinancialSettings] = useState({
    standard_shipping_charge: 50,
    free_shipping_threshold: 500,
    shipping_enabled: true,
    tax_percent: 5,
    gst_enabled: true
  });

  useEffect(() => {
    fetch('/api/settings/financial')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          setFinancialSettings({
            standard_shipping_charge: Number(data.settings.standard_shipping_charge ?? 50),
            free_shipping_threshold: Number(data.settings.free_shipping_threshold ?? 500),
            shipping_enabled: Boolean(data.settings.shipping_enabled ?? true),
            tax_percent: Number(data.settings.tax_percent ?? 5),
            gst_enabled: Boolean(data.settings.gst_enabled ?? true)
          });
        }
      })
      .catch(() => {});
  }, []);

  const freeShippingThreshold = financialSettings.free_shipping_threshold;
  const isShippingFree = cartSubtotal >= freeShippingThreshold || !financialSettings.shipping_enabled || cartSubtotal === 0;
  const shippingCost = isShippingFree ? 0 : financialSettings.standard_shipping_charge;
  const gstRate = financialSettings.tax_percent;
  const isGstEnabled = financialSettings.gst_enabled && gstRate > 0;
  const taxAmount = isGstEnabled && cartSubtotal > 0 ? Number(((cartSubtotal * gstRate) / 100).toFixed(2)) : 0;
  const totalAmount = Number((cartSubtotal + shippingCost + taxAmount).toFixed(2));

  // Load Razorpay checkout script if not present
  useEffect(() => {
    if (!document.getElementById('razorpay-sdk')) {
      const script = document.createElement('script');
      script.id = 'razorpay-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!shippingAddress.name.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter your full name', variant: 'destructive' });
      return false;
    }
    if (!shippingAddress.email.trim() || !shippingAddress.email.includes('@')) {
      toast({ title: 'Validation Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return false;
    }
    if (!shippingAddress.phone.trim() || shippingAddress.phone.length < 10) {
      toast({ title: 'Validation Error', description: 'Please enter a valid 10-digit phone number', variant: 'destructive' });
      return false;
    }
    if (!shippingAddress.address.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter your street address', variant: 'destructive' });
      return false;
    }
    if (!shippingAddress.city.trim() || !shippingAddress.state.trim() || !shippingAddress.pincode.trim()) {
      toast({ title: 'Validation Error', description: 'City, State, and Pincode are required', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (cart.length === 0) {
      toast({ title: 'Empty Cart', description: 'Your cart is empty', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // Case 1: Cash on Delivery (COD)
      if (paymentMethod === 'cod') {
        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            items: cart.map((item) => ({
              listing_id: item.listing_id,
              design_id: item.design_id,
              product_id: item.product_id,
              title: item.title,
              price: item.price,
              quantity: item.quantity,
              color_id: item.color?.id,
              color_name: item.color?.name,
              color_hex: item.color?.hex,
              size_label: item.size,
              preview_url: item.preview_url,
              back_preview_url: item.back_preview_url || item.preview_back_url || null
            })),
            customerName: shippingAddress.name,
            customerEmail: shippingAddress.email,
            customerPhone: shippingAddress.phone,
            shippingAddress,
            paymentMethod: 'cod',
            paymentStatus: 'cod',
            shippingCostCents: Math.round(shippingCost * 100),
            taxCents: Math.round(taxAmount * 100)
          })
        });

        if (!orderRes.ok) {
          const err = await orderRes.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to place order');
        }

        const orderData = await orderRes.json();
        clearCart();
        setCompletedOrder(orderData.order);
        setSubmitting(false);
        return;
      }

      // Case 2: Razorpay Payment
      // Step A: Create order in platform database
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cart.map((item) => ({
            listing_id: item.listing_id,
            design_id: item.design_id,
            product_id: item.product_id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            color_id: item.color?.id,
            color_name: item.color?.name,
            color_hex: item.color?.hex,
            size_label: item.size,
            preview_url: item.preview_url,
            back_preview_url: item.back_preview_url || item.preview_back_url || null
          })),
          customerName: shippingAddress.name,
          customerEmail: shippingAddress.email,
          customerPhone: shippingAddress.phone,
          shippingAddress,
          paymentMethod: 'razorpay',
          paymentStatus: 'pending',
          shippingCostCents: Math.round(shippingCost * 100),
          taxCents: Math.round(taxAmount * 100)
        })
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to initialize order');
      }

      const orderData = await orderRes.json();
      const platformOrder = orderData.order;

      // Step B: Create Razorpay Checkout Order
      const rzpRes = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'INR',
          receipt: platformOrder.order_number,
          notes: { orderId: platformOrder.id, customerEmail: shippingAddress.email }
        })
      });

      if (!rzpRes.ok) {
        throw new Error('Failed to create Razorpay checkout session');
      }

      const rzpData = await rzpRes.json();
      const rzpOrder = rzpData.order;

      const keyId = import.meta.env?.VITE_RAZORPAY_KEY_ID || rzpOrder.key_id || 'rzp_test_SgRf2CKVk35fBy';

      // Step C: Trigger Razorpay Modal
      const options = {
        key: keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || 'INR',
        name: 'Tshirt-Printer Marketplace',
        description: `Order ${platformOrder.order_number}`,
        ...(typeof window !== 'undefined' && window.location.protocol === 'https:' ? { image: `${window.location.origin}/templates/tshirt.png` } : {}),
        order_id: rzpOrder.id,
        prefill: {
          name: shippingAddress.name,
          email: shippingAddress.email,
          contact: shippingAddress.phone
        },
        theme: {
          color: '#4f46e5'
        },
        handler: async function (response) {
          try {
            // Step D: Verify payment signature with backend
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id || rzpOrder?.id || rzpData?.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_id: platformOrder.id
              })
            });

            const verifiedData = await verifyRes.json().catch(() => ({}));

            if (!verifyRes.ok) {
              throw new Error(verifiedData.message || 'Payment verification failed');
            }

            clearCart();
            setCompletedOrder(verifiedData.order || platformOrder);
          } catch (verErr) {
            toast({
              title: 'Verification Failed',
              description: verErr.message || 'Payment signature could not be verified',
              variant: 'destructive'
            });
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            toast({
              title: 'Payment Incomplete',
              description: 'You closed the payment window. Your order remains pending.',
              variant: 'default'
            });
          }
        }
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }
    } catch (err) {
      toast({
        title: 'Checkout Error',
        description: err.message || 'Something went wrong during checkout',
        variant: 'destructive'
      });
      setSubmitting(false);
    }
  };

  // Render Completed Order Screen
  if (completedOrder) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <div className="flex-1 max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="size-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm animate-in zoom-in duration-300">
            <CheckCircle2 className="size-10" />
          </div>

          <div className="space-y-2">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-extrabold uppercase text-xs px-3 py-1">
              Order Confirmed
            </Badge>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Thank You for Your Order!
            </h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Your custom apparel is dispatched directly to our verified print facility. We'll email tracking updates to{' '}
              <strong className="text-slate-800">{completedOrder.customer_email}</strong>.
            </p>
          </div>

          {/* Order Details Receipt Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm text-left space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block">Order Number</span>
                <span className="font-extrabold text-slate-900 text-sm font-mono">{completedOrder.order_number}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block">Order Date</span>
                <span className="font-bold text-slate-700">{formatDate(completedOrder.created_at || new Date())}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Payment Method</span>
                <span className="font-bold text-indigo-600 uppercase">
                  {completedOrder.payment_method === 'cod' ? 'Cash on Delivery' : 'Razorpay (Paid)'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ordered Items</span>
              {(completedOrder.items || []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <img
                      src={it.preview_url || '/templates/tshirt.png'}
                      alt={it.title}
                      className="size-9 rounded-lg bg-slate-50 object-contain p-0.5 border"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">{it.title}</span>
                      <span className="text-slate-400 text-[11px]">
                        Qty: {it.quantity} • Size: {it.size} {it.color_name ? `• ${it.color_name}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-900">₹{Number(it.total_price || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Shipping Cost</span>
                <span>{completedOrder.shipping_cost > 0 ? `₹${completedOrder.shipping_cost.toFixed(2)}` : 'FREE'}</span>
              </div>
              {Number(completedOrder.tax_cents || 0) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>GST Tax</span>
                  <span>₹{(Number(completedOrder.tax_cents) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t">
                <span>Total Paid</span>
                <span className="text-indigo-600">₹{Number(completedOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => setLocation(user?.role === 'customer' ? '/customer/orders' : '/orders')}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              Track Order in My Orders
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation(user?.role === 'customer' ? '/customer/dashboard' : '/')}
              className="w-full sm:w-auto h-11 px-6 rounded-xl text-xs font-bold"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Render Empty Cart Screen
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <div className="flex-1 max-w-md mx-auto px-4 py-24 text-center space-y-5">
          <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            <ShoppingBag className="size-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold text-slate-900">Your Cart is Empty</h1>
            <p className="text-xs text-slate-500">
              You don't have any garments in your cart yet. Explore stores and add items to proceed.
            </p>
          </div>
          <Button
            onClick={() => setLocation(user?.role === 'customer' ? '/customer/dashboard' : '/')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 cursor-pointer"
          >
            Explore Stores & Garments
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans text-slate-900">
      {/* Top Checkout Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Store</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Lock className="size-3.5 text-emerald-600" />
            <span>Secure 256-Bit Encrypted Checkout</span>
          </div>
        </div>
      </header>

      {/* Main Checkout Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Shipping & Payment Controls */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Shipping Address */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                  1
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Delivery Information</h3>
                  <p className="text-xs text-slate-400">Where should we deliver your custom apparel?</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Full Name <span className="text-rose-500">*</span></Label>
                  <Input
                    name="name"
                    value={shippingAddress.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Rahul Sharma"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Email Address <span className="text-rose-500">*</span></Label>
                  <Input
                    name="email"
                    type="email"
                    value={shippingAddress.email}
                    onChange={handleInputChange}
                    placeholder="you@domain.com"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Mobile Phone <span className="text-rose-500">*</span></Label>
                  <Input
                    name="phone"
                    value={shippingAddress.phone}
                    onChange={handleInputChange}
                    placeholder="10-digit mobile number"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Street Address <span className="text-rose-500">*</span></Label>
                  <Input
                    name="address"
                    value={shippingAddress.address}
                    onChange={handleInputChange}
                    placeholder="Flat/House No., Street, Landmark"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">City <span className="text-rose-500">*</span></Label>
                  <Input
                    name="city"
                    value={shippingAddress.city}
                    onChange={handleInputChange}
                    placeholder="e.g. Mumbai"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">State <span className="text-rose-500">*</span></Label>
                  <Input
                    name="state"
                    value={shippingAddress.state}
                    onChange={handleInputChange}
                    placeholder="e.g. Maharashtra"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Pincode <span className="text-rose-500">*</span></Label>
                  <Input
                    name="pincode"
                    value={shippingAddress.pincode}
                    onChange={handleInputChange}
                    placeholder="6-digit pincode"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Payment Method */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                  2
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Payment Method</h3>
                  <p className="text-xs text-slate-400">Select how you want to pay</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {/* Razorpay Option */}
                <div
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${paymentMethod === 'razorpay'
                      ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-600/15'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${paymentMethod === 'razorpay' ? 'border-indigo-600' : 'border-slate-300'
                        }`}
                    >
                      {paymentMethod === 'razorpay' && <div className="size-2.5 rounded-full bg-indigo-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">Razorpay Online Payment</span>
                        <Badge className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.2">Instant</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        UPI (GPay, PhonePe, Paytm), Credit/Debit Card, Netbanking & Wallets
                      </p>
                    </div>
                  </div>
                  <CreditCard className="size-5 text-indigo-600 shrink-0" />
                </div>

                {/* Cash on Delivery Option */}
                <div
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${paymentMethod === 'cod'
                      ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-600/15'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${paymentMethod === 'cod' ? 'border-indigo-600' : 'border-slate-300'
                        }`}
                    >
                      {paymentMethod === 'cod' && <div className="size-2.5 rounded-full bg-indigo-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">Cash on Delivery (COD)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Pay in cash when your printed parcel arrives</p>
                    </div>
                  </div>
                  <Banknote className="size-5 text-emerald-600 shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Action */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <h3 className="text-base font-extrabold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-bold text-indigo-600">{cartCount} Items</span>
              </h3>

              {/* Items List */}
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.cart_id} className="py-3 flex items-center gap-3">
                    <div className="size-14 rounded-xl bg-slate-50 border p-1 shrink-0 flex items-center justify-center">
                      <img
                        src={item.preview_url || '/templates/tshirt.png'}
                        alt={item.title}
                        className="size-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-xs">
                      <h4 className="font-bold text-slate-800 truncate">{item.title}</h4>
                      <p className="text-slate-400 text-[11px]">
                        Qty: {item.quantity} • Size: {item.size} {item.color ? `• ${item.color.name || item.color.hex}` : ''}
                      </p>
                    </div>
                    <div className="text-xs font-extrabold text-slate-900">
                      ₹{(Number(item.price) * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Calculation */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-slate-800">
                    {shippingCost === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `₹${shippingCost.toFixed(2)}`}
                  </span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span>GST ({gstRate}%)</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                        Tax
                      </span>
                    </span>
                    <span className="font-semibold text-slate-800">₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total Amount</span>
                  <span className="text-indigo-600">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
              >
                {submitting ? (
                  <span>Processing Checkout...</span>
                ) : paymentMethod === 'razorpay' ? (
                  <>
                    <CreditCard className="size-4" />
                    <span>Pay with Razorpay • ₹{totalAmount.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    <Banknote className="size-4" />
                    <span>Place Order (COD) • ₹{totalAmount.toFixed(2)}</span>
                  </>
                )}
              </Button>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                <span>Payment is processed securely via Razorpay with instant verification.</span>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}

