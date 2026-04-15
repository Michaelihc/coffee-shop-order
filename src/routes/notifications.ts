import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { enableNotificationDebugRoutes } from "../config/runtime-mode";
import { requireAdmin, requireAuthenticated } from "../middleware/authorization";
import { getGraphAccessToken, getGraphAppCredentials, getGraphClient } from "../services/graph-auth-service";
import { logError } from "../services/logger";
import {
  getTeamsTabEndpoint,
  sendTeamsNotification,
} from "../services/teams-notification-service";

const router = Router();

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
    const credentials = getGraphAppCredentials();
    if (!credentials) {
      res.status(500).json({ error: "Graph app credentials are not configured" });
      return;
    }

    const client = getGraphClient();
    const userId = req.params.userId;
    const installations = await client
      .api(`/users/${userId}/teamwork/installedApps`)
      .expand("teamsApp")
      .get();

    res.json({
      teamsAppId: credentials.teamsAppId,
      count: installations.value?.length || 0,
      installations: (installations.value as Array<{
        id?: string;
        teamsApp?: { externalId?: string; displayName?: string };
      }> | undefined)?.map((installation) => ({
        id: installation.id,
        externalId: installation.teamsApp?.externalId,
        displayName: installation.teamsApp?.displayName,
      })),
    });
  } catch (error: unknown) {
    logError("notifications.test_installations.failed", { error });
    res.status(500).json({ error: "Failed to inspect app installations" });
  }
});

/**
 * GET /api/notifications/test-token
 * Test getting token with direct HTTP call
 */
router.get("/test-token", requireNotificationDebugAccess, async (_req, res) => {
  try {
    if (!getGraphAppCredentials()) {
      return res.json({ error: "Missing credentials" });
    }

    const token = await getGraphAccessToken();
    res.json({ success: Boolean(token), hasToken: Boolean(token) });
  } catch (error: unknown) {
    logError("notifications.test_token.failed", { error });
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
    const credentials = getGraphAppCredentials();

    if (!credentials) {
      return res.json({ error: "Missing credentials" });
    }

    const credential = new ClientSecretCredential(
      credentials.tenantId,
      credentials.clientId,
      credentials.clientSecret
    );
    const token = await credential.getToken("https://graph.microsoft.com/.default");

    res.json({
      success: true,
      tokenExpiry: new Date(token.expiresOnTimestamp).toISOString()
    });
  } catch (error: unknown) {
    logError("notifications.test_auth.failed", { error });
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
  const effectiveTabEndpoint = getTeamsTabEndpoint();
  res.json({
    TEAMS_APP_TENANT_ID: process.env.TEAMS_APP_TENANT_ID ? "SET" : "MISSING",
    AAD_APP_CLIENT_ID: process.env.AAD_APP_CLIENT_ID ? "SET" : "MISSING",
    AAD_APP_CLIENT_SECRET: process.env.AAD_APP_CLIENT_SECRET ? "SET" : "MISSING",
    TEAMS_APP_ID: process.env.TEAMS_APP_ID ? "SET" : "MISSING",
    TEAMS_APP_ID_VALUE: process.env.TEAMS_APP_ID,
    TAB_ENDPOINT: process.env.TAB_ENDPOINT ? "SET" : "MISSING",
    TAB_DOMAIN: process.env.TAB_DOMAIN ? "SET" : "MISSING",
    WEBSITE_HOSTNAME: process.env.WEBSITE_HOSTNAME ?? null,
    EFFECTIVE_TAB_ENDPOINT: effectiveTabEndpoint,
  });
});

/**
 * POST /api/notifications/send
 * Send a Teams notification to the current user
 */
router.post("/send", requireAuthenticated, async (req, res) => {
  try {
    const { title, body, targetPath } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const result = await sendTeamsNotification({
      userId: req.user!.userId,
      title,
      body,
      targetPath: typeof targetPath === "string" ? targetPath : undefined,
    });

    res.json(result);
  } catch (error) {
    logError("notifications.send.failed", { error });
    res.status(500).json({
      error: "Failed to send notification",
    });
  }
});

export default router;
