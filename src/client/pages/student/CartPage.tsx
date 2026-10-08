import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  RadioGroup,
  Radio,
  Textarea,
  Input,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { api, setGuestSessionToken } from "../../api-client";
import { useCart } from "../../hooks/useCart";
import { useRole } from "../../hooks/useRole";
import { WindowPicker } from "../../components/WindowPicker";
import type {
  PickupWindowsResponse,
  CreateOrderResponse,
  CreateGuestOrderResponse,
  GuestAuthConfigResponse,
  GuestAuthMeResponse,
  SendGuestCodeResponse,
  VerifyGuestCodeResponse,
  WechatPaymentInstructions,
  WechatPayPresentation,
} from "../../../types/api";
import type { PickupWindow, PaymentMethod } from "../../../types/models";

const STUDENT_PAYMENT_METHODS = new Set<PaymentMethod>([
  "student-card",
  "pay-at-collect",
]);
const GUEST_PAYMENT_METHODS = new Set<PaymentMethod>([
  "cash-at-counter",
  "wechat-pay",
]);

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          theme: "auto";
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

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
  qrPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: "8px",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  fieldGrid: {
    display: "grid",
    gap: "8px",
  },
  inlineFields: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
    alignItems: "center",
  },
  authPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: "8px",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  helperText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
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
  const { userId } = useRole();
  const { items, updateQuantity, removeItem, clearCart, totalCents, itemCount } =
    useCart();
  const isGuest = !userId;
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const [windows, setWindows] = useState<PickupWindow[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("student-card");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestMaskedPhone, setGuestMaskedPhone] = useState("");
  const [guestAuthenticated, setGuestAuthenticated] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [wechatPayPresentation, setWechatPayPresentation] =
    useState<WechatPayPresentation>("auto");
  const [wechatPayment, setWechatPayment] =
    useState<WechatPaymentInstructions | null>(null);
  const [pendingWechatOrderId, setPendingWechatOrderId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!isGuest) {
      return;
    }

    Promise.all([
      api.get<GuestAuthConfigResponse>("/api/guest/auth/config"),
      api.get<GuestAuthMeResponse>("/api/guest/auth/me"),
    ])
      .then(([config, me]) => {
        setTurnstileSiteKey(config.turnstileSiteKey);
        if (me.authenticated && me.phone && me.maskedPhone) {
          setGuestPhone(me.phone);
          setGuestMaskedPhone(me.maskedPhone);
          setGuestAuthenticated(true);
        }
      })
      .catch(() => undefined);
  }, [isGuest]);

  useEffect(() => {
    if (!isGuest || guestAuthenticated || !turnstileSiteKey || !turnstileRef.current) {
      return;
    }

    const renderTurnstile = () => {
      if (!window.turnstile || !turnstileRef.current || turnstileWidgetRef.current) {
        return;
      }
      turnstileWidgetRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: setTurnstileToken,
        "expired-callback": () => setTurnstileToken(""),
        theme: "auto",
      });
    };

    if (window.turnstile) {
      renderTurnstile();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = renderTurnstile;
      document.head.appendChild(script);
    }

    return () => {
      if (window.turnstile && turnstileWidgetRef.current) {
        window.turnstile.remove(turnstileWidgetRef.current);
      }
      turnstileWidgetRef.current = null;
    };
  }, [guestAuthenticated, isGuest, turnstileSiteKey]);

  useEffect(() => {
    if (isGuest && !GUEST_PAYMENT_METHODS.has(paymentMethod)) {
      setPaymentMethod("cash-at-counter");
    }
    if (!isGuest && !STUDENT_PAYMENT_METHODS.has(paymentMethod)) {
      setPaymentMethod("student-card");
    }
  }, [isGuest, paymentMethod]);

  useEffect(() => {
    if (!pendingWechatOrderId) {
      return;
    }

    const timer = window.setInterval(() => {
      api
        .get<{ paymentStatus: string }>(
          `/api/payments/wechat/orders/${pendingWechatOrderId}/status`
        )
        .then((status) => {
          if (status.paymentStatus === "paid") {
            setWechatPayment(null);
            setPendingWechatOrderId(null);
            navigate("/orders");
          }
        })
        .catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [navigate, pendingWechatOrderId]);

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
    if (isGuest && !guestAuthenticated) {
      setError(t("cart.guestVerifyRequired"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        pickupWindowId: selectedWindow,
        paymentMethod,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
        notes: notes || undefined,
      };

      if (isGuest) {
        const response = await api.post<CreateGuestOrderResponse>("/api/guest/orders", {
          ...payload,
          guest: { phone: guestPhone },
          wechatPayPresentation,
        });

        if (response.payment?.kind === "h5") {
          clearCart();
          window.location.assign(response.payment.h5Url);
          return;
        }
        if (response.payment?.kind === "qr") {
          clearCart();
          setWechatPayment(response.payment);
          setPendingWechatOrderId(response.order.id);
          return;
        }
        if (response.payment?.kind === "jsapi") {
          clearCart();
          setWechatPayment(response.payment);
          setPendingWechatOrderId(response.order.id);
          return;
        }
      } else {
        await api.post<CreateOrderResponse>("/api/orders", payload);
      }
      clearCart();
      navigate("/orders");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("cart.failedToPlace"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendCode() {
    if (!guestPhone.trim()) {
      setError(t("cart.guestPhoneRequired"));
      return;
    }
    if (!turnstileToken) {
      setError(t("cart.humanVerificationRequired"));
      return;
    }

    setSendingCode(true);
    setError(null);
    try {
      const response = await api.post<SendGuestCodeResponse>("/api/guest/auth/send-code", {
        phone: guestPhone,
        turnstileToken,
      });
      setGuestMaskedPhone(response.maskedPhone);
      setSmsSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("cart.failedToSendCode"));
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    setVerifyingCode(true);
    setError(null);
    try {
      const response = await api.post<VerifyGuestCodeResponse>("/api/guest/auth/verify-code", {
        phone: guestPhone,
        code: smsCode,
      });
      setGuestSessionToken(response.token);
      setGuestMaskedPhone(response.maskedPhone);
      setGuestAuthenticated(true);
      window.dispatchEvent(new Event("coffee-shop-guest-auth-changed"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("cart.failedToVerifyCode"));
    } finally {
      setVerifyingCode(false);
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("cart.title")}</h2>

      {wechatPayment?.kind === "qr" && (
        <div className={styles.qrPanel}>
          <strong>{t("cart.scanWechatQr")}</strong>
          <QRCodeSVG value={wechatPayment.codeUrl} size={180} />
          <span>{t("cart.waitingForWechatPay")}</span>
        </div>
      )}

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
        {isGuest && (
          <div className={styles.authPanel}>
            <strong>
              {guestAuthenticated
                ? t("cart.verifiedPhone", { phone: guestMaskedPhone })
                : t("cart.verifyPhoneTitle")}
            </strong>
            {!guestAuthenticated && (
              <>
                <span className={styles.helperText}>{t("cart.verifyPhoneDescription")}</span>
                <div className={styles.inlineFields}>
                  <Input
                    value={guestPhone}
                    onChange={(_, data) => setGuestPhone(data.value)}
                    placeholder={t("cart.guestPhone")}
                  />
                  <Button onClick={handleSendCode} disabled={sendingCode || !turnstileSiteKey}>
                    {sendingCode ? t("cart.sendingCode") : t("cart.sendCode")}
                  </Button>
                </div>
                <div ref={turnstileRef} />
                {!turnstileSiteKey && (
                  <span className={styles.helperText}>{t("cart.turnstileNotConfigured")}</span>
                )}
                {smsSent && (
                  <div className={styles.inlineFields}>
                    <Input
                      value={smsCode}
                      onChange={(_, data) => setSmsCode(data.value)}
                      placeholder={t("cart.smsCode")}
                    />
                    <Button onClick={handleVerifyCode} disabled={verifyingCode}>
                      {verifyingCode ? t("cart.verifyingCode") : t("cart.verifyCode")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <RadioGroup
          value={paymentMethod}
          onChange={(_, data) =>
            setPaymentMethod(data.value as PaymentMethod)
          }
        >
          {isGuest ? (
            <>
              <Radio value="cash-at-counter" label={t("cart.cashAtCounter")} />
              <Radio value="wechat-pay" label={t("cart.wechatPay")} />
            </>
          ) : (
            <>
              <Radio value="student-card" label={t("cart.studentCard")} />
              <Radio value="pay-at-collect" label={t("cart.payAtCounter")} />
            </>
          )}
        </RadioGroup>
      </div>

      {isGuest && paymentMethod === "wechat-pay" && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t("cart.wechatPayMode")}</div>
          <RadioGroup
            value={wechatPayPresentation}
            onChange={(_, data) =>
              setWechatPayPresentation(data.value as WechatPayPresentation)
            }
          >
            <Radio value="auto" label={t("cart.wechatAuto")} />
            <Radio value="direct" label={t("cart.wechatDirect")} />
            <Radio value="qr" label={t("cart.wechatQr")} />
          </RadioGroup>
        </div>
      )}

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
