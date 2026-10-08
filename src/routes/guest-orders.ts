import { Router } from "express";
import type { Request, Response } from "express";
import { createGuestOrder } from "../services/order-service";
import { getOrderById } from "../services/order-repository";
import { resolveGuestSession } from "../services/guest-auth-service";
import type { CreateGuestOrderRequest } from "../types/api";

const router = Router();

function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim();
  }
  return req.socket.remoteAddress || undefined;
}

router.post("/", async (req: Request, res: Response) => {
  const body = req.body as CreateGuestOrderRequest;
  const guestSessionHeader = req.headers["x-guest-session"];
  const guest = resolveGuestSession(
    typeof guestSessionHeader === "string" ? guestSessionHeader : undefined
  );

  if (!guest) {
    res.status(401).json({ error: "Verify your phone number before placing an order." });
    return;
  }

  const result = await createGuestOrder(body, {
    verifiedPhone: guest.phone,
    wechatPayPresentation: body.wechatPayPresentation ?? "auto",
    clientIp: getClientIp(req),
    openid: typeof req.headers["x-wechat-openid"] === "string"
      ? req.headers["x-wechat-openid"]
      : undefined,
  });

  if (result.ok === false) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json(result.payment ? { order: result.order, payment: result.payment } : { order: result.order });
});

router.get("/:id/status", (req: Request, res: Response) => {
  const order = getOrderById(req.params.id as string);
  if (!order || order.customerType !== "guest") {
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
