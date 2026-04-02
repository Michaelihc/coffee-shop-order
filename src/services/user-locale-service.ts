import { getDb } from "../db/connection";

export type SupportedLocale = "en" | "zh" | "ko";

const DEFAULT_LOCALE: SupportedLocale = "en";

function normalizeLocale(locale?: string | null): SupportedLocale {
  const lang = locale?.toLowerCase().split("-")[0];
  if (lang === "zh" || lang === "ko" || lang === "en") {
    return lang;
  }

  return DEFAULT_LOCALE;
}

function getLocaleKey(userId: string) {
  return `user-locale:${userId}`;
}

export function saveUserLocale(userId: string, locale?: string | null) {
  const db = getDb();
  const normalized = normalizeLocale(locale);

  db.prepare(
    `
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
  ).run(getLocaleKey(userId), normalized);
}

export function getUserLocale(userId: string): SupportedLocale {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(getLocaleKey(userId)) as { value?: string } | undefined;

  return normalizeLocale(row?.value);
}
