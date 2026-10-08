import { useEffect, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Button, Image, Input, ScrollView, Text, View } from "@tarojs/components";
import {
  cartTotalCents,
  formatCurrency,
  updateCartItemQuantity,
  type CreateGuestOrderRequest,
  type PickupWindow,
  type PortableCartItem,
  type WechatPayPresentation,
} from "@coffee-shop/portable";
import { toDataURL } from "qrcode";
import { portableApi } from "../../api";
import { clearCart, loadCart, saveGuestSession, upsertOrder, saveCart } from "../../store";

export default function CartPage() {
  const [cart, setCart] = useState<PortableCartItem[]>([]);
  const [windows, setWindows] = useState<PickupWindow[]>([]);
  const [selectedWindow, setSelectedWindow] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestMaskedPhone, setGuestMaskedPhone] = useState("");
  const [guestAuthenticated, setGuestAuthenticated] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash-at-counter" | "wechat-pay">(
    "cash-at-counter"
  );
  const [wechatMode, setWechatMode] = useState<WechatPayPresentation>("auto");
  const [qrImage, setQrImage] = useState("");
  const [error, setError] = useState("");

  useDidShow(() => {
    setCart(loadCart());
  });

  useEffect(() => {
    portableApi
      .getPickupWindows()
      .then((response) => {
        setWindows(response.windows);
        setSelectedWindow(response.windows[0]?.id || "");
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Failed to load windows")
      );
  }, []);

  useEffect(() => {
    portableApi
      .getGuestAuth()
      .then((response) => {
        if (response.authenticated && response.phone && response.maskedPhone) {
          setGuestPhone(response.phone);
          setGuestMaskedPhone(response.maskedPhone);
          setGuestAuthenticated(true);
        }
      })
      .catch(() => undefined);
  }, []);

  function handleQuantity(menuItemId: string, quantity: number) {
    const next = updateCartItemQuantity(cart, menuItemId, quantity);
    setCart(next);
    saveCart(next);
  }

  async function handleCheckout() {
    if (!guestAuthenticated) {
      setError("Authorize your WeChat phone number before placing an order.");
      return;
    }
    if (!selectedWindow) {
      setError("Select a pickup window.");
      return;
    }

    setError("");
    const wechatOpenId = Taro.getStorageSync("coffee-shop-wechat-openid") as string | undefined;
    const payload: CreateGuestOrderRequest = {
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
      const response = await portableApi.createGuestOrder(payload, wechatOpenId);
      upsertOrder(response.order);
      clearCart();
      setCart([]);

      if (response.payment?.kind === "jsapi") {
        await Taro.requestPayment({
          timeStamp: response.payment.timeStamp,
          nonceStr: response.payment.nonceStr,
          package: response.payment.package,
          signType: response.payment.signType,
          paySign: response.payment.paySign,
        });
      } else if (response.payment?.kind === "qr") {
        const image = await toDataURL(response.payment.codeUrl);
        setQrImage(image);
      } else if (response.payment?.kind === "h5") {
        await Taro.setClipboardData({ data: response.payment.h5Url });
        await Taro.showToast({ title: "H5 link copied", icon: "none" });
      } else {
        await Taro.switchTab({ url: "/pages/orders/index" });
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Checkout failed");
    }
  }

  async function handleWechatPhone(event: { detail?: { code?: string; errMsg?: string } }) {
    const code = event.detail?.code;
    if (!code) {
      setError(event.detail?.errMsg || "WeChat phone authorization was cancelled.");
      return;
    }

    try {
      const response = await portableApi.verifyWechatPhone(code);
      saveGuestSession(response.token);
      setGuestMaskedPhone(response.maskedPhone);
      setGuestAuthenticated(true);
      const auth = await portableApi.getGuestAuth();
      if (auth.phone) {
        setGuestPhone(auth.phone);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "WeChat phone authorization failed");
    }
  }

  return (
    <ScrollView scrollY className="page-shell">
      <Text className="section-title">Guest Checkout</Text>
      {error ? <View className="error-box">{error}</View> : null}

      {guestAuthenticated ? (
        <View className="card">
          <Text className="card-title">Ordering as {guestMaskedPhone}</Text>
        </View>
      ) : (
        <Button
          className="primary-button"
          openType="getPhoneNumber"
          onGetPhoneNumber={handleWechatPhone}
        >
          Authorize WeChat phone
        </Button>
      )}
      <Input
        className="input"
        placeholder="Notes"
        value={notes}
        onInput={(event) => setNotes(event.detail.value)}
      />

      <Text className="section-title">Pickup Window</Text>
      <View className="chip-row">
        {windows.map((window) => (
          <View
            key={window.id}
            className={`chip ${selectedWindow === window.id ? "chip--active" : ""}`}
            onClick={() => setSelectedWindow(window.id)}
          >
            {window.label}
          </View>
        ))}
      </View>

      <Text className="section-title">Payment</Text>
      <View className="chip-row">
        <View
          className={`chip ${paymentMethod === "cash-at-counter" ? "chip--active" : ""}`}
          onClick={() => setPaymentMethod("cash-at-counter")}
        >
          Cash
        </View>
        <View
          className={`chip ${paymentMethod === "wechat-pay" ? "chip--active" : ""}`}
          onClick={() => setPaymentMethod("wechat-pay")}
        >
          WeChat Pay
        </View>
      </View>

      {paymentMethod === "wechat-pay" ? (
        <View className="chip-row">
          {(["auto", "direct", "qr"] as const).map((mode) => (
            <View
              key={mode}
              className={`chip ${wechatMode === mode ? "chip--active" : ""}`}
              onClick={() => setWechatMode(mode)}
            >
              {mode.toUpperCase()}
            </View>
          ))}
        </View>
      ) : null}

      <Text className="section-title">Items</Text>
      {cart.map((item) => (
        <View key={item.menuItemId} className="card">
          <View className="inline-row">
            <View>
              <Text className="card-title">{item.name}</Text>
              <Text className="muted">{formatCurrency(item.priceCents)}</Text>
            </View>
            <View className="inline-row">
              <View className="chip" onClick={() => handleQuantity(item.menuItemId, item.quantity - 1)}>
                -
              </View>
              <Text className="quantity-box">{item.quantity}</Text>
              <View className="chip" onClick={() => handleQuantity(item.menuItemId, item.quantity + 1)}>
                +
              </View>
            </View>
          </View>
        </View>
      ))}

      <Text className="total">Total: {formatCurrency(cartTotalCents(cart))}</Text>
      <Button className="primary-button" onClick={handleCheckout}>
        Place guest order
      </Button>

      {qrImage ? (
        <View className="card">
          <Text className="card-title">Scan in WeChat</Text>
          <Image className="qr-image" src={qrImage} />
        </View>
      ) : null}
    </ScrollView>
  );
}
