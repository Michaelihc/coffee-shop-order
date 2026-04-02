import type { CancelReason, Order, OrderStatus } from "../types/models";
import { getUserLocale, type SupportedLocale } from "./user-locale-service";

const studentNotificationCopy: Record<
  SupportedLocale,
  {
    orderConfirmedTitle: string;
    orderConfirmedBody: string;
    orderPreparingTitle: string;
    orderPreparingBody: string;
    orderReadyTitle: string;
    orderReadyBody: string;
    orderCancelledTitle: string;
    orderCancelledBody: string;
    cancelReasonOutOfStock: string;
    cancelReasonOverCapacity: string;
    cancelReasonOther: string;
  }
> = {
  en: {
    orderConfirmedTitle: "Order Confirmed",
    orderConfirmedBody: "Order #{{id}} has been confirmed",
    orderPreparingTitle: "Order Being Prepared",
    orderPreparingBody: "Order #{{id}} is being prepared",
    orderReadyTitle: "Order Ready",
    orderReadyBody: "Order #{{id}} is ready for pickup",
    orderCancelledTitle: "Order Cancelled",
    orderCancelledBody: "Order #{{id}} was cancelled: {{reason}}",
    cancelReasonOutOfStock: "Out of stock",
    cancelReasonOverCapacity: "Over capacity",
    cancelReasonOther: "Other",
  },
  zh: {
    orderConfirmedTitle: "订单已确认",
    orderConfirmedBody: "订单 #{{id}} 已确认",
    orderPreparingTitle: "订单制作中",
    orderPreparingBody: "订单 #{{id}} 正在制作",
    orderReadyTitle: "订单可取餐",
    orderReadyBody: "订单 #{{id}} 可以取餐了",
    orderCancelledTitle: "订单已取消",
    orderCancelledBody: "订单 #{{id}} 已取消：{{reason}}",
    cancelReasonOutOfStock: "缺货",
    cancelReasonOverCapacity: "超出容量",
    cancelReasonOther: "其他",
  },
  ko: {
    orderConfirmedTitle: "주문 확인됨",
    orderConfirmedBody: "주문 #{{id}}이(가) 확인되었습니다",
    orderPreparingTitle: "주문 준비 중",
    orderPreparingBody: "주문 #{{id}} 준비 중입니다",
    orderReadyTitle: "주문 픽업 가능",
    orderReadyBody: "주문 #{{id}} 픽업 가능합니다",
    orderCancelledTitle: "주문 취소됨",
    orderCancelledBody: "주문 #{{id}}이(가) 취소되었습니다: {{reason}}",
    cancelReasonOutOfStock: "재고 부족",
    cancelReasonOverCapacity: "용량 초과",
    cancelReasonOther: "기타",
  },
};

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function getStudentOrderCreatedNotification(userId: string, orderId: string) {
  const copy = studentNotificationCopy[getUserLocale(userId)];

  return {
    title: copy.orderConfirmedTitle,
    body: interpolate(copy.orderConfirmedBody, { id: orderId }),
  };
}

export function getStudentOrderStatusNotification(
  order: Order,
) {
  const copy = studentNotificationCopy[getUserLocale(order.studentAadId)];

  switch (order.status) {
    case "preparing":
      return {
        title: copy.orderPreparingTitle,
        body: interpolate(copy.orderPreparingBody, { id: order.id }),
      };
    case "ready":
      return {
        title: copy.orderReadyTitle,
        body: interpolate(copy.orderReadyBody, { id: order.id }),
      };
    case "cancelled": {
      const reason = getLocalizedCancelReason(copy, order.cancelReason, order.cancelNote);
      return {
        title: copy.orderCancelledTitle,
        body: interpolate(copy.orderCancelledBody, { id: order.id, reason }),
      };
    }
    default:
      return null;
  }
}

function getLocalizedCancelReason(
  copy: (typeof studentNotificationCopy)[SupportedLocale],
  reason: CancelReason | null,
  note?: string | null
) {
  switch (reason) {
    case "out-of-stock":
      return copy.cancelReasonOutOfStock;
    case "over-capacity":
      return copy.cancelReasonOverCapacity;
    case "other":
      return note?.trim() || copy.cancelReasonOther;
    default:
      return copy.cancelReasonOther;
  }
}
