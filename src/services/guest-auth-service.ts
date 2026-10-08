import crypto from "crypto";
import { getDb } from "../db/connection";
import { toSqlTimestamp } from "./business-time-service";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SMS_CODE_TTL_MS = 10 * 60 * 1000;
const GUEST_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SMS_WINDOW_MS = 15 * 60 * 1000;
const MAX_SMS_PER_PHONE = 3;
const MAX_SMS_PER_IP = 10;
let cachedWechatAccessToken: { token: string; expiresAt: number } | null = null;

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

interface GuestSessionRow {
  phone: string;
  expires_at: string;
  revoked_at: string | null;
}

interface WechatAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WechatPhoneResponse {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber?: string;
    purePhoneNumber?: string;
    countryCode?: string;
  };
}

function now() {
  return new Date();
}

function addMs(date: Date, ms: number) {
  return new Date(date.getTime() + ms);
}

function configuredAuthSecret() {
  return process.env.GUEST_AUTH_SECRET || process.env.WECHAT_PAY_API_V3_KEY || "local-guest-auth-secret";
}

function hmac(value: string) {
  return crypto.createHmac("sha256", configuredAuthSecret()).update(value).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function randomCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) {
    return null;
  }
  return `${hasPlus ? "+" : ""}${digits}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) {
    return "(****)";
  }
  return `(${digits.slice(0, Math.min(3, digits.length - 4))} ****)`;
}

export function getGuestSessionTokenHash(token: string): string {
  return hmac(`guest-session:${token}`);
}

export function createGuestSession(phone: string): { token: string; maskedPhone: string; expiresAt: string } {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error("Invalid phone number");
  }

  const token = randomToken();
  const createdAt = now();
  const expiresAt = addMs(createdAt, GUEST_SESSION_TTL_MS);
  const db = getDb();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO guest_users (phone, masked_phone, created_at, updated_at, verified_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET
         masked_phone = excluded.masked_phone,
         updated_at = excluded.updated_at,
         verified_at = excluded.verified_at`
    ).run(normalizedPhone, maskPhone(normalizedPhone), toSqlTimestamp(createdAt), toSqlTimestamp(createdAt), toSqlTimestamp(createdAt));

    db.prepare(
      `INSERT INTO guest_sessions (token_hash, phone, created_at, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      getGuestSessionTokenHash(token),
      normalizedPhone,
      toSqlTimestamp(createdAt),
      toSqlTimestamp(expiresAt)
    );
  })();

  return {
    token,
    maskedPhone: maskPhone(normalizedPhone),
    expiresAt: toSqlTimestamp(expiresAt),
  };
}

export function resolveGuestSession(token?: string | null): { phone: string; maskedPhone: string } | null {
  if (!token) {
    return null;
  }

  const db = getDb();
  const row = db
    .prepare<GuestSessionRow>(
      `SELECT phone, expires_at, revoked_at
       FROM guest_sessions
       WHERE token_hash = ?`
    )
    .get(getGuestSessionTokenHash(token));

  if (!row || row.revoked_at) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return { phone: row.phone, maskedPhone: maskPhone(row.phone) };
}

async function verifyTurnstile(token: string, remoteIp?: string): Promise<void> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("Cloudflare Turnstile is not configured");
  }
  if (!token.trim()) {
    throw new Error("Human verification is required");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = (await response.json()) as TurnstileResponse;
  if (!response.ok || !result.success) {
    throw new Error(`Human verification failed${result["error-codes"]?.length ? `: ${result["error-codes"].join(", ")}` : ""}`);
  }
}

async function sendSms(phone: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    throw new Error("Twilio SMS is not configured");
  }

  const body = new URLSearchParams({
    To: phone,
    Body: message,
  });
  if (messagingServiceSid) {
    body.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    body.set("From", from);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`SMS send failed: ${response.status} ${text}`);
  }
}

function enforceSmsRateLimit(phone: string, ipAddress?: string): void {
  const db = getDb();
  const since = toSqlTimestamp(new Date(Date.now() - SMS_WINDOW_MS));
  const phoneCount = db
    .prepare<{ n: number }>(
      "SELECT COUNT(*) as n FROM guest_sms_challenges WHERE phone = ? AND created_at >= ?"
    )
    .get(phone, since)?.n ?? 0;

  if (phoneCount >= MAX_SMS_PER_PHONE) {
    throw new Error("Too many codes sent to this phone. Please wait and try again.");
  }

  if (ipAddress) {
    const ipCount = db
      .prepare<{ n: number }>(
        "SELECT COUNT(*) as n FROM guest_sms_challenges WHERE ip_address = ? AND created_at >= ?"
      )
      .get(ipAddress, since)?.n ?? 0;
    if (ipCount >= MAX_SMS_PER_IP) {
      throw new Error("Too many verification attempts. Please wait and try again.");
    }
  }
}

export async function sendGuestSmsCode(input: {
  phone: string;
  turnstileToken: string;
  ipAddress?: string;
}): Promise<{ maskedPhone: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("Enter a valid phone number.");
  }

  await verifyTurnstile(input.turnstileToken, input.ipAddress);
  enforceSmsRateLimit(phone, input.ipAddress);

  const code = randomCode();
  const codeSalt = randomToken();
  const createdAt = now();
  const expiresAt = addMs(createdAt, SMS_CODE_TTL_MS);
  const db = getDb();

  db.prepare(
    `INSERT INTO guest_sms_challenges (
      phone, code_hash, code_salt, ip_address, attempts, created_at, expires_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?)`
  ).run(
    phone,
    hmac(`sms-code:${codeSalt}:${code}`),
    codeSalt,
    input.ipAddress || null,
    toSqlTimestamp(createdAt),
    toSqlTimestamp(expiresAt)
  );

  await sendSms(phone, `Your Coffee Shop verification code is ${code}. It expires in 10 minutes.`);

  return { maskedPhone: maskPhone(phone) };
}

export function verifyGuestSmsCode(input: {
  phone: string;
  code: string;
}): { token: string; maskedPhone: string; expiresAt: string } {
  const phone = normalizePhone(input.phone);
  const code = input.code.trim();
  if (!phone || !/^\d{6}$/.test(code)) {
    throw new Error("Invalid verification code.");
  }

  const db = getDb();
  const challenge = db
    .prepare<{
      id: number;
      code_hash: string;
      code_salt: string;
      attempts: number;
      expires_at: string;
      consumed_at: string | null;
    }>(
      `SELECT id, code_hash, code_salt, attempts, expires_at, consumed_at
       FROM guest_sms_challenges
       WHERE phone = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(phone);

  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw new Error("Verification code expired. Request a new code.");
  }

  if (challenge.attempts >= 5) {
    throw new Error("Too many incorrect attempts. Request a new code.");
  }

  const expected = hmac(`sms-code:${challenge.code_salt}:${code}`);
  if (expected !== challenge.code_hash) {
    db.prepare("UPDATE guest_sms_challenges SET attempts = attempts + 1 WHERE id = ?").run(challenge.id);
    throw new Error("Invalid verification code.");
  }

  db.prepare("UPDATE guest_sms_challenges SET consumed_at = ? WHERE id = ?").run(
    toSqlTimestamp(),
    challenge.id
  );

  return createGuestSession(phone);
}

async function getWechatAccessToken(): Promise<string> {
  if (cachedWechatAccessToken && cachedWechatAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedWechatAccessToken.token;
  }

  const appId =
    process.env.WECHAT_MINI_PROGRAM_APP_ID?.trim() ||
    process.env.WECHAT_PAY_APP_ID?.trim();
  const appSecret = process.env.WECHAT_MINI_PROGRAM_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error("WeChat Mini Program phone login is not configured");
  }

  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);

  const response = await fetch(url);
  const result = (await response.json()) as WechatAccessTokenResponse;
  if (!response.ok || !result.access_token) {
    throw new Error(`WeChat access token request failed: ${result.errmsg || response.statusText}`);
  }

  cachedWechatAccessToken = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max(60, result.expires_in || 7200) * 1000,
  };
  return cachedWechatAccessToken.token;
}

export async function verifyWechatPhoneCode(input: {
  code: string;
}): Promise<{ token: string; maskedPhone: string; expiresAt: string }> {
  const code = input.code.trim();
  if (!code) {
    throw new Error("WeChat phone authorization code is required");
  }

  const accessToken = await getWechatAccessToken();
  const url = new URL("https://api.weixin.qq.com/wxa/business/getuserphonenumber");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const result = (await response.json()) as WechatPhoneResponse;
  if (!response.ok || result.errcode) {
    throw new Error(`WeChat phone authorization failed: ${result.errmsg || response.statusText}`);
  }

  const rawPhone = result.phone_info?.phoneNumber || result.phone_info?.purePhoneNumber;
  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!normalizedPhone) {
    throw new Error("WeChat did not return a valid phone number");
  }

  return createGuestSession(normalizedPhone);
}
