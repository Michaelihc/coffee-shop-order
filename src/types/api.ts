import type {
  Category,
  CancelReason,
  MenuItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PickupWindow,
  GridSlot,
} from "./models";

// GET /api/me
export interface MeResponse {
  role: "student" | "staff" | "admin";
  displayName: string;
  userId: string;
}

// GET /api/menu
export interface MenuResponse {
  categories: (Category & { items: MenuItem[] })[];
}

// GET /api/pickup-windows
export interface PickupWindowsResponse {
  windows: PickupWindow[];
}

// POST /api/orders
export interface CreateOrderRequest {
  pickupWindowId: string;
  paymentMethod: PaymentMethod;
  items: { menuItemId: string; quantity: number }[];
  notes?: string;
}

export interface CreateOrderResponse {
  order: Order;
}

export type WechatPayPresentation = "auto" | "qr" | "direct";

export interface GuestDetails {
  name?: string;
  phone: string;
}

export interface CreateGuestOrderRequest extends CreateOrderRequest {
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
  paymentStatus: Order["paymentStatus"];
  status: Order["status"];
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

// GET /api/orders/mine
export interface MyOrdersResponse {
  orders: Order[];
}

// PATCH /api/admin/orders/:id/status
export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  cancelReason?: CancelReason;
  cancelNote?: string;
}

export interface UpdateOrderStatusResponse {
  order: Order;
  warning?: string;
}

// PATCH /api/admin/inventory/:id
export interface UpdateInventoryRequest {
  stockCount?: number;
  isAvailable?: boolean;
  isAdvertised?: boolean;
}

// PUT /api/admin/windows/:id
export interface UpdateWindowRequest {
  madeToOrderCap?: number;
  isActive?: boolean;
}

// GET /api/admin/orders
export interface AdminOrdersResponse {
  orders: Order[];
  counts: Record<OrderStatus, number>;
  businessDate: string;
}

// GET /api/admin/grid
export interface AdminGridResponse {
  slots: (GridSlot & { order?: Order })[];
}

export interface ApiError {
  error: string;
  details?: string;
}

// GET /api/admin/staff
export interface AdminStaffResponse {
  staff: { aadId: string; displayName: string; role: "staff" | "admin" }[];
}

// POST /api/admin/staff
export interface AddStaffRequest {
  aadId: string;
  displayName: string;
  role: "staff" | "admin";
}

// PATCH /api/admin/staff/:aadId
export interface UpdateStaffRequest {
  role: "staff" | "admin";
}

export interface StudentBalanceReportRow {
  studentAadId: string;
  studentName: string;
  totalDueCents: number;
  orderCount: number;
}

export interface StudentSpendingReportRow {
  studentAadId: string;
  studentName: string;
  orderCount: number;
  todaySpendCents: number;
  totalSpendCents: number;
}

export interface BalanceReportResponse {
  balances: StudentBalanceReportRow[];
  totalDueCents: number;
}

export interface SpendingReportResponse {
  spending: StudentSpendingReportRow[];
  totalTodaySpendCents: number;
  totalLifetimeSpendCents: number;
}
