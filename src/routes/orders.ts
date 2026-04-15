import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthenticated } from "../middleware/authorization";
import {
  createOrder,
  updateOrderStatus,
} from "../services/order-service";
import { getStudentOrders, getOrderById } from "../services/order-repository";
import {
  getStaffNewOrderNotification,
  getStudentOrderCreatedNotification,
} from "../services/notification-content-service";
import { listStaffMembers } from "../services/admin-staff-service";
import { sendTeamsNotification } from "../services/teams-notification-service";
import type { Order } from "../types/models";

const router = Router();
router.use(requireAuthenticated);
const STUDENT_ORDERS_PATH = "/orders";

function notifyStudentOrderUpdate(
  userId: string,
  title: string,
  body: string,
) {
  void sendTeamsNotification({
    userId,
    title,
    body,
    targetPath: STUDENT_ORDERS_PATH,
  }).catch((error) => {
    console.error("[Orders] Failed to send student Teams notification:", error);
  });
}

function notifyStaffOrderCreated(order: Order) {
  for (const staffMember of listStaffMembers()) {
    const notification = getStaffNewOrderNotification(staffMember.aadId, order);

    void sendTeamsNotification({
      userId: staffMember.aadId,
      title: notification.title,
      body: notification.body,
    }).catch((error) => {
      console.error("[Orders] Failed to send staff Teams notification:", error);
    });
  }
}

// POST /api/orders — place a new order
router.post("/", async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const result = await createOrder(user.userId, user.userName, req.body);
    if (!result.ok) {
      res.status(400).json({ error: (result as { ok: false; error: string }).error });
      return;
    }

    res.status(201).json({ order: result.order });
    const notification = getStudentOrderCreatedNotification(
      result.order.studentAadId,
      result.order.id,
    );
    notifyStudentOrderUpdate(result.order.studentAadId, notification.title, notification.body);
    notifyStaffOrderCreated(result.order);
  } catch (error) {
    console.error("[Orders] Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// GET /api/orders/mine — today's orders (or all with ?history=true)
router.get("/mine", (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const allTime = req.query.history === "true";
  const orders = getStudentOrders(user.userId, { allTime });
  res.json({ orders });
});

// GET /api/orders/mine/:orderId — single order detail
router.get("/mine/:orderId", (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const order = getOrderById(req.params.orderId as string);
  if (!order || order.studentAadId !== user.userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({ order });
});

// POST /api/orders/mine/:orderId/collect — student confirms pickup
router.post("/mine/:orderId/collect", async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const order = getOrderById(req.params.orderId as string);
  if (!order || order.studentAadId !== user.userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status !== "ready") {
    res.status(400).json({ error: "Order is not ready for collection" });
    return;
  }

  const result = await updateOrderStatus(req.params.orderId as string, "collected");
  if (result.ok === false) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ order: result.order });
});

export default router;
