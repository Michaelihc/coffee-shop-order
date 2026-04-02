import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { app } from "@microsoft/teams-js";
import i18n from "../i18n";
import { getRequestHeaders } from "../api-client";
import type { Order, OrderStatus } from "../../types/models";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type NotificationType =
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "order_cancelled"
  | "window_ending_soon"
  | "new_order"
  | "order_ready_staff"
  | "low_stock"
  | "window_near_capacity"
  | "window_over_capacity";

export interface AppNotification {
  id: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  timestamp: number;
  read: boolean;
}

export interface NotificationPrefs {
  enabled: boolean;
  browserNotifications: boolean;
  types: Record<NotificationType, boolean>;
}

interface AddNotificationOptions {
  sendToTeams?: boolean;
}

const STORAGE_KEY = "coffee-shop-notifications";
const LANGUAGE_STORAGE_KEY = "coffee-shop-lang";

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  browserNotifications: false,
  types: {
    order_confirmed: true,
    order_preparing: true,
    order_ready: true,
    order_cancelled: true,
    window_ending_soon: true,
    new_order: true,
    order_ready_staff: true,
    low_stock: true,
    window_near_capacity: true,
    window_over_capacity: true,
  },
};

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: NotificationPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/* ------------------------------------------------------------------ */
/*  Browser Notification helper                                        */
/* ------------------------------------------------------------------ */

function fireBrowserNotification(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/static/images/logo.png" });
  } catch {
    // Notification API may not be available in Teams iframe
  }
}

/* ------------------------------------------------------------------ */
/*  Teams Activity Feed Notification helper                            */
/* ------------------------------------------------------------------ */

async function sendTeamsNotification(title: string, body: string) {
  try {
    console.log("[Client] Getting Teams context...");
    const context = await app.getContext();
    console.log("[Client] Teams user ID:", context.user?.id);
    console.log("[Client] Sending notification:", { title, body });

    const response = await fetch("/api/notifications/send", {
      method: "POST",
      headers: await getRequestHeaders({
        "X-Teams-User-Locale":
          localStorage.getItem(LANGUAGE_STORAGE_KEY) || i18n.language || "",
      }),
      body: JSON.stringify({ title, body }),
    });

    console.log("[Client] Response status:", response.status);
    const result = await response.json();
    console.log("[Client] Response body:", result);
  } catch (err) {
    console.error("[Client] Failed to send Teams notification:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  prefs: NotificationPrefs;
  updatePrefs: (p: Partial<NotificationPrefs>) => void;
  toggleType: (type: NotificationType, on: boolean) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  addNotification: (
    type: NotificationType,
    titleKey: string,
    bodyKey: string,
    bodyParams?: Record<string, string | number>,
    options?: AddNotificationOptions,
  ) => void;
  /** Compare student order arrays between polls */
  checkStudentOrders: (prev: Order[], next: Order[]) => void;
  /** Compare staff order arrays between polls */
  checkStaffOrders: (prev: Order[], next: Order[]) => void;
  /** Check dashboard stats for staff alerts */
  checkDashboard: (
    prev: DashboardStatsForNotif | null,
    next: DashboardStatsForNotif,
  ) => void;
  requestBrowserPermission: () => void;
}

export interface DashboardStatsForNotif {
  lowStockItems: { name: string; stock: number }[];
  windowStats: { label: string; status: string }[];
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

let nextId = 1;
const MAX_NOTIFICATIONS = 50;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [prefs, setPrefsState] = useState<NotificationPrefs>(loadPrefs);

  // Use a ref to get the latest prefs inside callbacks without re-creating them
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* ---------- preference management ---------- */

  const updatePrefs = useCallback((partial: Partial<NotificationPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...partial };
      savePrefs(next);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: NotificationType, on: boolean) => {
    setPrefsState((prev) => {
      const next = { ...prev, types: { ...prev.types, [type]: on } };
      savePrefs(next);
      return next;
    });
  }, []);

  /* ---------- notification CRUD ---------- */

  const addNotification = useCallback(
    (
      type: NotificationType,
      titleKey: string,
      bodyKey: string,
      bodyParams?: Record<string, string | number>,
      options?: AddNotificationOptions,
    ) => {
      console.log("[Notifications] addNotification called", { type, titleKey, bodyKey, bodyParams });
      const p = prefsRef.current;
      console.log("[Notifications] Preferences:", { enabled: p.enabled, typeEnabled: p.types[type] });

      if (!p.enabled) {
        console.log("[Notifications] Notifications disabled globally");
        return;
      }
      if (!p.types[type]) {
        console.log("[Notifications] Notification type disabled:", type);
        return;
      }

      const notif: AppNotification = {
        id: String(nextId++),
        type,
        titleKey,
        bodyKey,
        bodyParams,
        timestamp: Date.now(),
        read: false,
      };

      console.log("[Notifications] Adding notification to list:", notif);
      setNotifications((prev) => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));

      // Translate and send Teams notification
      const title = i18n.t(titleKey);
      const body = i18n.t(bodyKey, bodyParams);
      console.log("[Notifications] Translated text:", { title, body });
      if (options?.sendToTeams !== false) {
        sendTeamsNotification(title, body);
      }

      // Browser notification
      if (p.browserNotifications) {
        console.log("[Notifications] Firing browser notification");
        fireBrowserNotification(title, body);
      }
    },
    [],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  /* ---------- detection: student orders ---------- */

  const checkStudentOrders = useCallback(
    (prev: Order[], next: Order[]) => {
      console.log("[Notifications] checkStudentOrders called", { prevCount: prev.length, nextCount: next.length });
      const prevMap = new Map(prev.map((o) => [o.id, o.status]));
      for (const order of next) {
        const oldStatus = prevMap.get(order.id);
        console.log("[Notifications] Checking order", { id: order.id, oldStatus, newStatus: order.status });
        if (oldStatus === order.status) continue;

        // New order that wasn't in previous set → confirmed
        if (!oldStatus && order.status === "confirmed") {
          console.log("[Notifications] Triggering order_confirmed for", order.id);
          addNotification(
            "order_confirmed",
            "notifications.orderConfirmed",
            "notifications.orderConfirmedBody",
            { id: order.id },
            { sendToTeams: false },
          );
        }
        // Status changed to preparing
        if (oldStatus && oldStatus !== "preparing" && order.status === "preparing") {
          console.log("[Notifications] Triggering order_preparing for", order.id);
          addNotification(
            "order_preparing",
            "notifications.orderPreparing",
            "notifications.orderPreparingBody",
            { id: order.id },
            { sendToTeams: false },
          );
        }
        // Status changed to ready
        if (oldStatus && oldStatus !== "ready" && order.status === "ready") {
          console.log("[Notifications] Triggering order_ready for", order.id);
          addNotification(
            "order_ready",
            "notifications.orderReady",
            "notifications.orderReadyBody",
            { id: order.id },
            { sendToTeams: false },
          );
        }
        if (oldStatus && oldStatus !== "cancelled" && order.status === "cancelled") {
          console.log("[Notifications] Triggering order_cancelled for", order.id);
          addNotification(
            "order_cancelled",
            "notifications.orderCancelled",
            "notifications.orderCancelledBody",
            {
              id: order.id,
              reason: order.cancelNote?.trim()
                || (order.cancelReason === "out-of-stock"
                  ? i18n.t("cancelReason.outOfStock")
                  : order.cancelReason === "over-capacity"
                  ? i18n.t("cancelReason.overCapacity")
                  : i18n.t("cancelReason.other")),
            },
            { sendToTeams: false },
          );
        }
      }
    },
    [addNotification],
  );

  /* ---------- detection: staff orders ---------- */

  const checkStaffOrders = useCallback(
    (prev: Order[], next: Order[]) => {
      console.log("[Notifications] checkStaffOrders called", { prevCount: prev.length, nextCount: next.length });
      const prevIds = new Set(prev.map((o) => o.id));
      const prevMap = new Map(prev.map((o) => [o.id, o.status]));

      for (const order of next) {
        // Brand new order
        if (!prevIds.has(order.id) && order.status === "confirmed") {
          console.log("[Notifications] Triggering new_order for", order.id);
          addNotification(
            "new_order",
            "notifications.newOrder",
            "notifications.newOrderBody",
            { id: order.id },
          );
        }
        // Order became ready (staff may need to place in grid)
        const oldStatus = prevMap.get(order.id);
        if (oldStatus && oldStatus !== "ready" && order.status === "ready") {
          console.log("[Notifications] Triggering order_ready_staff for", order.id);
          addNotification(
            "order_ready_staff",
            "notifications.orderReady",
            "notifications.orderReadyBody",
            { id: order.id },
          );
        }
      }
    },
    [addNotification],
  );

  /* ---------- detection: dashboard stats ---------- */

  const checkDashboard = useCallback(
    (
      prev: DashboardStatsForNotif | null,
      next: DashboardStatsForNotif,
    ) => {
      if (!prev) return; // first load, skip

      // Low stock
      const prevLow = new Set(prev.lowStockItems.map((i) => i.name));
      for (const item of next.lowStockItems) {
        if (!prevLow.has(item.name)) {
          addNotification(
            "low_stock",
            "notifications.lowStock",
            "notifications.lowStockBody",
            { name: item.name, count: item.stock },
          );
        }
      }

      // Window capacity
      const prevWindowMap = new Map(
        prev.windowStats.map((w) => [w.label, w.status]),
      );
      for (const w of next.windowStats) {
        const oldStatus = prevWindowMap.get(w.label);
        if (
          w.status === "near-capacity" &&
          oldStatus !== "near-capacity" &&
          oldStatus !== "over-capacity"
        ) {
          addNotification(
            "window_near_capacity",
            "notifications.nearCapacity",
            "notifications.nearCapacityBody",
            { label: w.label },
          );
        }
        if (w.status === "over-capacity" && oldStatus !== "over-capacity") {
          addNotification(
            "window_over_capacity",
            "notifications.overCapacity",
            "notifications.overCapacityBody",
            { label: w.label },
          );
        }
      }
    },
    [addNotification],
  );

  /* ---------- browser permission ---------- */

  const requestBrowserPermission = useCallback(() => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        updatePrefs({ browserNotifications: true });
      }
    });
  }, [updatePrefs]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        prefs,
        updatePrefs,
        toggleType,
        markAllRead,
        markRead,
        clearAll,
        addNotification,
        checkStudentOrders,
        checkStaffOrders,
        checkDashboard,
        requestBrowserPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
