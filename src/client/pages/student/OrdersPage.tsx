import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api } from "../../api-client";
import { OrderCard } from "../../components/OrderCard";
import { usePoller } from "../../hooks/usePoller";
import { useCart } from "../../hooks/useCart";
import { useNotifications } from "../../hooks/useNotifications";
import { seedOrNotify } from "../../notification-polling";
import type { MyOrdersResponse } from "../../../types/api";
import type { Order } from "../../../types/models";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    margin: 0,
  },
  subheading: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    margin: "16px 0 8px",
    color: tokens.colorNeutralForeground2,
  },
  empty: {
    textAlign: "center" as const,
    padding: "32px",
    color: tokens.colorNeutralForeground3,
  },
});

export function OrdersPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { checkStudentOrders } = useNotifications();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const prevOrdersRef = useRef<Order[]>([]);
  const hasSeededNotificationsRef = useRef(false);

  useEffect(() => {
    prevOrdersRef.current = [];
    hasSeededNotificationsRef.current = false;
  }, [showHistory]);

  const fetchOrders = useCallback(() => {
    const params = showHistory ? "?history=true" : "";
    api
      .get<MyOrdersResponse>(`/api/orders/mine${params}`)
      .then((data) => {
        const nextState = seedOrNotify(
          {
            hasSeeded: hasSeededNotificationsRef.current,
            previous: prevOrdersRef.current,
          },
          data.orders,
          checkStudentOrders
        );
        hasSeededNotificationsRef.current = nextState.hasSeeded;
        prevOrdersRef.current = nextState.previous;
        setOrders(data.orders);
      })
      .finally(() => setLoading(false));
  }, [showHistory, checkStudentOrders]);

  usePoller(fetchOrders, 8000);

  if (loading) return <Spinner label={t("orders.loading")} />;

  const active = orders.filter(
    (o) => o.status !== "collected" && o.status !== "cancelled"
  );
  const past = orders.filter(
    (o) => o.status === "collected" || o.status === "cancelled"
  );

  function handleReorder(order: Order) {
    if (order.items) {
      for (const item of order.items) {
        addItem({
          menuItemId: item.menuItemId,
          name: item.itemName,
          priceCents: item.priceCents,
          itemClass: item.itemClass,
        });
      }
    }
    navigate("/cart");
  }

  if (orders.length === 0) {
    return (
      <div className={styles.empty}>
        {t("orders.noOrders")}{" "}
        <Button appearance="primary" onClick={() => navigate("/")}>
          {t("orders.browseMenu")}
        </Button>
      </div>
    );
  }

  async function handleConfirmPickup(orderId: string) {
    try {
      await api.post(`/api/orders/mine/${orderId}/collect`, {});
      fetchOrders();
    } catch {
      // silently fail — order will refresh on next poll
    }
  }

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className={styles.heading}>
          {showHistory ? t("orders.history") : t("orders.activeOrders")}
        </h2>
        <Button
          appearance="subtle"
          size="small"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? t("orders.todayOnly") : t("orders.viewHistory")}
        </Button>
      </div>

      {active.length > 0 && (
        <>
          {active.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showStepper={true}
              actions={
                order.status === "ready" ? (
                  <Button
                    appearance="primary"
                    size="large"
                    onClick={() => handleConfirmPickup(order.id)}
                    style={{
                      width: "100%",
                      backgroundColor: "#DDAF6B",
                      color: "#3B2218",
                      fontWeight: 700,
                      fontSize: "16px",
                    }}
                  >
                    {t("orders.confirmPickup")}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 className={styles.subheading}>{t("orders.earlierToday")}</h3>
          {past.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showStepper={false}
              actions={
                order.status === "collected" ? (
                  <Button
                    appearance="subtle"
                    size="small"
                    onClick={() => handleReorder(order)}
                  >
                    {t("orders.reorder")}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
