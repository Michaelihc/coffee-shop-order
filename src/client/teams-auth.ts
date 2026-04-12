const TOKEN_EXPIRY_SKEW_MS = 60_000;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized + "=".repeat(4 - (normalized.length % 4));

    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getTokenExpiryTimestamp(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;

  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return null;
  }

  return exp * 1000;
}

export function isTokenUsable(token: string, now = Date.now()): boolean {
  const expiresAt = getTokenExpiryTimestamp(token);
  if (expiresAt === null) {
    return false;
  }

  return expiresAt - TOKEN_EXPIRY_SKEW_MS > now;
}
