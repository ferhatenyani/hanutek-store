"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, SESSION_LOST_EVENT } from "./api";
import type {
  CartDTO,
  Locale,
  PlaceOrderResultDTO,
  SessionDTO,
  UserDTO,
  AddressDTO,
} from "./api-types";

/*
 * Client state backed by the API. The server is the source of truth for the
 * user, cart (prices, stock, promo) and favorites; this store keeps a local
 * mirror with optimistic updates so the UI stays instant.
 *
 *  - One bootstrap request on load (POST /auth/session) restores the session
 *    (rotating an expired access token) and returns user + cart + favorites.
 *  - Cart writes are optimistic; responses are applied only if no newer write
 *    started meanwhile (sequence guard), so rapid clicks never flicker back.
 *  - Quantity steppers are debounced per line.
 *  - Guests keep favorites in localStorage; they merge into the account on sign-in.
 */

export type { CartDTO, UserDTO };
export type User = UserDTO;

const FAV_KEY = "hanutek-favorites-v1";
const LEGACY_KEY = "hanutek-store-v1";
const GUEST_ORDERS_KEY = "hanutek-guest-orders-v1";
const EMPTY_CART: CartDTO = { lines: [], count: 0, promo: null, subtotal: 0, discount: 0, total: 0 };

export interface CheckoutInput {
  contact: { name: string; phone: string; email?: string | null };
  address: { line1: string; commune: string; wilaya: string; postalCode?: string | null };
  note?: string | null;
  saveAddress?: boolean;
  idempotencyKey: string;
  locale: Locale;
}

interface StoreValue {
  ready: boolean;
  user: UserDTO | null;
  cart: CartDTO;
  cartCount: number;
  promo: string | null;
  favorites: string[];
  features: SessionDTO["features"];
  /** Line count currently being saved (for subtle busy states). */
  syncing: boolean;
  addToCart: (variantId: string, qty?: number) => Promise<void>;
  setQty: (variantId: string, qty: number) => void;
  removeItem: (variantId: string) => void;
  applyPromo: (code: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  removePromo: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; locale: Locale }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: { name?: string; phone?: string | null; defaultAddress?: Omit<AddressDTO, "id"> | null }) => Promise<UserDTO>;
  placeOrder: (input: CheckoutInput) => Promise<PlaceOrderResultDTO>;
  toggleFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
  reloadSession: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

// ------------------------------------------------------------ local helpers

function readLocalFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(list)) return list.filter((x): x is string => typeof x === "string");
    // one-time migration from the pre-backend localStorage store
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { favorites?: unknown };
      localStorage.removeItem(LEGACY_KEY);
      if (Array.isArray(parsed.favorites)) return parsed.favorites.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* unavailable / corrupted */
  }
  return [];
}

function writeLocalFavorites(list: string[]) {
  try {
    if (list.length) localStorage.setItem(FAV_KEY, JSON.stringify(list));
    else localStorage.removeItem(FAV_KEY);
  } catch {
    /* non-fatal */
  }
}

/** Guest order access keys (the server only hands them out once, at checkout). */
export function rememberGuestOrder(number: string, key: string) {
  try {
    const map = JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY) ?? "{}") as Record<string, string>;
    map[number] = key;
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(map));
  } catch {
    /* non-fatal */
  }
}

export function guestOrderKey(number: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY) ?? "{}") as Record<string, string>)[number] ?? null;
  } catch {
    return null;
  }
}

/** Local re-pricing for optimistic quantity changes (server response reconciles). */
function withQty(cart: CartDTO, variantId: string, qty: number): CartDTO {
  const lines = cart.lines
    .map((l) => (l.variantId === variantId ? { ...l, qty, lineTotal: l.unitPrice * qty, available: l.available && qty <= l.maxQty } : l))
    .filter((l) => l.qty > 0);
  const subtotal = lines.filter((l) => l.available).reduce((s, l) => s + l.lineTotal, 0);
  // Mirrors the server's computeDiscount; the server response reconciles anyway.
  let discount = 0;
  const p = cart.promo;
  if (p && (!p.ineligible || p.ineligible === "min_subtotal") && subtotal >= p.minSubtotal && subtotal > 0) {
    discount = p.type === "percent" ? Math.round((subtotal * Math.min(100, p.value)) / 100) : p.value;
    if (p.maxDiscount != null) discount = Math.min(discount, p.maxDiscount);
    discount = Math.max(0, Math.min(discount, subtotal));
  }
  return { ...cart, lines, subtotal, discount, total: Math.max(0, subtotal - discount), count: lines.reduce((n, l) => n + l.qty, 0) };
}

// ------------------------------------------------------------ provider

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [cart, setCart] = useState<CartDTO>(EMPTY_CART);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [features, setFeatures] = useState<SessionDTO["features"]>({ google: false });
  const [pending, setPending] = useState(0);

  const cartSeq = useRef(0);
  const qtyTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const userRef = useRef<UserDTO | null>(null);
  const favoritesRef = useRef<string[]>([]);
  useEffect(() => {
    userRef.current = user;
    favoritesRef.current = favorites;
  }, [user, favorites]);

  const track = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    setPending((n) => n + 1);
    try {
      return await p;
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  const loadSession = useCallback(async () => {
    let s: SessionDTO;
    try {
      s = await api<SessionDTO>("/auth/session", { method: "POST" });
    } catch (err) {
      // Concurrent tab rotated the refresh token: one retry with the fresh cookie.
      if (err instanceof ApiError && err.code === "REFRESH_RACE") s = await api<SessionDTO>("/auth/session", { method: "POST" });
      else throw err;
    }
    cartSeq.current++;
    setUser(s.user);
    setCart(s.cart);
    setFeatures(s.features);
    if (s.user) {
      const local = readLocalFavorites();
      if (local.length) {
        const merged = await api<{ slugs: string[] }>("/me/favorites", { method: "POST", body: { slugs: local } }).catch(() => null);
        writeLocalFavorites([]);
        setFavorites(merged?.slugs ?? s.favorites);
      } else setFavorites(s.favorites);
    } else {
      setFavorites(readLocalFavorites());
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // Bootstrap from the server once; all state updates happen after the network round-trip.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession()
      .catch(() => {
        // Offline / server down: degrade to an empty guest session.
        if (alive) setFavorites(readLocalFavorites());
      })
      .finally(() => alive && setReady(true));
    const onLost = () => {
      setUser(null);
      void loadSession().catch(() => undefined);
    };
    window.addEventListener(SESSION_LOST_EVENT, onLost);
    return () => {
      alive = false;
      window.removeEventListener(SESSION_LOST_EVENT, onLost);
    };
  }, [loadSession]);

  /** Runs a cart write; applies the server cart only if it is still the latest write. */
  const cartWrite = useCallback(
    async (call: () => Promise<{ cart: CartDTO }>) => {
      const mine = ++cartSeq.current;
      try {
        const { cart: next } = await track(call());
        if (mine === cartSeq.current) setCart(next);
      } catch (err) {
        // Re-sync with the server's truth, then surface the error.
        const fresh = await api<{ cart: CartDTO }>("/cart").catch(() => null);
        if (fresh && mine === cartSeq.current) setCart(fresh.cart);
        throw err;
      }
    },
    [track],
  );

  const addToCart = useCallback(
    (variantId: string, qty = 1) => cartWrite(() => api("/cart/items", { method: "POST", body: { variantId, qty } })),
    [cartWrite],
  );

  const setQty = useCallback(
    (variantId: string, qty: number) => {
      cartSeq.current++;
      setCart((c) => withQty(c, variantId, Math.max(0, Math.min(10, qty))));
      const timers = qtyTimers.current;
      clearTimeout(timers.get(variantId));
      timers.set(
        variantId,
        setTimeout(() => {
          timers.delete(variantId);
          void cartWrite(() =>
            qty <= 0
              ? api(`/cart/items/${variantId}`, { method: "DELETE" })
              : api(`/cart/items/${variantId}`, { method: "PATCH", body: { qty } }),
          ).catch(() => undefined);
        }, 280),
      );
    },
    [cartWrite],
  );

  const removeItem = useCallback((variantId: string) => setQty(variantId, 0), [setQty]);

  const applyPromo = useCallback(
    async (code: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      try {
        await cartWrite(() => api("/cart/promo", { method: "POST", body: { code } }));
        return { ok: true };
      } catch (err) {
        if (!(err instanceof ApiError) || err.code === "NETWORK" || err.status >= 500) return { ok: false, reason: "network" };
        return { ok: false, reason: err.reason ?? err.code };
      }
    },
    [cartWrite],
  );

  const removePromo = useCallback(() => cartWrite(() => api("/cart/promo", { method: "DELETE" })), [cartWrite]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api("/auth/login", { method: "POST", body: { email, password } });
      await loadSession();
    },
    [loadSession],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string; locale: Locale }) => {
      await api("/auth/register", { method: "POST", body: { ...input, acceptTerms: true } });
      await loadSession();
    },
    [loadSession],
  );

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    cartSeq.current++;
    setUser(null);
    setCart(EMPTY_CART);
    setFavorites([]);
    await loadSession().catch(() => undefined);
  }, [loadSession]);

  const updateProfile = useCallback(async (patch: Parameters<StoreValue["updateProfile"]>[0]) => {
    const { user: next } = await api<{ user: UserDTO }>("/me", { method: "PATCH", body: patch });
    setUser(next);
    return next;
  }, []);

  const placeOrder = useCallback(
    async (input: CheckoutInput) => {
      // flush pending debounced quantity changes so the server cart matches what the shopper sees
      for (const [variantId, t] of qtyTimers.current) {
        clearTimeout(t);
        qtyTimers.current.delete(variantId);
        const line = cart.lines.find((l) => l.variantId === variantId);
        await (line ? api(`/cart/items/${variantId}`, { method: "PATCH", body: { qty: line.qty } }) : api(`/cart/items/${variantId}`, { method: "DELETE" })).catch(() => undefined);
      }
      const result = await track(api<PlaceOrderResultDTO>("/orders", { method: "POST", body: input }));
      if (result.accessKey) rememberGuestOrder(result.order.number, result.accessKey);
      cartSeq.current++;
      setCart(EMPTY_CART);
      if (userRef.current && input.saveAddress) void api<{ user: UserDTO }>("/me").then((r) => setUser(r.user)).catch(() => undefined);
      return result;
    },
    [cart.lines, track],
  );

  const toggleFavorite = useCallback((slug: string) => {
    const prev = favoritesRef.current;
    const on = !prev.includes(slug);
    const next = on ? [slug, ...prev] : prev.filter((s) => s !== slug);
    favoritesRef.current = next;
    setFavorites(next);
    if (userRef.current) {
      api<{ slugs: string[] }>(`/me/favorites/${encodeURIComponent(slug)}`, { method: on ? "PUT" : "DELETE" })
        .then((r) => setFavorites(r.slugs))
        .catch(() => setFavorites(prev));
    } else {
      writeLocalFavorites(next);
    }
  }, []);

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      user,
      cart,
      cartCount: cart.count,
      promo: cart.promo?.code ?? null,
      favorites,
      features,
      syncing: pending > 0,
      addToCart,
      setQty,
      removeItem,
      applyPromo,
      removePromo,
      login,
      register,
      logout,
      updateProfile,
      placeOrder,
      toggleFavorite,
      isFavorite,
      reloadSession: loadSession,
    }),
    [ready, user, cart, favorites, features, pending, addToCart, setQty, removeItem, applyPromo, removePromo, login, register, logout, updateProfile, placeOrder, toggleFavorite, isFavorite, loadSession],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
