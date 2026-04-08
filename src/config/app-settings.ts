export const APP_SETTING_KEYS = [
  "max_items_per_order",
  "max_order_total_cents",
  "daily_spend_limit_cents",
  "enforce_window_cap",
] as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export const DEFAULT_APP_SETTINGS: Record<AppSettingKey, string> = {
  max_items_per_order: "10",
  max_order_total_cents: "25000",
  daily_spend_limit_cents: "30000",
  enforce_window_cap: "1",
};

export function isAppSettingKey(value: string): value is AppSettingKey {
  return (APP_SETTING_KEYS as readonly string[]).includes(value);
}
