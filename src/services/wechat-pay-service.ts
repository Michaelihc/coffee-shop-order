import crypto from "crypto";
import type {
  WechatPaymentInstructions,
  WechatPayPresentation,
} from "../types/api";

interface WechatPayOrderInput {
  orderId: string;
  description: string;
  amountCents: number;
  presentation: WechatPayPresentation;
  clientIp?: string;
  openid?: string;
}

interface WechatPayConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  privateKey: string;
  serialNo: string;
  notifyUrl: string;
  h5ReturnUrl?: string;
}

function readConfig(): WechatPayConfig | null {
  const appId = process.env.WECHAT_PAY_APP_ID?.trim();
  const mchId = process.env.WECHAT_PAY_MCH_ID?.trim();
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY?.trim();
  const privateKey = process.env.WECHAT_PAY_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const serialNo = process.env.WECHAT_PAY_CERT_SERIAL_NO?.trim();
  const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL?.trim();

  if (!appId || !mchId || !apiV3Key || !privateKey || !serialNo || !notifyUrl) {
    return null;
  }

  return {
    appId,
    mchId,
    apiV3Key,
    privateKey,
    serialNo,
    notifyUrl,
    h5ReturnUrl: process.env.WECHAT_PAY_H5_RETURN_URL?.trim(),
  };
}

function nonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function sign(config: WechatPayConfig, method: string, path: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = nonce();
  const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  const signature = signer.sign(config.privateKey, "base64");

  return {
    timestamp,
    nonceStr,
    authorization: [
      "WECHATPAY2-SHA256-RSA2048",
      `mchid="${config.mchId}"`,
      `nonce_str="${nonceStr}"`,
      `timestamp="${timestamp}"`,
      `serial_no="${config.serialNo}"`,
      `signature="${signature}"`,
    ].join(" "),
  };
}

async function postWechat<T>(
  config: WechatPayConfig,
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const body = JSON.stringify(payload);
  const auth = sign(config, "POST", path, body);
  const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method: "POST",
    headers: {
      Authorization: auth.authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "coffee-shop-order/1.0",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WeChat Pay request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

function buildJsapiSign(config: WechatPayConfig, prepayId: string) {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = nonce();
  const packageValue = `prepay_id=${prepayId}`;
  const message = `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  signer.end();

  return {
    kind: "jsapi" as const,
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: "RSA" as const,
    paySign: signer.sign(config.privateKey, "base64"),
  };
}

function getStubPayment(input: WechatPayOrderInput): WechatPaymentInstructions {
  const encodedOrderId = encodeURIComponent(input.orderId);
  if (input.presentation === "direct") {
    return {
      kind: "h5",
      h5Url: `/app/cart?wechatPayStub=1&orderId=${encodedOrderId}`,
    };
  }

  return {
    kind: "qr",
    codeUrl: `weixin://wxpay/bizpayurl?pr=${encodedOrderId}`,
  };
}

export async function createWechatPayment(
  input: WechatPayOrderInput
): Promise<WechatPaymentInstructions> {
  const config = readConfig();
  if (!config) {
    return getStubPayment(input);
  }

  if (input.presentation === "direct" && input.openid) {
    const result = await postWechat<{ prepay_id: string }>(
      config,
      "/v3/pay/transactions/jsapi",
      {
        appid: config.appId,
        mchid: config.mchId,
        description: input.description,
        out_trade_no: input.orderId,
        notify_url: config.notifyUrl,
        amount: { total: input.amountCents, currency: "CNY" },
        payer: { openid: input.openid },
      }
    );
    return buildJsapiSign(config, result.prepay_id);
  }

  if (input.presentation === "direct") {
    const result = await postWechat<{ h5_url: string }>(
      config,
      "/v3/pay/transactions/h5",
      {
        appid: config.appId,
        mchid: config.mchId,
        description: input.description,
        out_trade_no: input.orderId,
        notify_url: config.notifyUrl,
        amount: { total: input.amountCents, currency: "CNY" },
        scene_info: {
          payer_client_ip: input.clientIp || "127.0.0.1",
          h5_info: { type: "Wap" },
        },
      }
    );
    const returnUrl = config.h5ReturnUrl
      ? `${result.h5_url}${result.h5_url.includes("?") ? "&" : "?"}redirect_url=${encodeURIComponent(config.h5ReturnUrl)}`
      : result.h5_url;
    return { kind: "h5", h5Url: returnUrl };
  }

  const result = await postWechat<{ code_url: string }>(
    config,
    "/v3/pay/transactions/native",
    {
      appid: config.appId,
      mchid: config.mchId,
      description: input.description,
      out_trade_no: input.orderId,
      notify_url: config.notifyUrl,
      amount: { total: input.amountCents, currency: "CNY" },
    }
  );
  return { kind: "qr", codeUrl: result.code_url };
}
