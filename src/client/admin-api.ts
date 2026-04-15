import { api, getRequestHeaders } from "./api-client";
import type {
  BalanceReportResponse,
  SpendingReportResponse,
} from "../types/api";
import type { Category, MenuItem, PickupWindow } from "../types/models";

export interface InventoryResponse {
  items: MenuItem[];
  categories: Category[];
}

export async function fetchInventory() {
  return api.get<InventoryResponse>("/api/admin/inventory");
}

export async function updateInventoryStock(itemId: string, stockCount: number) {
  return api.patch(`/api/admin/inventory/${itemId}`, { stockCount });
}

export async function updateInventoryAvailability(itemId: string, isAvailable: boolean) {
  return api.patch(`/api/admin/inventory/${itemId}`, { isAvailable });
}

export async function updateInventoryAdvertising(itemId: string, isAdvertised: boolean) {
  return api.patch(`/api/admin/inventory/${itemId}`, { isAdvertised });
}

export async function saveInventoryItem(
  item: {
    id?: string;
    categoryId: string;
    name: string;
    description: string | null;
    priceCents: number;
    itemClass: string;
    stockCount: number;
  },
  editingId?: string | null
) {
  if (editingId) {
    return api.put(`/api/admin/inventory/${editingId}`, item);
  }

  return api.post("/api/admin/inventory", {
    id: item.id,
    ...item,
  });
}

export async function deleteInventoryItem(itemId: string) {
  return api.delete<{ deleted: boolean; softDeleted?: boolean }>(
    `/api/admin/inventory/${itemId}`
  );
}

export async function uploadInventoryImage(itemId: string, file: File) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`/api/admin/inventory/${itemId}/image`, {
    method: "POST",
    headers: await getRequestHeaders({}, { includeJsonContentType: false }),
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `Upload failed (HTTP ${response.status})`);
  }

  return response.json();
}

export async function removeInventoryImage(itemId: string) {
  return api.delete(`/api/admin/inventory/${itemId}/image`);
}

export async function fetchWindows() {
  return api.get<{ windows: PickupWindow[] }>("/api/admin/windows");
}

export async function saveWindow(
  windowInput: {
    id?: string;
    label: string;
    startsAt: string;
    endsAt: string;
    madeToOrderCap: number;
  },
  editingWindowId?: string | null
) {
  if (editingWindowId) {
    return api.put(`/api/admin/windows/${editingWindowId}`, windowInput);
  }

  return api.post("/api/admin/windows", {
    id: windowInput.id,
    ...windowInput,
  });
}

export async function updateWindow(windowId: string, body: Record<string, unknown>) {
  return api.put(`/api/admin/windows/${windowId}`, body);
}

export async function deleteWindow(windowId: string) {
  return api.delete<{ deleted: boolean; deactivated?: boolean }>(
    `/api/admin/windows/${windowId}`
  );
}

export async function fetchSettings() {
  return api.get<{ settings: Record<string, string> }>("/api/admin/settings");
}

export async function updateSetting(key: string, value: string) {
  return api.patch(`/api/admin/settings/${key}`, { value });
}

export async function fetchBalanceReport() {
  return api.get<BalanceReportResponse>("/api/admin/reports/balance");
}

export async function fetchSpendingReport() {
  return api.get<SpendingReportResponse>("/api/admin/reports/spending");
}

function parseFilename(contentDisposition: string | null, fallbackFilename: string): string {
  if (!contentDisposition) {
    return fallbackFilename;
  }

  const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
  return match?.[1] || fallbackFilename;
}

export async function downloadAuthenticatedFile(path: string, fallbackFilename: string) {
  const response = await fetch(path, {
    headers: await getRequestHeaders({}, { includeJsonContentType: false }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Download failed (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const filename = parseFilename(
    response.headers.get("Content-Disposition"),
    fallbackFilename
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
