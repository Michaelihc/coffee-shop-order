import React from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import type { Theme } from "@fluentui/react-components";
import { resolveTheme } from "./coffee-theme";
import { app, authentication } from "@microsoft/teams-js";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./global.css";
import { TeamsContextProvider } from "./hooks/useTeamsContext";
import {
  clearUserHeaders,
  setAccessTokenProvider,
  setUserHeaders,
} from "./api-client";
import { pushAuthDebug } from "./auth-debug";
import { initI18n } from "./i18n";

let cachedAccessToken: string | undefined;

function applyDocumentTheme(teamsTheme: string | undefined) {
  const normalizedTheme =
    teamsTheme === "dark" || teamsTheme === "contrast" ? teamsTheme : "light";
  document.documentElement.dataset.appTheme = normalizedTheme;
}

function summarizeToken(token: string): string {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized + "=".repeat(4 - (normalized.length % 4));
    const claims = JSON.parse(atob(padded)) as {
      aud?: string | string[];
      oid?: string;
      sub?: string;
      tid?: string;
    };

    const aud = Array.isArray(claims.aud) ? claims.aud.join(",") : claims.aud;
    return `aud=${aud ?? "n/a"} tid=${claims.tid ?? "n/a"} oid=${claims.oid ?? claims.sub ?? "n/a"}`;
  } catch {
    return "token-present";
  }
}

async function getTeamsAccessToken(options?: { allowPrompt?: boolean }) {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  try {
    cachedAccessToken = await authentication.getAuthToken({ silent: true });
    pushAuthDebug("Auth debug", `silent token ok ${summarizeToken(cachedAccessToken)}`);
    return cachedAccessToken;
  } catch (error) {
    pushAuthDebug(
      "Auth debug",
      `silent token failed ${error instanceof Error ? error.message : String(error)}`
    );
    if (options?.allowPrompt === false) {
      return undefined;
    }
  }

  try {
    cachedAccessToken = await authentication.getAuthToken();
    pushAuthDebug("Auth debug", `interactive token ok ${summarizeToken(cachedAccessToken)}`);
    return cachedAccessToken;
  } catch (error) {
    pushAuthDebug(
      "Auth debug",
      `interactive token failed ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

function ThemedApp({
  initialTheme,
  teamsContext,
}: {
  initialTheme: Theme;
  teamsContext: app.Context | null;
}) {
  const [theme, setTheme] = React.useState(initialTheme);
  const initialTeamsTheme = teamsContext?.app?.theme;

  React.useEffect(() => {
    applyDocumentTheme(initialTeamsTheme);

    // Listen for live theme changes when user switches Teams appearance
    try {
      app.registerOnThemeChangeHandler((newTheme: string) => {
        applyDocumentTheme(newTheme);
        setTheme(resolveTheme(newTheme));
      });
    } catch {
      // Not in Teams — ignore
    }
  }, [initialTeamsTheme]);

  return (
    <FluentProvider theme={theme}>
      <TeamsContextProvider context={teamsContext}>
        <BrowserRouter basename="/app">
          <App />
        </BrowserRouter>
      </TeamsContextProvider>
    </FluentProvider>
  );
}

async function init() {
  let teamsContext: app.Context | null = null;
  let useLocalHeaderFallback = false;
  let fallbackUserId = "dev-user";
  let fallbackUserName = "Dev Student";

  try {
    await app.initialize();
    teamsContext = await app.getContext();
    app.notifySuccess();
    pushAuthDebug(
      "Auth debug",
      `teams context ok user=${teamsContext.user?.id || "missing"} host=${window.location.hostname}`
    );

    const userId = teamsContext.user?.id || "";
    const userName =
      teamsContext.user?.displayName ||
      teamsContext.user?.userPrincipalName ||
      "";
    if (userId) {
      setAccessTokenProvider(() => getTeamsAccessToken({ allowPrompt: false }));

      const initialToken = await getTeamsAccessToken();

      if (!initialToken && window.location.hostname === "localhost") {
        useLocalHeaderFallback = true;
        fallbackUserId = userId;
        fallbackUserName = userName;
        pushAuthDebug("Auth debug", "using localhost header fallback");
      } else {
        clearUserHeaders();
        if (!initialToken) {
          pushAuthDebug(
            "Auth debug",
            "no initial token and no localhost fallback; API calls will likely 401"
          );
        }
      }
    }
  } catch (error) {
    pushAuthDebug(
      "Auth debug",
      `teams initialization failed ${error instanceof Error ? error.message : String(error)}`
    );
    // Running outside Teams — use defaults for dev
    useLocalHeaderFallback = true;
  }

  if (useLocalHeaderFallback) {
    setAccessTokenProvider(null);
    cachedAccessToken = undefined;
    setUserHeaders(fallbackUserId, fallbackUserName);
  }

  await initI18n(teamsContext?.app?.locale);

  const initialTheme = resolveTheme(teamsContext?.app?.theme);
  applyDocumentTheme(teamsContext?.app?.theme);

  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <ThemedApp initialTheme={initialTheme} teamsContext={teamsContext} />
    </React.StrictMode>
  );
}

init();
