import { Router } from "express";
import type { Request, Response } from "express";
import {
  resolveGuestSession,
  sendGuestSmsCode,
  verifyGuestSmsCode,
  verifyWechatPhoneCode,
} from "../services/guest-auth-service";

const router = Router();

function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim();
  }
  return req.socket.remoteAddress || undefined;
}

function getGuestSessionToken(req: Request): string | undefined {
  const header = req.headers["x-guest-session"];
  return typeof header === "string" ? header : undefined;
}

router.get("/config", (_req: Request, res: Response) => {
  res.json({
    turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || null,
  });
});

router.get("/me", (req: Request, res: Response) => {
  const guest = resolveGuestSession(getGuestSessionToken(req));
  if (!guest) {
    res.json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    phone: guest.phone,
    maskedPhone: guest.maskedPhone,
  });
});

router.post("/send-code", async (req: Request, res: Response) => {
  try {
    const result = await sendGuestSmsCode({
      phone: String(req.body?.phone || ""),
      turnstileToken: String(req.body?.turnstileToken || ""),
      ipAddress: getClientIp(req),
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send verification code";
    const status =
      message.includes("not configured") || message.includes("Twilio") ? 503 : 400;
    res.status(status).json({ error: message });
  }
});

router.post("/verify-code", (req: Request, res: Response) => {
  try {
    const result = verifyGuestSmsCode({
      phone: String(req.body?.phone || ""),
      code: String(req.body?.code || ""),
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to verify code",
    });
  }
});

router.post("/wechat-phone", async (req: Request, res: Response) => {
  try {
    const result = await verifyWechatPhoneCode({
      code: String(req.body?.code || ""),
    });
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify WeChat phone";
    res.status(message.includes("not configured") ? 503 : 400).json({ error: message });
  }
});

export default router;
