"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  FREE_SHIPPING_THRESHOLD,
  PROMO_CODE,
  PROMO_RATE,
  SHIPPING_FLAT,
  getProduct,
  variantLabel,
  variantPrice,
} from "./products";

export interface CartItem {
  productId: string;
  variantId: string;
  qty: number;
}

export interface Address {
  fullName: string;
  line1: string;
  city: string;
  postcode: string;
  country: string;
}

export interface User {
  name: string;
  email: string;
  phone?: string;
  address?: Address;
}

export interface OrderItem {
  productId: string;
  name: string;
  variant: string;
  image: string;
  price: number;
  qty: number;
}

export type OrderStatus = "processing" | "shipped" | "delivered";

export interface TrackingEvent {
  label: string;
  detail: string;
  at: string | null;
}

export interface Order {
  id: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: OrderStatus;
  events: TrackingEvent[];
  address: Address;
  payment: string;
}

interface StoreState {
  user: User | null;
  cart: CartItem[];
  orders: Order[];
  promo: string | null;
  favorites: string[];
}

interface StoreValue extends StoreState {
  ready: boolean;
  cartCount: number;
  addToCart: (productId: string, variantId: string, qty?: number) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  removeItem: (productId: string, variantId: string) => void;
  clearCart: () => void;
  login: (email: string, name?: string) => void;
  register: (name: string, email: string) => void;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => void;
  applyPromo: (code: string) => boolean;
  removePromo: () => void;
  placeOrder: (opts: { address: Address; payment: string; discount?: number; shippingOverride?: number }) => Order;
  toggleFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
}

const STORAGE_KEY = "hanutek-store-v1";
const EMPTY: StoreState = { user: null, cart: [], orders: [], promo: null, favorites: [] };

const StoreContext = createContext<StoreValue | null>(null);

const daysAgo = (n: number, hour = 10) => {
  const d = new Date(Date.now() - n * 86400000);
  d.setHours(hour, 24, 0, 0);
  return d.toISOString();
};

function seedOrders(): Order[] {
  const mk = (
    id: string,
    created: string,
    items: OrderItem[],
    events: TrackingEvent[],
    address: Address,
  ): Order => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
    const done = events.filter((e) => e.at).length;
    const status: OrderStatus = done >= 5 ? "delivered" : done >= 3 ? "shipped" : "processing";
    return {
      id,
      createdAt: created,
      items,
      subtotal,
      shipping,
      discount: 0,
      total: subtotal + shipping,
      status,
      events,
      address,
      payment: "Visa ···· 4242",
    };
  };
  const address: Address = {
    fullName: "Demo Driver",
    line1: "12 Rue de la Route",
    city: "Lyon",
    postcode: "69002",
    country: "France",
  };
  const p3 = getProduct("gripdash-phone-mount")!;
  const p12 = getProduct("sportgrip-wheel-cover")!;
  const p9 = getProduct("jumpcore-1000-starter")!;
  return [
    mk(
      "HT-251904",
      daysAgo(3, 9),
      [
        {
          productId: p9.slug,
          name: p9.name,
          variant: variantLabel(p9, "1000"),
          image: p9.image,
          price: variantPrice(p9, "1000"),
          qty: 1,
        },
      ],
      [
        { label: "Order placed", detail: "Payment confirmed", at: daysAgo(3, 9) },
        { label: "Packed", detail: "Hanutek warehouse, Lyon", at: daysAgo(2, 14) },
        { label: "Shipped", detail: "Carrier: Colissimo · track HT251904FR", at: daysAgo(1, 8) },
        { label: "Out for delivery", detail: "Local depot", at: null },
        { label: "Delivered", detail: "Signature on receipt", at: null },
      ],
      address,
    ),
    mk(
      "HT-248173",
      daysAgo(18, 11),
      [
        {
          productId: p3.slug,
          name: p3.name,
          variant: variantLabel(p3, "black"),
          image: p3.image,
          price: variantPrice(p3, "black"),
          qty: 1,
        },
        {
          productId: p12.slug,
          name: p12.name,
          variant: variantLabel(p12, "m-tan"),
          image: p12.image,
          price: variantPrice(p12, "m-tan"),
          qty: 1,
        },
      ],
      [
        { label: "Order placed", detail: "Payment confirmed", at: daysAgo(18, 11) },
        { label: "Packed", detail: "Hanutek warehouse, Lyon", at: daysAgo(17, 15) },
        { label: "Shipped", detail: "Carrier: Colissimo · track HT248173FR", at: daysAgo(16, 9) },
        { label: "Out for delivery", detail: "Local depot", at: daysAgo(14, 8) },
        { label: "Delivered", detail: "Left with recipient", at: daysAgo(14, 13) },
      ],
      address,
    ),
  ];
}

export function cartTotals(items: CartItem[], discountRate = 0) {
  const subtotal = items.reduce((sum, item) => {
    const p = getProduct(item.productId);
    if (!p) return sum;
    return sum + variantPrice(p, item.variantId) * item.qty;
  }, 0);
  const discount = Math.round(subtotal * discountRate * 100) / 100;
  const shipping = subtotal === 0 || subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = Math.max(0, subtotal - discount + shipping);
  return { subtotal, discount, shipping, total };
}

export const promoDiscountRate = (promo: string | null) => (promo ? PROMO_RATE : 0);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        setState({
          user: parsed.user ?? null,
          cart: Array.isArray(parsed.cart) ? parsed.cart : [],
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          promo: parsed.promo ?? null,
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        });
      }
    } catch {
      /* corrupted storage — start fresh */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [state, ready]);

  const addToCart = useCallback((productId: string, variantId: string, qty = 1) => {
    setState((s) => {
      const idx = s.cart.findIndex((i) => i.productId === productId && i.variantId === variantId);
      const cart = [...s.cart];
      if (idx >= 0) cart[idx] = { ...cart[idx], qty: Math.min(10, cart[idx].qty + qty) };
      else cart.push({ productId, variantId, qty: Math.min(10, qty) });
      return { ...s, cart };
    });
  }, []);

  const setQty = useCallback((productId: string, variantId: string, qty: number) => {
    setState((s) => ({
      ...s,
      cart:
        qty <= 0
          ? s.cart.filter((i) => !(i.productId === productId && i.variantId === variantId))
          : s.cart.map((i) =>
              i.productId === productId && i.variantId === variantId
                ? { ...i, qty: Math.min(10, qty) }
                : i,
            ),
    }));
  }, []);

  const removeItem = useCallback((productId: string, variantId: string) => {
    setState((s) => ({
      ...s,
      cart: s.cart.filter((i) => !(i.productId === productId && i.variantId === variantId)),
    }));
  }, []);

  const clearCart = useCallback(() => setState((s) => ({ ...s, cart: [] })), []);

  const login = useCallback((email: string, name?: string) => {
    setState((s) => ({
      ...s,
      user: s.user ?? {
        name: name ?? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        email,
      },
      orders: s.orders.length > 0 ? s.orders : seedOrders(),
    }));
  }, []);

  const register = useCallback((name: string, email: string) => {
    setState((s) => ({
      ...s,
      user: { name, email },
      orders: s.orders.length > 0 ? s.orders : seedOrders(),
    }));
  }, []);

  const logout = useCallback(() => setState((s) => ({ ...s, user: null })), []);

  const updateProfile = useCallback((patch: Partial<User>) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...patch } } : s));
  }, []);

  const applyPromo = useCallback((code: string) => {
    if (code.trim().toUpperCase() === PROMO_CODE) {
      setState((s) => ({ ...s, promo: PROMO_CODE }));
      return true;
    }
    return false;
  }, []);

  const removePromo = useCallback(() => setState((s) => ({ ...s, promo: null })), []);

  const placeOrder = useCallback(
    ({
      address,
      payment,
      discount = 0,
      shippingOverride,
    }: {
      address: Address;
      payment: string;
      discount?: number;
      shippingOverride?: number;
    }) => {
      const items: OrderItem[] = state.cart.flatMap((item) => {
        const p = getProduct(item.productId);
        if (!p) return [];
        return [
          {
            productId: p.slug,
            name: p.name,
            variant: variantLabel(p, item.variantId),
            image: p.image,
            price: variantPrice(p, item.variantId),
            qty: item.qty,
          },
        ];
      });
      const base = cartTotals(state.cart);
      const discountAmount = Math.min(discount, base.subtotal);
      const shipping =
        shippingOverride ??
        (base.subtotal - discountAmount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT);
      const order: Order = {
        id: `HT-${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: new Date().toISOString(),
        items,
        subtotal: base.subtotal,
        shipping,
        discount: Math.round(discountAmount * 100) / 100,
        total: Math.max(0, base.subtotal - discountAmount + shipping),
        status: "processing",
        events: [
          { label: "Order placed", detail: "Payment confirmed", at: new Date().toISOString() },
          { label: "Packed", detail: "Hanutek warehouse, Lyon", at: null },
          { label: "Shipped", detail: "Carrier assignment pending", at: null },
          { label: "Out for delivery", detail: "Local depot", at: null },
          { label: "Delivered", detail: "Signature on receipt", at: null },
        ],
        address,
        payment,
      };
      setState((s) => ({ ...s, cart: [], orders: [order, ...s.orders], promo: null }));
      return order;
    },
    [state.cart],
  );

  const toggleFavorite = useCallback((slug: string) => {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(slug) ? s.favorites.filter((x) => x !== slug) : [...s.favorites, slug],
    }));
  }, []);
  const isFavorite = useCallback((slug: string) => state.favorites.includes(slug), [state.favorites]);

  const cartCount = useMemo(() => state.cart.reduce((n, i) => n + i.qty, 0), [state.cart]);

  const value: StoreValue = {
    ...state,
    ready,
    cartCount,
    addToCart,
    setQty,
    removeItem,
    clearCart,
    login,
    register,
    logout,
    updateProfile,
    applyPromo,
    removePromo,
    placeOrder,
    toggleFavorite,
    isFavorite,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}