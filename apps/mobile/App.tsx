import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import QRCode from "react-native-qrcode-svg";
import { WebView } from "react-native-webview";
import {
  addCartItem,
  cartItemCount,
  cartTotalCents,
  formatCurrency,
  toCartItem,
  updateCartItemQuantity,
  type Category,
  type CreateGuestOrderRequest,
  type MenuItem,
  type Order,
  type PickupWindow,
  type PortableCartItem,
  type WechatPayPresentation,
  type WechatPaymentInstructions,
} from "@coffee-shop/portable";
import { portableApi } from "./src/api";
import {
  clearCart as clearStoredCart,
  loadCart,
  loadOrders,
  saveCart,
  saveGuestSession,
  saveOrder,
  saveOrders,
} from "./src/storage";

type TabKey = "menu" | "cart" | "orders";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function PillButton({
  active,
  onPress,
  children,
}: {
  active?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pillButton, active ? styles.pillButtonActive : null]}
    >
      <Text style={[styles.pillButtonText, active ? styles.pillButtonTextActive : null]}>
        {children}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("menu");
  const [categories, setCategories] = useState<(Category & { items: MenuItem[] })[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [cart, setCart] = useState<PortableCartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [windows, setWindows] = useState<PickupWindow[]>([]);
  const [guestPhone, setGuestPhone] = useState("");
  const [guestMaskedPhone, setGuestMaskedPhone] = useState("");
  const [guestAuthenticated, setGuestAuthenticated] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedWindow, setSelectedWindow] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash-at-counter" | "wechat-pay">(
    "cash-at-counter"
  );
  const [wechatMode, setWechatMode] = useState<WechatPayPresentation>("auto");
  const [wechatPayment, setWechatPayment] = useState<WechatPaymentInstructions | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      portableApi.getMenu(),
      portableApi.getPickupWindows(),
      loadCart(),
      loadOrders(),
      portableApi.getGuestAuthConfig(),
      portableApi.getGuestAuth(),
    ])
      .then(([menu, pickupWindows, storedCart, storedOrders, authConfig, guestAuth]) => {
        setCategories(menu.categories);
        setSelectedCategoryId(menu.categories[0]?.id || "");
        setWindows(pickupWindows.windows);
        setCart(storedCart);
        setOrders(storedOrders);
        setTurnstileSiteKey(authConfig.turnstileSiteKey);
        if (guestAuth.authenticated && guestAuth.phone && guestAuth.maskedPhone) {
          setGuestPhone(guestAuth.phone);
          setGuestMaskedPhone(guestAuth.maskedPhone);
          setGuestAuthenticated(true);
        }
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Failed to load portable client")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    saveCart(cart).catch(() => undefined);
  }, [cart]);

  useEffect(() => {
    const pendingOrders = orders.filter(
      (order) => order.paymentMethod === "wechat-pay" && order.paymentStatus === "pending"
    );
    if (pendingOrders.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      Promise.all(
        pendingOrders.map(async (order) => {
          const status = await portableApi.getPaymentStatus(order.id);
          if (status.paymentStatus === order.paymentStatus) {
            return order;
          }
          return { ...order, paymentStatus: status.paymentStatus, status: status.status };
        })
      )
        .then((nextOrders) => {
          const merged = orders.map((order) =>
            nextOrders.find((candidate) => candidate.id === order.id) || order
          );
          setOrders(merged);
          saveOrders(merged).catch(() => undefined);
        })
        .catch(() => undefined);
    }, 4000);

    return () => clearInterval(timer);
  }, [orders]);

  const currentCategory =
    categories.find((category) => category.id === selectedCategoryId) || categories[0];

  function handleAddItem(item: MenuItem) {
    setCart((current) => addCartItem(current, toCartItem(item)));
  }

  function handleQuantity(menuItemId: string, quantity: number) {
    setCart((current) => updateCartItemQuantity(current, menuItemId, quantity));
  }

  async function handleCheckout() {
    if (!guestPhone.trim()) {
      setError("Guest phone is required.");
      return;
    }
    if (!guestAuthenticated) {
      setError("Verify your phone before placing an order.");
      return;
    }
    if (!selectedWindow) {
      setError("Select a pickup window.");
      return;
    }
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const body: CreateGuestOrderRequest = {
      guest: { phone: guestPhone.trim() },
      pickupWindowId: selectedWindow,
      paymentMethod,
      wechatPayPresentation: paymentMethod === "wechat-pay" ? wechatMode : undefined,
      items: cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      })),
      notes: notes.trim() || undefined,
    };

    try {
      const response = await portableApi.createGuestOrder(body);
      await saveOrder(response.order);
      setOrders((current) => [response.order, ...current.filter((entry) => entry.id !== response.order.id)]);
      setCart([]);
      await clearStoredCart();

      if (response.payment?.kind === "h5") {
        await Linking.openURL(response.payment.h5Url);
      } else if (response.payment) {
        setWechatPayment(response.payment);
      } else {
        setActiveTab("orders");
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendCode() {
    if (!turnstileToken) {
      setError("Complete human verification before sending a code.");
      return;
    }
    try {
      const response = await portableApi.sendGuestCode(guestPhone, turnstileToken);
      setGuestMaskedPhone(response.maskedPhone);
      setSmsSent(true);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to send verification code");
    }
  }

  async function handleVerifyCode() {
    try {
      const response = await portableApi.verifyGuestCode(guestPhone, smsCode);
      await saveGuestSession(response.token);
      setGuestMaskedPhone(response.maskedPhone);
      setGuestAuthenticated(true);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to verify code");
    }
  }

  const turnstileHtml = turnstileSiteKey
    ? `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:90px;"><div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" data-callback="onToken"></div><script>function onToken(token){window.ReactNativeWebView.postMessage(token);}</script></body></html>`
    : "";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <Text style={styles.brand}>Coffee Shop Portable</Text>
        <View style={styles.navRow}>
          <PillButton active={activeTab === "menu"} onPress={() => setActiveTab("menu")}>
            Menu
          </PillButton>
          <PillButton active={activeTab === "cart"} onPress={() => setActiveTab("cart")}>
            Cart ({cartItemCount(cart)})
          </PillButton>
          <PillButton active={activeTab === "orders"} onPress={() => setActiveTab("orders")}>
            Orders
          </PillButton>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#8b5e3c" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {activeTab === "menu" ? (
              <>
                <SectionTitle>Menu</SectionTitle>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                  {categories.map((category) => (
                    <PillButton
                      key={category.id}
                      active={category.id === currentCategory?.id}
                      onPress={() => setSelectedCategoryId(category.id)}
                    >
                      {category.label}
                    </PillButton>
                  ))}
                </ScrollView>
                <View style={styles.cardGrid}>
                  {(currentCategory?.items || []).map((item) => {
                    const quantity = cart.find((entry) => entry.menuItemId === item.id)?.quantity || 0;
                    return (
                      <View key={item.id} style={styles.card}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        {item.description ? (
                          <Text style={styles.cardDescription}>{item.description}</Text>
                        ) : null}
                        <Text style={styles.cardPrice}>{formatCurrency(item.priceCents)}</Text>
                        <Pressable style={styles.primaryButton} onPress={() => handleAddItem(item)}>
                          <Text style={styles.primaryButtonText}>
                            {quantity > 0 ? `Add another (${quantity})` : "Add to cart"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {activeTab === "cart" ? (
              <>
                <SectionTitle>Guest Checkout</SectionTitle>
                <TextInput
                  value={guestPhone}
                  onChangeText={setGuestPhone}
                  placeholder="Guest phone"
                  keyboardType="phone-pad"
                  style={styles.input}
                  editable={!guestAuthenticated}
                />
                {guestAuthenticated ? (
                  <Text style={styles.mutedText}>Ordering as {guestMaskedPhone}</Text>
                ) : (
                  <>
                    {turnstileHtml ? (
                      <WebView
                        originWhitelist={["*"]}
                        source={{ html: turnstileHtml }}
                        onMessage={(event) => setTurnstileToken(event.nativeEvent.data)}
                        style={styles.turnstileWebView}
                      />
                    ) : (
                      <Text style={styles.mutedText}>Human verification is not configured.</Text>
                    )}
                    <Pressable style={styles.secondaryButton} onPress={handleSendCode}>
                      <Text style={styles.secondaryButtonText}>Send SMS code</Text>
                    </Pressable>
                    {smsSent ? (
                      <>
                        <TextInput
                          value={smsCode}
                          onChangeText={setSmsCode}
                          placeholder="SMS code"
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                        <Pressable style={styles.secondaryButton} onPress={handleVerifyCode}>
                          <Text style={styles.secondaryButtonText}>Verify code</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </>
                )}
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes"
                  style={[styles.input, styles.notesInput]}
                  multiline
                />

                <SectionTitle>Pickup Window</SectionTitle>
                <View style={styles.flowRow}>
                  {windows.map((window) => (
                    <PillButton
                      key={window.id}
                      active={selectedWindow === window.id}
                      onPress={() => setSelectedWindow(window.id)}
                    >
                      {window.label}
                    </PillButton>
                  ))}
                </View>

                <SectionTitle>Payment</SectionTitle>
                <View style={styles.flowRow}>
                  <PillButton
                    active={paymentMethod === "cash-at-counter"}
                    onPress={() => setPaymentMethod("cash-at-counter")}
                  >
                    Cash
                  </PillButton>
                  <PillButton
                    active={paymentMethod === "wechat-pay"}
                    onPress={() => setPaymentMethod("wechat-pay")}
                  >
                    WeChat Pay
                  </PillButton>
                </View>
                {paymentMethod === "wechat-pay" ? (
                  <View style={styles.flowRow}>
                    <PillButton active={wechatMode === "auto"} onPress={() => setWechatMode("auto")}>
                      Auto
                    </PillButton>
                    <PillButton
                      active={wechatMode === "direct"}
                      onPress={() => setWechatMode("direct")}
                    >
                      Direct
                    </PillButton>
                    <PillButton active={wechatMode === "qr"} onPress={() => setWechatMode("qr")}>
                      QR
                    </PillButton>
                  </View>
                ) : null}

                <SectionTitle>Items</SectionTitle>
                {cart.length === 0 ? (
                  <Text style={styles.mutedText}>Your cart is empty.</Text>
                ) : (
                  cart.map((item) => (
                    <View key={item.menuItemId} style={styles.orderRow}>
                      <View>
                        <Text style={styles.rowTitle}>{item.name}</Text>
                        <Text style={styles.mutedText}>{formatCurrency(item.priceCents)}</Text>
                      </View>
                      <View style={styles.quantityRow}>
                        <PillButton onPress={() => handleQuantity(item.menuItemId, item.quantity - 1)}>
                          -
                        </PillButton>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <PillButton onPress={() => handleQuantity(item.menuItemId, item.quantity + 1)}>
                          +
                        </PillButton>
                      </View>
                    </View>
                  ))
                )}
                <Text style={styles.totalText}>Total: {formatCurrency(cartTotalCents(cart))}</Text>
                <Pressable
                  onPress={handleCheckout}
                  style={[styles.primaryButton, submitting ? styles.buttonDisabled : null]}
                  disabled={submitting}
                >
                  <Text style={styles.primaryButtonText}>
                    {submitting ? "Submitting..." : "Place guest order"}
                  </Text>
                </Pressable>

                {wechatPayment?.kind === "qr" ? (
                  <View style={styles.qrCard}>
                    <Text style={styles.rowTitle}>Scan with WeChat</Text>
                    <QRCode value={wechatPayment.codeUrl} size={180} />
                  </View>
                ) : null}
              </>
            ) : null}

            {activeTab === "orders" ? (
              <>
                <SectionTitle>Recent Orders</SectionTitle>
                {orders.length === 0 ? (
                  <Text style={styles.mutedText}>No portable orders stored yet.</Text>
                ) : (
                  orders.map((order) => (
                    <View key={order.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{order.id}</Text>
                      <Text style={styles.cardDescription}>
                        {order.studentName} · {order.paymentMethod} · {order.paymentStatus}
                      </Text>
                      <Text style={styles.cardPrice}>{formatCurrency(order.totalCents)}</Text>
                    </View>
                  ))
                )}
              </>
            ) : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f0e7",
  },
  appShell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  brand: {
    fontSize: 30,
    fontWeight: "700",
    color: "#432818",
    marginBottom: 12,
  },
  navRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 12,
  },
  categoryRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#5b3a29",
    marginBottom: 8,
  },
  cardGrid: {
    gap: 12,
  },
  card: {
    backgroundColor: "#fff9f0",
    borderWidth: 1,
    borderColor: "#dec8a8",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#38220f",
  },
  cardDescription: {
    color: "#6f5a49",
    lineHeight: 20,
  },
  cardPrice: {
    fontWeight: "700",
    color: "#8b5e3c",
  },
  primaryButton: {
    backgroundColor: "#8b5e3c",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#eadcc8",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#4f3422",
    fontWeight: "700",
  },
  turnstileWebView: {
    height: 96,
    marginBottom: 10,
    backgroundColor: "transparent",
  },
  pillButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#eadcc8",
    marginRight: 8,
    marginBottom: 8,
  },
  pillButtonActive: {
    backgroundColor: "#8b5e3c",
  },
  pillButtonText: {
    color: "#5c4330",
    fontWeight: "600",
  },
  pillButtonTextActive: {
    color: "#fff",
  },
  flowRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dec8a8",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  notesInput: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  mutedText: {
    color: "#7c6a5c",
  },
  errorText: {
    color: "#b42318",
    backgroundColor: "#fff1f3",
    padding: 12,
    borderRadius: 12,
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eadcc8",
  },
  rowTitle: {
    fontWeight: "700",
    color: "#38220f",
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityText: {
    minWidth: 24,
    textAlign: "center",
    fontWeight: "700",
  },
  totalText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#5b3a29",
    marginTop: 12,
    marginBottom: 12,
  },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dec8a8",
    padding: 16,
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
