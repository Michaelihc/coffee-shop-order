import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Order } from "@coffee-shop/portable";
import type { PortableCartItem } from "@coffee-shop/portable";

const CART_KEY = "coffee-shop-mobile-cart";
const ORDERS_KEY = "coffee-shop-mobile-orders";
const GUEST_SESSION_KEY = "coffee-shop-mobile-guest-session";

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCart() {
  return readJson<PortableCartItem[]>(CART_KEY, []);
}

export function saveCart(items: PortableCartItem[]) {
  return AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function clearCart() {
  return AsyncStorage.removeItem(CART_KEY);
}

export function loadOrders() {
  return readJson<Order[]>(ORDERS_KEY, []);
}

export async function saveOrder(order: Order) {
  const existing = await loadOrders();
  const next = [order, ...existing.filter((entry) => entry.id !== order.id)].slice(0, 10);
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(next));
}

export async function saveOrders(orders: Order[]) {
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function loadGuestSession() {
  return AsyncStorage.getItem(GUEST_SESSION_KEY);
}

export function saveGuestSession(token: string) {
  return AsyncStorage.setItem(GUEST_SESSION_KEY, token);
}
