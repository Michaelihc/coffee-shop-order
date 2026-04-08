/**
 * Teams Activity Feed Notification Service
 *
 * Sends notifications to users via Microsoft Teams Activity Feed.
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { getGraphAppCredentials, getGraphClient } from "./graph-auth-service";
import { logError, logWarn } from "./logger";

export interface TeamsNotificationPayload {
  userId: string;
  title: string;
  body: string;
}

/**
 * Send a Teams activity feed notification to a user.
 */
export async function sendTeamsNotification(
  payload: TeamsNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  const client: Client = getGraphClient();

  try {
    const credentials = getGraphAppCredentials();
    if (!credentials) {
      logWarn("graph.notification.missing_credentials", {
        hasTenantId: Boolean(process.env.TEAMS_APP_TENANT_ID),
        hasClientId: Boolean(process.env.AAD_APP_CLIENT_ID),
        hasClientSecret: Boolean(process.env.AAD_APP_CLIENT_SECRET),
        hasTeamsAppId: Boolean(process.env.TEAMS_APP_ID),
      });
      return { success: false, error: "Graph app credentials are not fully configured" };
    }

    // Get the installation ID for this user
    const installations = await client
      .api(`/users/${payload.userId}/teamwork/installedApps`)
      .filter(`teamsApp/externalId eq '${credentials.teamsAppId}'`)
      .get();

    if (!installations.value || installations.value.length === 0) {
      return { success: false, error: "App not installed for user" };
    }

    const installationId = installations.value[0].id;

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

    await client
      .api(`/users/${payload.userId}/teamwork/sendActivityNotification`)
      .post(notification);

    return { success: true };
  } catch (err: unknown) {
    const error = err as {
      message?: string;
      code?: string;
      statusCode?: number;
      body?: unknown;
    };
    logError("graph.notification.failed", {
      userId: payload.userId,
      title: payload.title,
      error: {
        message: error.message ?? String(err),
        code: error.code,
        statusCode: error.statusCode,
        body: error.body,
      },
    });
    return {
      success: false,
      error: error.message || String(err),
    };
  }
}
