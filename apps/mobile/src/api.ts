import Constants from "expo-constants";
import type {
  CreateGuestOrderRequest,
  CreateGuestOrderResponse,
  GuestAuthConfigResponse,
  GuestAuthMeResponse,
  MenuResponse,
  OrderPaymentStatusResponse,
  PickupWindowsResponse,
  SendGuestCodeResponse,
  VerifyGuestCodeResponse,
} from "@coffee-shop/portable";
import { loadGuestSession } from "./storage";

function getApiBaseUrl() {
  const value =
    Constants.expoConfig?.extra?.apiBaseUrl ||
    "http://127.0.0.1:53000";
  return String(value).replace(/\/+$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const guestSession = await loadGuestSession();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(guestSession ? { "X-Guest-Session": guestSession } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const portableApi = {
  getMenu: () => request<MenuResponse>("/api/menu"),
  getPickupWindows: () => request<PickupWindowsResponse>("/api/pickup-windows"),
  getGuestAuthConfig: () => request<GuestAuthConfigResponse>("/api/guest/auth/config"),
  getGuestAuth: () => request<GuestAuthMeResponse>("/api/guest/auth/me"),
  sendGuestCode: (phone: string, turnstileToken: string) =>
    request<SendGuestCodeResponse>("/api/guest/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ phone, turnstileToken }),
    }),
  verifyGuestCode: (phone: string, code: string) =>
    request<VerifyGuestCodeResponse>("/api/guest/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  createGuestOrder: (body: CreateGuestOrderRequest) =>
    request<CreateGuestOrderResponse>("/api/guest/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPaymentStatus: (orderId: string) =>
    request<OrderPaymentStatusResponse>(`/api/payments/wechat/orders/${orderId}/status`),
};
