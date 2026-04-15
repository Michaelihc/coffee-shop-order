import { isAppSettingKey, type AppSettingKey } from "../config/app-settings";

interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

interface ValidationFailure {
  ok: false;
  error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface InventoryCreateInput {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  itemClass: "premade" | "made-to-order";
  stockCount: number | null;
}

export interface InventoryUpdateInput {
  categoryId?: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  itemClass?: "premade" | "made-to-order";
  stockCount?: number | null;
  sortOrder?: number;
}

export interface InventoryPatchInput {
  stockCount?: number;
  isAvailable?: boolean;
  isAdvertised?: boolean;
}

export interface WindowCreateInput {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  madeToOrderCap: number;
}

export interface WindowUpdateInput {
  label?: string;
  startsAt?: string;
  endsAt?: string;
  madeToOrderCap?: number;
  isActive?: boolean;
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeNullableText(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  const normalized = normalizeOptionalString(value);
  return normalized === undefined ? undefined : normalized;
}

function validateItemClass(value: unknown): value is "premade" | "made-to-order" {
  return value === "premade" || value === "made-to-order";
}

function validateTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

export function validateInventoryCreatePayload(payload: unknown): ValidationResult<InventoryCreateInput> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid inventory payload" };
  }

  const candidate = payload as Record<string, unknown>;
  const id = normalizeOptionalString(candidate.id);
  const categoryId = normalizeOptionalString(candidate.categoryId);
  const name = normalizeOptionalString(candidate.name);
  const description = normalizeNullableText(candidate.description) ?? null;
  const priceCents = candidate.priceCents;
  const itemClass = candidate.itemClass;
  const stockCount = candidate.stockCount;

  if (!id || !categoryId || !name || !isWholeNumber(priceCents) || !validateItemClass(itemClass)) {
    return { ok: false, error: "Missing or invalid required fields" };
  }
  if (priceCents < 0) {
    return { ok: false, error: "priceCents must be 0 or greater" };
  }
  if (itemClass === "premade" && (!isWholeNumber(stockCount) || stockCount < 0)) {
    return { ok: false, error: "stockCount must be 0 or greater for premade items" };
  }

  return {
    ok: true,
    value: {
      id,
      categoryId,
      name,
      description,
      priceCents,
      itemClass,
      stockCount: itemClass === "premade" ? (stockCount as number) : null,
    },
  };
}

export function validateInventoryUpdatePayload(payload: unknown): ValidationResult<InventoryUpdateInput> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid inventory payload" };
  }

  const candidate = payload as Record<string, unknown>;
  const itemClass = candidate.itemClass;
  const priceCents = candidate.priceCents;
  const stockCount = candidate.stockCount;
  const sortOrder = candidate.sortOrder;

  if (itemClass !== undefined && !validateItemClass(itemClass)) {
    return { ok: false, error: "itemClass must be 'premade' or 'made-to-order'" };
  }
  if (priceCents !== undefined && (!isWholeNumber(priceCents) || priceCents < 0)) {
    return { ok: false, error: "priceCents must be 0 or greater" };
  }
  if (stockCount !== undefined && stockCount !== null && (!isWholeNumber(stockCount) || stockCount < 0)) {
    return { ok: false, error: "stockCount must be 0 or greater" };
  }
  if (sortOrder !== undefined && (!isWholeNumber(sortOrder) || sortOrder < 0)) {
    return { ok: false, error: "sortOrder must be 0 or greater" };
  }

  return {
    ok: true,
    value: {
      categoryId: normalizeOptionalString(candidate.categoryId),
      name: normalizeOptionalString(candidate.name),
      description: normalizeNullableText(candidate.description),
      priceCents: priceCents as number | undefined,
      itemClass: itemClass as InventoryUpdateInput["itemClass"],
      stockCount: stockCount as number | null | undefined,
      sortOrder: sortOrder as number | undefined,
    },
  };
}

export function validateInventoryPatchPayload(payload: unknown): ValidationResult<InventoryPatchInput> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid inventory payload" };
  }

  const candidate = payload as Record<string, unknown>;
  const stockCount = candidate.stockCount;
  const isAvailable = candidate.isAvailable;
  const isAdvertised = candidate.isAdvertised;

  if (stockCount !== undefined && (!isWholeNumber(stockCount) || stockCount < 0)) {
    return { ok: false, error: "stockCount must be 0 or greater" };
  }
  if (isAvailable !== undefined && typeof isAvailable !== "boolean") {
    return { ok: false, error: "isAvailable must be a boolean" };
  }
  if (isAdvertised !== undefined && typeof isAdvertised !== "boolean") {
    return { ok: false, error: "isAdvertised must be a boolean" };
  }

  return {
    ok: true,
    value: {
      stockCount: stockCount as number | undefined,
      isAvailable: isAvailable as boolean | undefined,
      isAdvertised: isAdvertised as boolean | undefined,
    },
  };
}

export function validateWindowCreatePayload(payload: unknown): ValidationResult<WindowCreateInput> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid pickup window payload" };
  }

  const candidate = payload as Record<string, unknown>;
  const id = normalizeOptionalString(candidate.id);
  const label = normalizeOptionalString(candidate.label);
  const startsAt = candidate.startsAt;
  const endsAt = candidate.endsAt;
  const madeToOrderCap = candidate.madeToOrderCap;

  if (!id || !label || !validateTime(startsAt) || !validateTime(endsAt) || !isWholeNumber(madeToOrderCap)) {
    return { ok: false, error: "Missing or invalid required fields (id, label, startsAt, endsAt, madeToOrderCap)" };
  }
  if (madeToOrderCap < 0) {
    return { ok: false, error: "madeToOrderCap must be 0 or greater" };
  }

  return {
    ok: true,
    value: {
      id,
      label,
      startsAt,
      endsAt,
      madeToOrderCap,
    },
  };
}

export function validateWindowUpdatePayload(payload: unknown): ValidationResult<WindowUpdateInput> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid pickup window payload" };
  }

  const candidate = payload as Record<string, unknown>;
  const madeToOrderCap = candidate.madeToOrderCap;
  const isActive = candidate.isActive;

  if (candidate.startsAt !== undefined && !validateTime(candidate.startsAt)) {
    return { ok: false, error: "startsAt must be in HH:MM format" };
  }
  if (candidate.endsAt !== undefined && !validateTime(candidate.endsAt)) {
    return { ok: false, error: "endsAt must be in HH:MM format" };
  }
  if (madeToOrderCap !== undefined && (!isWholeNumber(madeToOrderCap) || madeToOrderCap < 0)) {
    return { ok: false, error: "madeToOrderCap must be 0 or greater" };
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return { ok: false, error: "isActive must be a boolean" };
  }

  return {
    ok: true,
    value: {
      label: normalizeOptionalString(candidate.label),
      startsAt: candidate.startsAt as string | undefined,
      endsAt: candidate.endsAt as string | undefined,
      madeToOrderCap: madeToOrderCap as number | undefined,
      isActive: isActive as boolean | undefined,
    },
  };
}
const POSITIVE_INTEGER_SETTINGS = new Set<AppSettingKey>([
  "max_items_per_order",
  "max_order_total_cents",
  "daily_spend_limit_cents",
]);

export function validateSettingValue(key: string, rawValue: unknown): ValidationResult<string> {
  if (!isAppSettingKey(key)) {
    return { ok: false, error: "Unsupported setting key" };
  }

  if (rawValue === undefined) {
    return { ok: false, error: "Missing value" };
  }

  const normalizedValue = String(rawValue).trim();
  if (!normalizedValue) {
    return { ok: false, error: "Value cannot be empty" };
  }

  if (key === "enforce_window_cap") {
    if (normalizedValue !== "0" && normalizedValue !== "1") {
      return { ok: false, error: "enforce_window_cap must be 0 or 1" };
    }
    return { ok: true, value: normalizedValue };
  }

  if (POSITIVE_INTEGER_SETTINGS.has(key)) {
    const parsed = Number.parseInt(normalizedValue, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: `${key} must be a positive integer` };
    }
  }

  return { ok: true, value: normalizedValue };
}
