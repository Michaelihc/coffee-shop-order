export type ItemClass = "premade" | "made-to-order";
export type PaymentMethod =
  | "student-card"
  | "pay-at-collect"
  | "cash-at-counter"
  | "wechat-pay";
export type CustomerType = "student" | "guest";
export type PaymentStatus = "paid" | "pending" | "unpaid" | "refunded";
export type OrderStatus =
  | "confirmed"
  | "preparing"
  | "ready"
  | "collected"
  | "cancelled";
export type WindowStatus = "free" | "busy" | "near-capacity" | "over-capacity" | "closed";
export type WechatPayPresentation = "auto" | "qr" | "direct";

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

export interface OrderItem {
  id: number;
  orderId: string;
  menuItemId: string;
  itemName: string;
  priceCents: number;
  quantity: number;
  itemClass: ItemClass;
}

export interface Order {
  id: string;
  studentAadId: string;
  studentName: string;
  customerType: CustomerType;
  guestPhone: string | null;
  pickupWindowId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  pickupCode: string | null;
  gridSlot: string | null;
  totalCents: number;
  paymentRef: string | null;
  paymentSettledAt: string | null;
  cancelReason: string | null;
  cancelNote: string | null;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  collectedAt: string | null;
  notes: string | null;
  items?: OrderItem[];
  pickupWindow?: PickupWindow;
}

export interface MenuResponse {
  categories: (Category & { items: MenuItem[] })[];
}

export interface PickupWindowsResponse {
  windows: PickupWindow[];
}

export interface GuestDetails {
  name?: string;
  phone: string;
}

export interface CreateGuestOrderRequest {
  pickupWindowId: string;
  paymentMethod: "cash-at-counter" | "wechat-pay";
  items: { menuItemId: string; quantity: number }[];
  notes?: string;
  guest: GuestDetails;
  wechatPayPresentation?: WechatPayPresentation;
}

export type WechatPaymentInstructions =
  | { kind: "qr"; codeUrl: string }
  | { kind: "h5"; h5Url: string }
  | {
      kind: "jsapi";
      timeStamp: string;
      nonceStr: string;
      package: string;
      signType: "RSA";
      paySign: string;
    };

export interface CreateGuestOrderResponse {
  order: Order;
  payment?: WechatPaymentInstructions;
}

export interface OrderPaymentStatusResponse {
  orderId: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

export interface GuestAuthConfigResponse {
  turnstileSiteKey: string | null;
}

export interface GuestAuthMeResponse {
  authenticated: boolean;
  phone?: string;
  maskedPhone?: string;
}

export interface SendGuestCodeRequest {
  phone: string;
  turnstileToken: string;
}

export interface SendGuestCodeResponse {
  maskedPhone: string;
}

export interface VerifyGuestCodeRequest {
  phone: string;
  code: string;
}

export interface VerifyGuestCodeResponse {
  token: string;
  maskedPhone: string;
  expiresAt: string;
}
