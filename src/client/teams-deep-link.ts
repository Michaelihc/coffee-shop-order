import type { app } from "@microsoft/teams-js";

function normalizeSubPageId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/^\/+/, "");
  return normalized || null;
}

function getSubPageIdFromContext(context: app.Context | null): string | null {
  const page = context?.page as Record<string, unknown> | undefined;
  if (!page) {
    return null;
  }

  return (
    normalizeSubPageId(page.subPageId) ||
    normalizeSubPageId(page.subEntityId) ||
    null
  );
}

function getSubPageIdFromContextQuery(contextValue: string | null): string | null {
  if (!contextValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(contextValue) as Record<string, unknown>;
    return (
      normalizeSubPageId(parsed.subPageId) ||
      normalizeSubPageId(parsed.subEntityId) ||
      null
    );
  } catch {
    return null;
  }
}

function getSubPageIdFromWebUrl(webUrl: string | null): string | null {
  if (!webUrl) {
    return null;
  }

  try {
    const url = new URL(webUrl);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path.startsWith("/app")) {
      return null;
    }

    return normalizeSubPageId(path.slice("/app".length));
  } catch {
    return null;
  }
}

export function getTeamsDeepLinkSubPageId(
  context: app.Context | null,
  locationSearch: string
): string | null {
  const fromContext = getSubPageIdFromContext(context);
  if (fromContext) {
    return fromContext;
  }

  const params = new URLSearchParams(locationSearch);
  return (
    normalizeSubPageId(params.get("subPageId")) ||
    normalizeSubPageId(params.get("subEntityId")) ||
    getSubPageIdFromContextQuery(params.get("context")) ||
    getSubPageIdFromWebUrl(params.get("webUrl")) ||
    null
  );
}

export function resolveTeamsSubPagePath(
  subPageId: string | null,
  isStaff: boolean
): string | null {
  if (!subPageId) {
    return null;
  }

  if (subPageId === "orders" && !isStaff) {
    return "/orders";
  }

  if (subPageId === "notifications") {
    return "/settings/notifications";
  }

  return null;
}

export function getTeamsDeepLinkNavigationDecision(
  targetPath: string | null,
  currentPath: string,
  hasHandledDeepLink: boolean
): { shouldConsume: boolean; navigateTo: string | null } {
  if (!targetPath || hasHandledDeepLink) {
    return {
      shouldConsume: false,
      navigateTo: null,
    };
  }

  return {
    shouldConsume: true,
    navigateTo: currentPath === targetPath ? null : targetPath,
  };
}
