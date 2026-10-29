import React from 'react';
import { useLocation } from 'wouter';
import { useCart } from '@/context/CartContext';
import {
  ShoppingBag,
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export default function CartDrawer() {
  const [, setLocation] = useLocation();
  const { cart, cartCount, cartSubtotal, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useCart();

  if (!isCartOpen) return null;

  const freeShippingThreshold = 500;
  const freeShippingLeft = Math.max(0, freeShippingThreshold - cartSubtotal);
  const progressPercent = Math.min(100, (cartSubtotal / freeShippingThreshold) * 100);

  const handleCheckout = () => {
    setIsCartOpen(false);
    setLocation('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Your Cart</h2>
              <p className="text-xs text-slate-500 font-medium">
                {cartCount} {cartCount === 1 ? 'item' : 'items'} selected
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="size-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Free Shipping Progress Indicator */}
        <div className="px-5 py-3 bg-indigo-50/60 border-b border-indigo-100 text-xs">
          <div className="flex items-center justify-between mb-1.5 font-bold">
            <span className="flex items-center gap-1.5 text-indigo-900">
              <Truck className="size-3.5 text-indigo-600" />
              {freeShippingLeft > 0 ? (
                <span>
                  Add <span className="text-indigo-600 font-extrabold">₹{freeShippingLeft.toFixed(2)}</span> more for Free Delivery!
                </span>
              ) : (
                <span className="text-emerald-700 font-extrabold">🎉 You unlocked FREE Delivery!</span>
              )}
            </span>
            <span className="text-slate-400 text-[10px]">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 w-full bg-indigo-200/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="size-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <ShoppingBag className="size-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">Your cart is empty</p>
                <p className="text-xs text-slate-400">Discover custom garments from designer storefronts and add to cart.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCartOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Start Browsing
              </Button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cart_id}
                className="flex items-start gap-3.5 p-3 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-xs transition-all"
              >
                {/* Thumbnail */}
                <div className="size-20 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={item.preview_url || '/templates/tshirt.png'}
                    alt={item.title}
                    className="size-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = '/templates/tshirt.png';
                    }}
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>

                  {/* Badges for Color & Size */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.color && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700">
                        <span
                          className="size-2 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: item.color.hex }}
                        />
                        <span>{item.color.name || item.color.hex}</span>
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700">
                      Size: {item.size}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="text-xs font-extrabold text-slate-900 pt-0.5">
                    ₹{(Number(item.price) * item.quantity).toFixed(2)}
                  </div>

                  {/* Quantity Stepper & Delete */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                        className="size-6 rounded hover:bg-white flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                        className="size-6 rounded hover:bg-white flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.cart_id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Remove Item"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Summary & Checkout CTA */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-slate-100 bg-slate-50/60 space-y-3.5">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Estimated Shipping</span>
                <span className="font-semibold text-slate-800">
                  {cartSubtotal >= freeShippingThreshold ? (
                    <span className="text-emerald-600 font-bold">FREE</span>
                  ) : (
                    '₹50.00'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200/60">
                <span>Total Amount</span>
                <span className="text-indigo-600">
                  ₹{(cartSubtotal + (cartSubtotal >= freeShippingThreshold ? 0 : 50)).toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleCheckout}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="size-4" />
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center font-medium">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Razorpay Secured 256-Bit SSL Encrypted Checkout</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

