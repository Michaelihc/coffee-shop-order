import crypto from "crypto";
import type { UserContext } from "../middleware/identity";

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface JwtClaims {
  aud?: string | string[];
  exp?: number;
  iat?: number;
  iss?: string;
  name?: string;
  nbf?: number;
  oid?: string;
  preferred_username?: string;
  sub?: string;
  tid?: string;
  unique_name?: string;
  upn?: string;
}

interface OpenIdConfiguration {
  issuer: string;
  jwks_uri: string;
}

interface SigningKey extends crypto.JsonWebKey {
  kid?: string;
}

interface CachedValue<T> {
  expiresAt: number;
  value: T;
}

const CLOCK_SKEW_SECONDS = 300;
const CACHE_TTL_MS = 60 * 60 * 1000;

let openIdCache: CachedValue<OpenIdConfiguration> | null = null;
let jwksCache: CachedValue<Map<string, SigningKey>> | null = null;

function base64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function decodeJson<T>(value: string): T {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
}

function getAllowedAudiences(): string[] {
  const clientId = process.env.AAD_APP_CLIENT_ID?.trim();
  if (!clientId) {
    return [];
  }

  const values = new Set<string>([clientId, `api://${clientId}`]);
  const tabDomain = process.env.TAB_DOMAIN?.trim();
  if (tabDomain) {
    values.add(`api://${tabDomain}/${clientId}`);
  }
  const appIdUri = process.env.AAD_APP_ID_URI?.trim();
  if (appIdUri) {
    values.add(appIdUri);
  }

  return [...values];
}

function isAudienceValid(audience: string | string[] | undefined): boolean {
  const allowed = getAllowedAudiences();
  if (allowed.length === 0 || !audience) {
    return false;
  }

  const audiences = Array.isArray(audience) ? audience : [audience];
  return audiences.some((value) => allowed.includes(value));
}

function isIssuerValid(issuer: string | undefined, tenantId: string): boolean {
  if (!issuer) {
    return false;
  }

  const normalized = issuer.toLowerCase();
  const accepted = [
    `https://login.microsoftonline.com/${tenantId.toLowerCase()}/v2.0`,
    `https://sts.windows.net/${tenantId.toLowerCase()}/`,
  ];

  return accepted.includes(normalized);
}

function verifyTimeWindow(claims: JwtClaims): boolean {
  const now = Math.floor(Date.now() / 1000);

  if (!claims.exp || claims.exp < now - CLOCK_SKEW_SECONDS) {
    return false;
  }
  if (claims.nbf && claims.nbf > now + CLOCK_SKEW_SECONDS) {
    return false;
  }

  return true;
}

async function fetchOpenIdConfiguration(tenantId: string): Promise<OpenIdConfiguration> {
  const now = Date.now();
  if (openIdCache && openIdCache.expiresAt > now) {
    return openIdCache.value;
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
  );
  if (!response.ok) {
    throw new Error("Failed to load OpenID configuration");
  }

  const config = (await response.json()) as OpenIdConfiguration;
  openIdCache = {
    value: config,
    expiresAt: now + CACHE_TTL_MS,
  };

  return config;
}

async function fetchJwks(tenantId: string): Promise<Map<string, SigningKey>> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.value;
  }

  const config = await fetchOpenIdConfiguration(tenantId);
  const response = await fetch(config.jwks_uri);
  if (!response.ok) {
    throw new Error("Failed to load signing keys");
  }

  const payload = (await response.json()) as { keys?: SigningKey[] };
  const keys = new Map<string, SigningKey>();
  for (const jwk of payload.keys ?? []) {
    if (jwk.kid) {
      keys.set(jwk.kid, jwk);
    }
  }

  jwksCache = {
    value: keys,
    expiresAt: now + CACHE_TTL_MS,
  };

  return keys;
}

function verifySignature(token: string, header: JwtHeader, jwk: SigningKey): boolean {
  if (!header.alg || !["RS256", "RS384", "RS512"].includes(header.alg)) {
    return false;
  }

  const algorithmMap: Record<string, string> = {
    RS256: "RSA-SHA256",
    RS384: "RSA-SHA384",
    RS512: "RSA-SHA512",
  };

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const verifier = crypto.createVerify(algorithmMap[header.alg]);
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const key = crypto.createPublicKey({
    key: jwk,
    format: "jwk",
  });

  return verifier.verify(key, base64UrlToBuffer(encodedSignature));
}

export async function authenticateBearerToken(
  token: string,
  locale?: string
): Promise<UserContext | null> {
  const tenantId = process.env.TEAMS_APP_TENANT_ID?.trim();
  const clientId = process.env.AAD_APP_CLIENT_ID?.trim();
  if (!tenantId || !clientId) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const header = decodeJson<JwtHeader>(parts[0]);
  const claims = decodeJson<JwtClaims>(parts[1]);

  if (!header.kid || !verifyTimeWindow(claims) || !isAudienceValid(claims.aud)) {
    return null;
  }
  if (claims.tid?.toLowerCase() !== tenantId.toLowerCase()) {
    return null;
  }
  if (!isIssuerValid(claims.iss, tenantId)) {
    return null;
  }

  const jwks = await fetchJwks(tenantId);
  const key = jwks.get(header.kid);
  if (!key || !verifySignature(token, header, key)) {
    return null;
  }

  const userId = claims.oid || claims.sub;
  const userName =
    claims.name ||
    claims.preferred_username ||
    claims.unique_name ||
    claims.upn;

  if (!userId || !userName) {
    return null;
  }

  return {
    userId,
    userName,
    locale,
  };
}
