import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem('customer_cart');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('customer_cart', JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  const addToCart = (product) => {
    setCart((prev) => {
      // Find if same product with same color and size already exists
      const existingIdx = prev.findIndex(
        (item) =>
          String(item.listing_id || item.id) === String(product.listing_id || product.id) &&
          item.size === product.size &&
          item.color?.hex?.toLowerCase() === product.color?.hex?.toLowerCase()
      );

      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += product.quantity || 1;
        return next;
      }

      const cartItem = {
        cart_id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        listing_id: product.listing_id || product.id,
        design_id: product.design_id || null,
        product_id: product.product_id || null,
        supplier_id: product.supplier_id || null,
        title: product.title || 'Custom Apparel',
        price: Number(product.price || 29.99),
        quantity: Math.max(1, Number(product.quantity || 1)),
        color: product.color || null,
        size: product.size || 'M',
        preview_url: product.preview_url || '/templates/tshirt.png'
      };

      return [...prev, cartItem];
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (cartId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.cart_id === cartId ? { ...item, quantity: newQuantity } : item))
    );
  };

  const removeFromCart = (cartId) => {
    setCart((prev) => prev.filter((item) => item.cart_id !== cartId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        cartSubtotal,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}

export default CartContext;

