import { getDb } from "../db/connection";
import { APP_SETTING_KEYS, DEFAULT_APP_SETTINGS, type AppSettingKey } from "../config/app-settings";

export function getSetting(key: AppSettingKey): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getSettingInt(key: AppSettingKey, defaultValue: number): number {
  const val = getSetting(key);
  if (val === null) return defaultValue;
  const n = parseInt(val, 10);
  return isNaN(n) ? defaultValue : n;
}

export function setSetting(key: AppSettingKey, value: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

export function getAllSettings(): Record<AppSettingKey, string> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT key, value FROM settings WHERE key IN (${APP_SETTING_KEYS.map(() => "?").join(",")})`
    )
    .all(...APP_SETTING_KEYS) as { key: AppSettingKey; value: string }[];
  const result: Record<AppSettingKey, string> = { ...DEFAULT_APP_SETTINGS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
