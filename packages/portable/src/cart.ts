import type { ItemClass, MenuItem } from "./types";

export interface PortableCartItem {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  itemClass: ItemClass;
}

export function addCartItem(
  items: PortableCartItem[],
  item: Pick<PortableCartItem, "menuItemId" | "name" | "priceCents" | "itemClass">,
  quantity = 1
): PortableCartItem[] {
  const existing = items.find((entry) => entry.menuItemId === item.menuItemId);
  if (!existing) {
    return [...items, { ...item, quantity }];
  }

  return items.map((entry) =>
    entry.menuItemId === item.menuItemId
      ? { ...entry, quantity: entry.quantity + quantity }
      : entry
  );
}

export function updateCartItemQuantity(
  items: PortableCartItem[],
  menuItemId: string,
  quantity: number
): PortableCartItem[] {
  if (quantity <= 0) {
    return items.filter((entry) => entry.menuItemId !== menuItemId);
  }

  return items.map((entry) =>
    entry.menuItemId === menuItemId ? { ...entry, quantity } : entry
  );
}

export function cartItemCount(items: PortableCartItem[]): number {
  return items.reduce((sum, entry) => sum + entry.quantity, 0);
}

export function cartTotalCents(items: PortableCartItem[]): number {
  return items.reduce((sum, entry) => sum + entry.priceCents * entry.quantity, 0);
}

export function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function toCartItem(menuItem: MenuItem): Omit<PortableCartItem, "quantity"> {
  return {
    menuItemId: menuItem.id,
    name: menuItem.name,
    priceCents: menuItem.priceCents,
    itemClass: menuItem.itemClass,
  };
}
