import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  RadioGroup,
  Radio,
  Textarea,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api } from "../../api-client";
import { useCart } from "../../hooks/useCart";
import { WindowPicker } from "../../components/WindowPicker";
import type { PickupWindowsResponse, CreateOrderResponse } from "../../../types/api";
import type { PickupWindow, PaymentMethod } from "../../../types/models";

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
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  itemName: {
    flex: 1,
    color: tokens.colorNeutralForeground1,
  },
  qtyControls: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  qtyBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: tokens.fontWeightBold,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  qtyText: {
    minWidth: "24px",
    textAlign: "center" as const,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  qtyTappable: {
    minWidth: "40px",
    padding: "4px 8px",
    borderRadius: "6px",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    textAlign: "center" as const,
    cursor: "pointer",
    border: "none",
    fontSize: tokens.fontSizeBase300,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  itemPrice: {
    minWidth: "60px",
    textAlign: "right" as const,
    color: tokens.colorNeutralForeground1,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  total: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase400,
    padding: "12px 0",
    borderTop: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  empty: {
    textAlign: "center" as const,
    padding: "32px",
    color: tokens.colorNeutralForeground3,
  },
});

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function CartPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, updateQuantity, removeItem, clearCart, totalCents, itemCount } =
    useCart();
  const [windows, setWindows] = useState<PickupWindow[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("student-card");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingWindows, setLoadingWindows] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PickupWindowsResponse>("/api/pickup-windows")
      .then((data) => setWindows(data.windows))
      .finally(() => setLoadingWindows(false));
  }, []);

  if (itemCount === 0) {
    return (
      <div className={styles.empty}>
        {t("cart.empty")}{" "}
        <Button appearance="primary" onClick={() => navigate("/")}>
          {t("cart.browseMenu")}
        </Button>
      </div>
    );
  }

  async function handlePlaceOrder() {
    if (!selectedWindow) {
      setError(t("cart.selectWindow"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post<CreateOrderResponse>("/api/orders", {
        pickupWindowId: selectedWindow,
        paymentMethod,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
        notes: notes || undefined,
      });
      clearCart();
      navigate("/orders");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("cart.failedToPlace"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("cart.title")}</h2>

      {items.map((item) => (
        <div key={item.menuItemId} className={styles.itemRow}>
          <span className={styles.itemName}>{item.name}</span>
          {editingItemId === item.menuItemId ? (
            <div className={styles.qtyControls}>
              <button
                className={styles.qtyBtn}
                onClick={() => {
                  if (item.quantity <= 1) {
                    removeItem(item.menuItemId);
                    setEditingItemId(null);
                  } else {
                    updateQuantity(item.menuItemId, item.quantity - 1);
                  }
                }}
              >
                -
              </button>
              <span className={styles.qtyText}>{item.quantity}</span>
              <button
                className={styles.qtyBtn}
                onClick={() =>
                  updateQuantity(item.menuItemId, item.quantity + 1)
                }
              >
                +
              </button>
            </div>
          ) : (
            <button
              className={styles.qtyTappable}
              onClick={() => setEditingItemId(item.menuItemId)}
            >
              ×{item.quantity}
            </button>
          )}
          <span className={styles.itemPrice}>
            {formatPrice(item.priceCents * item.quantity)}
          </span>
        </div>
      ))}

      <div className={styles.total}>
        <span>{t("cart.total", { count: itemCount })}</span>
        <span>{formatPrice(totalCents)}</span>
      </div>

      {loadingWindows ? (
        <Spinner size="small" label={t("cart.loadingWindows")} />
      ) : (
        <WindowPicker
          windows={windows}
          selected={selectedWindow}
          onSelect={setSelectedWindow}
        />
      )}

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t("cart.paymentMethod")}</div>
        <RadioGroup
          value={paymentMethod}
          onChange={(_, data) =>
            setPaymentMethod(data.value as PaymentMethod)
          }
        >
          <Radio value="student-card" label={t("cart.studentCard")} />
          <Radio value="pay-at-collect" label={t("cart.payAtCounter")} />
        </RadioGroup>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t("cart.notes")}</div>
        <Textarea
          value={notes}
          onChange={(_, data) => setNotes(data.value)}
          placeholder={t("cart.notesPlaceholder")}
          resize="vertical"
        />
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <Button
        appearance="primary"
        size="large"
        onClick={handlePlaceOrder}
        disabled={submitting || !selectedWindow}
        style={{ width: "100%" }}
      >
        {submitting ? t("cart.placingOrder") : t("cart.placeOrder")}
      </Button>
    </div>
  );
}
