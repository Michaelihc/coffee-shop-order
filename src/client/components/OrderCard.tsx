import React from "react";
import { makeStyles, tokens, mergeClasses } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "./StatusBadge";
import type { CancelReason, Order, OrderStatus } from "../../types/models";

const pulseKeyframes = {
  "0%": { boxShadow: "0 0 0 0 rgba(221,175,107,0.4)" },
  "70%": { boxShadow: "0 0 0 10px rgba(221,175,107,0)" },
  "100%": { boxShadow: "0 0 0 0 rgba(221,175,107,0)" },
};

const useStyles = makeStyles({
  card: {
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  readyCard: {
    border: "3px solid #DDAF6B",
    boxShadow: "0 4px 16px rgba(221,175,107,0.25)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase400,
  },
  stepper: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
  step: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  activeStep: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    border: `1px solid ${tokens.colorBrandBackground}`,
    boxShadow: tokens.shadow2,
  },
  completedStep: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    border: `1px solid ${tokens.colorBrandStroke2}`,
  },
  arrow: {
    color: tokens.colorNeutralForeground3,
    fontSize: "10px",
  },
  items: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  pickupInfo: {
    padding: "16px",
    borderRadius: "10px",
    backgroundColor: "#DDAF6B",
    color: "#3B2218",
    textAlign: "center" as const,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase400,
    animationName: pulseKeyframes,
    animationDuration: "2s",
    animationIterationCount: "infinite",
  },
  pickupCode: {
    display: "block",
    fontSize: "28px",
    fontWeight: tokens.fontWeightBold,
    fontFamily: "monospace",
    letterSpacing: "3px",
    marginTop: "4px",
  },
  pickupSlot: {
    display: "block",
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    marginBottom: "4px",
  },
  meta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  cancelInfo: {
    padding: "12px 14px",
    borderRadius: "10px",
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  cancelTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorPaletteRedForeground2,
  },
  cancelBody: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

const STEPS: OrderStatus[] = ["confirmed", "preparing", "ready", "collected"];

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function getCancelReasonLabel(
  t: (key: string) => string,
  reason: CancelReason | null,
  note?: string | null
) {
  switch (reason) {
    case "out-of-stock":
      return t("cancelReason.outOfStock");
    case "over-capacity":
      return t("cancelReason.overCapacity");
    case "other":
      return note?.trim() || t("cancelReason.other");
    default:
      return t("cancelReason.other");
  }
}

interface OrderCardProps {
  order: Order;
  showStepper?: boolean;
  showStudent?: boolean;
  actions?: React.ReactNode;
}

export function OrderCard({ order, showStepper = true, showStudent = false, actions }: OrderCardProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const currentIdx = STEPS.indexOf(order.status);

  const isReady = order.status === "ready";

  return (
    <div className={mergeClasses(styles.card, isReady ? styles.readyCard : undefined)}>
      <div className={styles.header}>
        <span className={styles.orderId}>{t("order.orderNumber", { id: order.id })}</span>
        <StatusBadge status={order.status} />
      </div>

      {showStudent && (
        <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 }}>
          {t("order.orderedBy")} <strong>{order.studentName}</strong>
        </div>
      )}

      {showStepper && order.status !== "cancelled" && (
        <div className={styles.stepper}>
          {STEPS.map((step, i) => (
            <React.Fragment key={step}>
              {i > 0 && <span className={styles.arrow}>→</span>}
              <span
                className={`${styles.step} ${
                  i === currentIdx
                    ? styles.activeStep
                    : i < currentIdx
                    ? styles.completedStep
                    : ""
                }`}
              >
                {t(`status.${step}`)}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {isReady && order.pickupCode && (
        <div className={styles.pickupInfo}>
          <span className={styles.pickupSlot}>{t("order.slot", { slot: order.gridSlot })}</span>
          {t("order.pickupCode")}
          <span className={styles.pickupCode}>{order.pickupCode}</span>
        </div>
      )}

      {order.items && (
        <div className={styles.items}>
          {order.items.map((item) => (
            <div key={item.id}>
              {item.quantity}x {item.itemName} ({formatPrice(item.priceCents)})
            </div>
          ))}
        </div>
      )}

      <div className={styles.meta}>
        <span>{formatPrice(order.totalCents)}</span>
        <span>{order.paymentMethod === "pay-at-collect" ? t("order.payAtCounter") : t("order.studentCard")}</span>
      </div>

      {order.status === "cancelled" && (
        <div className={styles.cancelInfo}>
          <span className={styles.cancelTitle}>{t("order.cancelledReason")}</span>
          <span className={styles.cancelBody}>
            {getCancelReasonLabel(t, order.cancelReason, order.cancelNote)}
          </span>
        </div>
      )}

      {actions}
    </div>
  );
}
