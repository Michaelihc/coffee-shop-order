import { Client } from "@microsoft/microsoft-graph-client";

let graphClient: Client | null = null;

export interface GraphAppCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  teamsAppId: string;
}

export function getGraphAppCredentials(): GraphAppCredentials | null {
  const tenantId = process.env.TEAMS_APP_TENANT_ID?.trim();
  const clientId = process.env.AAD_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.AAD_APP_CLIENT_SECRET?.trim();
  const teamsAppId = process.env.TEAMS_APP_ID?.trim();

  if (!tenantId || !clientId || !clientSecret || !teamsAppId) {
    return null;
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    teamsAppId,
  };
}

export async function getGraphAccessToken(): Promise<string | null> {
  const credentials = getGraphAppCredentials();
  if (!credentials) {
    return null;
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json();

    return typeof data.access_token === "string" ? data.access_token : null;
  } catch {
    return null;
  }
}

export function getGraphClient(): Client {
  if (!graphClient) {
    graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await getGraphAccessToken();
          if (!token) {
            throw new Error("Failed to get access token");
          }
          return token;
        },
      },
    });
  }

  return graphClient;
}
