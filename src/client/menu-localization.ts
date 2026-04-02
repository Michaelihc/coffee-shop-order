import type { TFunction } from "i18next";
import type { Category, MenuItem } from "../types/models";

function translateWithFallback(
  t: TFunction,
  key: string,
  fallback: string | null | undefined
): string {
  if (t(key) !== key) {
    return t(key);
  }
  return fallback ?? "";
}

export function getLocalizedCategoryLabel(
  t: TFunction,
  category: Pick<Category, "id" | "label">
): string {
  return translateWithFallback(t, `menu.category.${category.id}`, category.label);
}

export function getLocalizedMenuItemName(
  t: TFunction,
  item: Pick<MenuItem, "id" | "name">
): string {
  return translateWithFallback(t, `menu.item.${item.id}.name`, item.name);
}

export function getLocalizedMenuItemDescription(
  t: TFunction,
  item: Pick<MenuItem, "id" | "description">
): string | null {
  const translated = translateWithFallback(
    t,
    `menu.item.${item.id}.description`,
    item.description
  );

  return translated || null;
}
