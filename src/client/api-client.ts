import { pushAuthDebug } from "./auth-debug";

const USER_HEADERS: Record<string, string> = {};
const LANGUAGE_STORAGE_KEY = "coffee-shop-lang";
let accessTokenProvider: (() => Promise<string | undefined>) | null = null;

export function setUserHeaders(userId: string, userName: string) {
  USER_HEADERS["X-Teams-User-Id"] = userId;
  USER_HEADERS["X-Teams-User-Name"] = userName;
}

export function clearUserHeaders() {
  delete USER_HEADERS["X-Teams-User-Id"];
  delete USER_HEADERS["X-Teams-User-Name"];
}

export function setAccessTokenProvider(
  provider: (() => Promise<string | undefined>) | null
) {
  accessTokenProvider = provider;
}

function getLocaleHeader() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    localStorage.getItem(LANGUAGE_STORAGE_KEY) ||
    navigator.language ||
    ""
  );
}

export async function getRequestHeaders(
  extraHeaders: Record<string, string> = {},
  options?: { includeJsonContentType?: boolean }
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...USER_HEADERS,
    "X-Teams-User-Locale": getLocaleHeader(),
    ...extraHeaders,
  };

  if (options?.includeJsonContentType !== false) {
    headers["Content-Type"] = "application/json";
  }

  if (accessTokenProvider) {
    const token = await accessTokenProvider().catch(() => undefined);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

function hasAuthorizationHeader(headers: HeadersInit | undefined): boolean {
  if (!headers) {
    return false;
  }

  if (headers instanceof Headers) {
    return headers.has("Authorization");
  }
  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === "authorization");
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getRequestHeaders(options.headers as Record<string, string>);
  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      const bodyText = await res.clone().text().catch(() => "");
      pushAuthDebug(
        `401 on ${path}`,
        `authorization=${hasAuthorizationHeader(headers) ? "present" : "missing"} body=${bodyText || "n/a"}`
      );
    }

    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
