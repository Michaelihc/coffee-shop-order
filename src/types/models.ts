export type ItemClass = "premade" | "made-to-order";
export type PaymentMethod = "student-card" | "pay-at-collect";
export type CancelReason = "out-of-stock" | "over-capacity" | "other";
export type OrderStatus =
  | "confirmed"
  | "preparing"
  | "ready"
  | "collected"
  | "cancelled";
export type WindowStatus = "free" | "busy" | "near-capacity" | "over-capacity" | "closed";

export interface PickupWindow {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  madeToOrderCap: number;
  isActive: boolean;
  sortOrder: number;
  currentMadeToOrderCount?: number;
  status?: WindowStatus;
}

export interface Category {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  itemClass: ItemClass;
  stockCount: number | null;
  isAvailable: boolean;
  isAdvertised: boolean;
  imageUrl: string | null;
  sortOrder: number;
  availabilityLabel?: "available" | "limited" | "made-fresh" | "sold-out";
}

export interface Order {
  id: string;
  studentAadId: string;
  studentName: string;
  pickupWindowId: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  pickupCode: string | null;
  gridSlot: string | null;
  totalCents: number;
  paymentRef: string | null;
  paymentSettledAt: string | null;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  collectedAt: string | null;
  notes: string | null;
  items?: OrderItem[];
  pickupWindow?: PickupWindow;
}

export interface OrderItem {
  id: number;
  orderId: string;
  menuItemId: string;
  itemName: string;
  priceCents: number;
  quantity: number;
  itemClass: ItemClass;
}

export interface GridSlot {
  id: string;
  label: string;
  isOccupied: boolean;
  currentOrderId: string | null;
  zone: string;
}

export interface StaffMember {
  aadId: string;
  displayName: string;
  role: "staff" | "admin";
}
