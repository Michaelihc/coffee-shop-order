import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  Button,
  Dropdown,
  Option,
  Badge,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
  Textarea,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api } from "../../api-client";
import { OrderCard } from "../../components/OrderCard";
import { usePoller } from "../../hooks/usePoller";
import { useNotifications } from "../../hooks/useNotifications";
import type { AdminOrdersResponse } from "../../../types/api";
import type { CancelReason, Order, OrderStatus } from "../../../types/models";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  filters: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  summary: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    padding: "8px 0",
  },
  orderList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "8px",
  },
  payAtCollect: {
    padding: "4px 8px",
    borderRadius: "4px",
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorPaletteYellowForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  dialogFields: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  fieldLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  reasonHelp: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

const STATUS_OPTIONS = ["all", "confirmed", "preparing", "ready", "collected", "cancelled"];

const ACTION_COLORS: Record<string, string> = {
  preparing: "#D98B2B",
  ready: "#3A9A3A",
  collected: "#7B8794",
};
const CANCEL_REASON_OPTIONS: CancelReason[] = ["out-of-stock", "over-capacity", "other"];

function DelayedActionButton({
  label,
  targetStatus,
  onClick,
}: {
  label: string;
  targetStatus: string;
  onClick: () => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const { t } = useTranslation();

  async function handleClick() {
    setState("loading");
    await new Promise((r) => setTimeout(r, 1200));
    await onClick();
    setState("done");
    setTimeout(() => setState("idle"), 800);
  }

  const bg = ACTION_COLORS[targetStatus] || undefined;

  if (state === "loading") {
    return (
      <Button
        appearance="primary"
        size="small"
        disabled
        style={{ backgroundColor: bg, minWidth: "120px" }}
      >
        <Spinner size="extra-tiny" style={{ marginRight: "6px" }} />
        {label}...
      </Button>
    );
  }

  if (state === "done") {
    return (
      <Button
        appearance="primary"
        size="small"
        disabled
        style={{ backgroundColor: bg, minWidth: "120px" }}
      >
        {t("common.done")}
      </Button>
    );
  }

  return (
    <Button
      appearance="primary"
      size="small"
      onClick={handleClick}
      style={bg ? { backgroundColor: bg, color: "#fff" } : undefined}
    >
      {label}
    </Button>
  );
}

export function QueuePage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { checkStaffOrders } = useNotifications();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<OrderStatus, number>>({
    confirmed: 0,
    preparing: 0,
    ready: 0,
    collected: 0,
    cancelled: 0,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>("out-of-stock");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const prevOrdersRef = useRef<Order[]>([]);

  const fetchOrders = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const params = dateFilter !== today ? `?date=${dateFilter}` : "";
    api
      .get<AdminOrdersResponse>(`/api/admin/orders${params}`)
      .then((data) => {
        checkStaffOrders(prevOrdersRef.current, data.orders);
        prevOrdersRef.current = data.orders;
        setAllOrders(data.orders);
        setCounts(data.counts);
      })
      .finally(() => setLoading(false));
  }, [dateFilter, checkStaffOrders]);

  usePoller(fetchOrders, 5000);

  const orders = useMemo(
    () =>
      statusFilter === "all"
        ? allOrders
        : allOrders.filter((o) => o.status === statusFilter),
    [allOrders, statusFilter]
  );

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setError(null);
    try {
      await api.patch(`/api/admin/orders/${orderId}/status`, {
        status: newStatus,
      });
      fetchOrders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("queue.failedToUpdate"));
    }
  }

  function openCancelDialog(order: Order) {
    setCancelDialogOrder(order);
    setCancelReason("out-of-stock");
    setCancelNote("");
  }

  function closeCancelDialog() {
    if (cancelling) {
      return;
    }
    setCancelDialogOrder(null);
    setCancelReason("out-of-stock");
    setCancelNote("");
  }

  async function handleConfirmCancel() {
    if (!cancelDialogOrder) {
      return;
    }
    setError(null);
    setCancelling(true);
    try {
      await api.patch(`/api/admin/orders/${cancelDialogOrder.id}/status`, {
        status: "cancelled",
        cancelReason,
        cancelNote: cancelNote.trim() || undefined,
      });
      closeCancelDialog();
      fetchOrders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("queue.failedToUpdate"));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Spinner label={t("queue.loading")} />;

  return (
    <div className={styles.container}>
      <div className={styles.summary}>
        <Badge appearance="outline" color="informative">
          {t("queue.confirmed", { count: counts.confirmed })}
        </Badge>
        <Badge appearance="outline" color="warning">
          {t("queue.preparing", { count: counts.preparing })}
        </Badge>
        <Badge appearance="outline" color="success">
          {t("queue.ready", { count: counts.ready })}
        </Badge>
        <Badge appearance="outline" color="subtle">
          {t("queue.collected", { count: counts.collected })}
        </Badge>
      </div>

      <div className={styles.filters}>
        <Dropdown
          value={statusFilter}
          onOptionSelect={(_, data) =>
            setStatusFilter(data.optionValue || "all")
          }
          placeholder={t("queue.filterByStatus")}
        >
          {STATUS_OPTIONS.map((s) => (
            <Option key={s} value={s}>
              {t(`status.${s}`)}
            </Option>
          ))}
        </Dropdown>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{
            padding: "4px 8px",
            borderRadius: "4px",
            border: `1px solid ${tokens.colorNeutralStroke1}`,
            backgroundColor: tokens.colorNeutralBackground1,
            color: tokens.colorNeutralForeground1,
          }}
        />
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.orderList}>
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            showStepper={false}
            showStudent
            actions={
              <div className={styles.actions}>
                {order.paymentMethod === "pay-at-collect" && (
                  <span className={styles.payAtCollect}>{t("order.payAtCounter")}</span>
                )}
                {order.status === "confirmed" && (
                  <DelayedActionButton
                    label={t("queue.startPreparing")}
                    targetStatus="preparing"
                    onClick={() => handleStatusChange(order.id, "preparing")}
                  />
                )}
                {order.status === "preparing" && (
                  <DelayedActionButton
                    label={t("queue.markReady")}
                    targetStatus="ready"
                    onClick={() => handleStatusChange(order.id, "ready")}
                  />
                )}
                {order.status === "ready" && (
                  <DelayedActionButton
                    label={t("queue.markCollected")}
                    targetStatus="collected"
                    onClick={() => handleStatusChange(order.id, "collected")}
                  />
                )}
                {(order.status === "confirmed" ||
                  order.status === "preparing" ||
                  order.status === "ready") && (
                  <Button
                    appearance="subtle"
                    size="small"
                    style={{ color: "#c43e1c" }}
                    onClick={() => openCancelDialog(order)}
                  >
                    {t("common.cancel")}
                  </Button>
                )}
              </div>
            }
          />
        ))}
        {orders.length === 0 && (
          <div style={{ textAlign: "center", padding: 32, color: tokens.colorNeutralForeground3 }}>
            {t("queue.noOrders")}
          </div>
        )}
      </div>

      <Dialog
        open={cancelDialogOrder !== null}
        onOpenChange={(_, data) => {
          if (!data.open) {
            closeCancelDialog();
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("queue.cancelTitle")}</DialogTitle>
            <DialogContent>
              <div className={styles.dialogFields}>
                <span className={styles.reasonHelp}>
                  {cancelDialogOrder
                    ? t("queue.cancelPrompt", { id: cancelDialogOrder.id })
                    : t("queue.cancelOrder")}
                </span>
                <div className={styles.dialogFields}>
                  <span className={styles.fieldLabel}>{t("queue.cancelReasonLabel")}</span>
                  <RadioGroup
                    value={cancelReason}
                    onChange={(_, data) => setCancelReason(data.value as CancelReason)}
                  >
                    {CANCEL_REASON_OPTIONS.map((reason) => (
                      <Radio
                        key={reason}
                        value={reason}
                        label={t(`cancelReason.${reason === "out-of-stock" ? "outOfStock" : reason === "over-capacity" ? "overCapacity" : "other"}`)}
                      />
                    ))}
                  </RadioGroup>
                </div>
                <div className={styles.dialogFields}>
                  <span className={styles.fieldLabel}>{t("queue.cancelNoteLabel")}</span>
                  <Textarea
                    value={cancelNote}
                    onChange={(_, data) => setCancelNote(data.value)}
                    placeholder={t("queue.cancelNotePlaceholder")}
                    resize="vertical"
                  />
                  {cancelReason === "other" && (
                    <span className={styles.reasonHelp}>{t("queue.cancelNoteRequired")}</span>
                  )}
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={closeCancelDialog} disabled={cancelling}>
                {t("common.cancel")}
              </Button>
              <Button
                appearance="primary"
                onClick={handleConfirmCancel}
                disabled={cancelling || (cancelReason === "other" && !cancelNote.trim())}
              >
                {cancelling ? t("common.saving") : t("queue.confirmCancel")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
