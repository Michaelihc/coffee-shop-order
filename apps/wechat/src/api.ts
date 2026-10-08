import Taro from "@tarojs/taro";
import type {
  CreateGuestOrderRequest,
  CreateGuestOrderResponse,
  GuestAuthMeResponse,
  MenuResponse,
  OrderPaymentStatusResponse,
  PickupWindowsResponse,
  VerifyGuestCodeResponse,
} from "@coffee-shop/portable";
import { loadGuestSession } from "./store";

function getApiBaseUrl() {
  return (process.env.TARO_APP_API_BASE_URL || "http://127.0.0.1:53000").replace(/\/+$/, "");
}

async function request<T>(
  path: string,
  options?: {
    method?: "GET" | "POST";
    data?: unknown;
    header?: Record<string, string>;
  }
): Promise<T> {
  const response = await Taro.request<T>({
    url: `${getApiBaseUrl()}${path}`,
    method: options?.method || "GET",
    data: options?.data,
    header: {
      "Content-Type": "application/json",
      ...(loadGuestSession() ? { "X-Guest-Session": loadGuestSession() } : {}),
      ...(options?.header || {}),
    },
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const errorBody = (response.data as { error?: string }) || {};
    throw new Error(errorBody.error || `HTTP ${response.statusCode}`);
  }

  return response.data;
}

export const portableApi = {
  getMenu: () => request<MenuResponse>("/api/menu"),
  getPickupWindows: () => request<PickupWindowsResponse>("/api/pickup-windows"),
  getGuestAuth: () => request<GuestAuthMeResponse>("/api/guest/auth/me"),
  verifyWechatPhone: (code: string) =>
    request<VerifyGuestCodeResponse>("/api/guest/auth/wechat-phone", {
      method: "POST",
      data: { code },
    }),
  createGuestOrder: (payload: CreateGuestOrderRequest, wechatOpenId?: string) =>
    request<CreateGuestOrderResponse>("/api/guest/orders", {
      method: "POST",
      data: payload,
      header: wechatOpenId ? { "x-wechat-openid": wechatOpenId } : undefined,
    }),
  getPaymentStatus: (orderId: string) =>
    request<OrderPaymentStatusResponse>(`/api/payments/wechat/orders/${orderId}/status`),
};
