import { Router } from "express";
import type { Request, Response } from "express";
import { toSqlTimestamp } from "../services/business-time-service";
import {
  getOrderById,
  markOrderPaymentSettled,
} from "../services/order-repository";
import { recordPaymentReconciliationIncident } from "../services/payment-reconciliation-service";

const router = Router();

interface WechatNotifyBody {
  orderId?: string;
  out_trade_no?: string;
  transactionRef?: string;
  transaction_id?: string;
  amountCents?: number;
  tradeState?: string;
  trade_state?: string;
}

router.post("/wechat/notify", (req: Request, res: Response) => {
  const body = req.body as WechatNotifyBody;
  const orderId = body.orderId || body.out_trade_no;
  const transactionRef = body.transactionRef || body.transaction_id || "";
  const tradeState = body.tradeState || body.trade_state || "SUCCESS";

  if (!orderId || !transactionRef) {
    res.status(400).json({ error: "Invalid WeChat Pay notification" });
    return;
  }

  const order = getOrderById(orderId);
  if (!order) {
    recordPaymentReconciliationIncident({
      orderId,
      transactionRef,
      amountCents: body.amountCents ?? 0,
      incidentType: "wechat_notify_unknown_order",
      details: JSON.stringify(body),
    });
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (body.amountCents !== undefined && body.amountCents !== order.totalCents) {
    recordPaymentReconciliationIncident({
      orderId,
      transactionRef,
      amountCents: body.amountCents,
      incidentType: "wechat_notify_amount_mismatch",
      details: `expected=${order.totalCents}; actual=${body.amountCents}`,
    });
    res.status(400).json({ error: "Payment amount mismatch" });
    return;
  }

  if (tradeState !== "SUCCESS") {
    recordPaymentReconciliationIncident({
      orderId,
      transactionRef,
      amountCents: order.totalCents,
      incidentType: "wechat_notify_non_success",
      details: `tradeState=${tradeState}`,
    });
    res.json({ ok: true });
    return;
  }

  markOrderPaymentSettled(orderId, transactionRef, toSqlTimestamp());
  res.json({ ok: true });
});

router.get("/wechat/orders/:id/status", (req: Request, res: Response) => {
  const order = getOrderById(req.params.id as string);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({
    orderId: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
  });
});

export default router;
