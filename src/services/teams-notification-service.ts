/**
 * Teams Activity Feed Notification Service
 *
 * Sends notifications to users via Microsoft Teams Activity Feed.
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";

export interface TeamsNotificationPayload {
  userId: string;
  title: string;
  body: string;
  deepLink?: string;
}

let graphClient: Client | null = null;

/**
 * Get access token using direct HTTP call (more reliable on Azure App Service)
 */
async function getAccessToken(): Promise<string | null> {
  const tenantId = process.env.TEAMS_APP_TENANT_ID;
  const clientId = process.env.AAD_APP_CLIENT_ID;
  const clientSecret = process.env.AAD_APP_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }

  try {
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
  } catch (err) {
    console.error("[Graph] Failed to get access token:", err);
    return null;
  }
}

/**
 * Initialize Graph client with app credentials
 */
function getGraphClient(): Client | null {
  if (graphClient) {
    console.log("[Graph] Using cached client");
    return graphClient;
  }

  console.log("[Graph] Initializing Graph client...");

  try {
    graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          console.log("[Graph] Getting access token...");
          const token = await getAccessToken();
          if (!token) {
            throw new Error("Failed to get access token");
          }
          console.log("[Graph] Token acquired");
          return token;
        },
      },
    });
    console.log("[Graph] Client initialized successfully");
    return graphClient;
  } catch (err) {
    console.error("[Graph] Failed to initialize Graph client:", err);
    return null;
  }
}

/**
 * Send a Teams activity feed notification to a user.
 */
export async function sendTeamsNotification(
  payload: TeamsNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  console.log("[Graph] sendTeamsNotification called with:", payload);

  const client = getGraphClient();

  if (!client) {
    console.log("[Graph] Graph client not available, skipping");
    return { success: false, error: "Graph client not initialized" };
  }

  try {
    const teamsAppId = process.env.TEAMS_APP_ID;
    console.log("[Graph] TEAMS_APP_ID:", teamsAppId ? teamsAppId : "MISSING");

    if (!teamsAppId) {
      console.warn("[Graph] TEAMS_APP_ID not set");
      return { success: false, error: "TEAMS_APP_ID not set" };
    }

    // Get the installation ID for this user
    console.log("[Graph] Getting installation ID for user:", payload.userId);
    const installations = await client
      .api(`/users/${payload.userId}/teamwork/installedApps`)
      .filter(`teamsApp/externalId eq '${teamsAppId}'`)
      .get();

    if (!installations.value || installations.value.length === 0) {
      console.log("[Graph] App not installed for user");
      return { success: false, error: "App not installed for user" };
    }

    const installationId = installations.value[0].id;
    console.log("[Graph] Found installation ID:", installationId);

    const notification = {
      topic: {
        source: "entityUrl",
        value: `https://graph.microsoft.com/v1.0/users/${payload.userId}/teamwork/installedApps/${installationId}`,
      },
      activityType: "taskCreated",
      previewText: {
        content: payload.body,
      },
      templateParameters: [
        {
          name: "title",
          value: payload.title,
        },
      ],
    };

    console.log("[Graph] Sending notification to Graph API");

    await client
      .api(`/users/${payload.userId}/teamwork/sendActivityNotification`)
      .post(notification);

    console.log("[Graph] Notification sent successfully to:", payload.userId);
    return { success: true };
  } catch (err: any) {
    console.error("[Graph] Failed to send notification:", err);
    console.error("[Graph] Error details:", err.message || err);
    console.error("[Graph] Error code:", err.code);
    console.error("[Graph] Error statusCode:", err.statusCode);
    if (err.body) {
      console.error("[Graph] Error body:", JSON.stringify(err.body));
    }
    return {
      success: false,
      error: err.message || err.body?.error?.message || String(err)
    };
  }
}
