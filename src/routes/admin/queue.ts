import { Router } from "express";
import type { Request, Response } from "express";
import { requireStaff } from "../../middleware/authorization";
import {
  updateOrderStatus,
} from "../../services/order-service";
import { getAdminOrders, getOrderCounts } from "../../services/order-repository";
import type { Order, OrderStatus } from "../../types/models";
import { getStudentOrderStatusNotification } from "../../services/notification-content-service";
import { sendTeamsNotification } from "../../services/teams-notification-service";

const router = Router();

function notifyStudentOrderUpdate(
  order: Order,
) {
  const content = getStudentOrderStatusNotification(order);
  if (!content) {
    return;
  }

  void sendTeamsNotification({
    userId: order.studentAadId,
    title: content.title,
    body: content.body,
  }).catch((error) => {
    console.error("[Queue] Failed to send student Teams notification:", error);
  });
}

router.use(requireStaff);

// GET /api/admin/orders
router.get("/", (req: Request, res: Response) => {
  const targetDate = req.query.date as string | undefined;
  const orders = getAdminOrders({
    status: req.query.status as string | undefined,
    windowId: req.query.windowId as string | undefined,
    date: targetDate,
  });
  const counts = getOrderCounts(targetDate);
  res.json({ orders, counts });
});

// PATCH /api/admin/orders/:id/status
router.patch("/:id/status", (req: Request, res: Response) => {
  const { status, cancelReason, cancelNote } = req.body as {
    status: OrderStatus;
    cancelReason?: string;
    cancelNote?: string;
  };
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }

  const result = updateOrderStatus(req.params.id as string, status, {
    cancelReason,
    cancelNote,
  });
  if (!result.ok) {
    res.status(400).json({ error: (result as { ok: false; error: string }).error });
    return;
  }

  const order = (result as { ok: true; order: Order }).order;
  res.json({ order });
  notifyStudentOrderUpdate(order);
});

export default router;
