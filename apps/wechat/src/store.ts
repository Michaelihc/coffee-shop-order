import Taro from "@tarojs/taro";
import type { Order, PortableCartItem } from "@coffee-shop/portable";

const CART_KEY = "coffee-shop-wechat-cart";
const ORDERS_KEY = "coffee-shop-wechat-orders";
const GUEST_SESSION_KEY = "coffee-shop-wechat-guest-session";

export function loadCart(): PortableCartItem[] {
  return Taro.getStorageSync(CART_KEY) || [];
}

export function saveCart(items: PortableCartItem[]) {
  Taro.setStorageSync(CART_KEY, items);
}

export function clearCart() {
  Taro.removeStorageSync(CART_KEY);
}

export function loadOrders(): Order[] {
  return Taro.getStorageSync(ORDERS_KEY) || [];
}

export function saveOrders(orders: Order[]) {
  Taro.setStorageSync(ORDERS_KEY, orders);
}

export function upsertOrder(order: Order) {
  const current = loadOrders();
  const next = [order, ...current.filter((entry) => entry.id !== order.id)].slice(0, 10);
  saveOrders(next);
  return next;
}

export function loadGuestSession(): string {
  return Taro.getStorageSync(GUEST_SESSION_KEY) || "";
}

export function saveGuestSession(token: string) {
  Taro.setStorageSync(GUEST_SESSION_KEY, token);
}
