import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { enableNotificationDebugRoutes } from "../config/runtime-mode";
import { getDb } from "../db/connection";
import { sendTeamsNotification } from "../services/teams-notification-service";

const router = Router();

function requireAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const db = getDb();
  const staff = db
    .prepare("SELECT role FROM staff WHERE aad_id = ?")
    .get(req.user.userId) as { role?: string } | undefined;

  if (!staff || staff.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

function requireNotificationDebugAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!enableNotificationDebugRoutes()) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  requireAdmin(req, res, next);
}

/**
 * GET /api/notifications/test-installations
 * Test getting installed apps for a user
 */
router.get("/test-installations/:userId", requireNotificationDebugAccess, async (req, res) => {
  try {
    const { Client } = await import("@microsoft/microsoft-graph-client");

    async function getAccessToken(): Promise<string | null> {
      const tenantId = process.env.TEAMS_APP_TENANT_ID;
      const clientId = process.env.AAD_APP_CLIENT_ID;
      const clientSecret = process.env.AAD_APP_CLIENT_SECRET;

      if (!tenantId || !clientId || !clientSecret) return null;

      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials"
      });

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      const data = await response.json();
      return data.access_token || null;
    }

    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await getAccessToken();
          if (!token) throw new Error("Failed to get token");
          return token;
        },
      },
    });

    const userId = req.params.userId;
    const teamsAppId = process.env.TEAMS_APP_ID;

    const installations = await client
      .api(`/users/${userId}/teamwork/installedApps`)
      .expand("teamsApp")
      .get();

    res.json({
      teamsAppId,
      count: installations.value?.length || 0,
      installations: installations.value?.map((i: any) => ({
        id: i.id,
        externalId: i.teamsApp?.externalId,
        displayName: i.teamsApp?.displayName
      }))
    });
  } catch (error: any) {
    console.error("[Notifications] test-installations failed:", error);
    res.status(500).json({ error: "Failed to inspect app installations" });
  }
});

/**
 * GET /api/notifications/test-token
 * Test getting token with direct HTTP call
 */
router.get("/test-token", requireNotificationDebugAccess, async (_req, res) => {
  try {
    const tenantId = process.env.TEAMS_APP_TENANT_ID;
    const clientId = process.env.AAD_APP_CLIENT_ID;
    const clientSecret = process.env.AAD_APP_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      return res.json({ error: "Missing credentials" });
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials"
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const data = await response.json();

    if (response.ok) {
      res.json({ success: true, hasToken: !!data.access_token });
    } else {
      res.json({ success: false, error: data });
    }
  } catch (error: any) {
    console.error("[Notifications] test-token failed:", error);
    res.status(500).json({ success: false, error: "Failed to acquire token" });
  }
});

/**
 * GET /api/notifications/test-auth
 * Test Graph API authentication
 */
router.get("/test-auth", requireNotificationDebugAccess, async (_req, res) => {
  try {
    const { ClientSecretCredential } = await import("@azure/identity");
    const tenantId = process.env.TEAMS_APP_TENANT_ID;
    const clientId = process.env.AAD_APP_CLIENT_ID;
    const clientSecret = process.env.AAD_APP_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      return res.json({ error: "Missing credentials" });
    }

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const token = await credential.getToken("https://graph.microsoft.com/.default");

    res.json({
      success: true,
      tokenExpiry: new Date(token.expiresOnTimestamp).toISOString()
    });
  } catch (error: any) {
    console.error("[Notifications] test-auth failed:", error);
    res.json({
      success: false,
      error: "Authentication check failed",
    });
  }
});

/**
 * GET /api/notifications/debug
 * Debug endpoint to check environment variables
 */
router.get("/debug", requireNotificationDebugAccess, (_req, res) => {
  res.json({
    TEAMS_APP_TENANT_ID: process.env.TEAMS_APP_TENANT_ID ? "SET" : "MISSING",
    AAD_APP_CLIENT_ID: process.env.AAD_APP_CLIENT_ID ? "SET" : "MISSING",
    AAD_APP_CLIENT_SECRET: process.env.AAD_APP_CLIENT_SECRET ? "SET" : "MISSING",
    TEAMS_APP_ID: process.env.TEAMS_APP_ID ? "SET" : "MISSING",
    TEAMS_APP_ID_VALUE: process.env.TEAMS_APP_ID,
  });
});

/**
 * POST /api/notifications/send
 * Send a Teams notification to the current user
 */
router.post("/send", requireAuthenticated, async (req, res) => {
  try {
    const { title, body, deepLink } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const result = await sendTeamsNotification({
      userId: req.user!.userId,
      title,
      body,
      deepLink,
    });

    res.json(result);
  } catch (error) {
    console.error("[Notifications] Failed to send Teams notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
    });
  }
});

export default router;
