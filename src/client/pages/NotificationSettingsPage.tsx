import React from "react";
import {
  Switch,
  Button,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
  type NotificationType,
} from "../hooks/useNotifications";
import { useRole } from "../hooks/useRole";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    margin: 0,
  },
  card: {
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    margin: 0,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  labelText: {
    fontSize: tokens.fontSizeBase300,
  },
  labelDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

interface NotifTypeConfig {
  key: NotificationType;
  labelKey: string;
  descKey: string;
  roles: Array<"student" | "staff" | "admin">;
}

const NOTIF_TYPES: NotifTypeConfig[] = [
  {
    key: "order_confirmed",
    labelKey: "notifications.orderConfirmed",
    descKey: "notifications.orderConfirmedDesc",
    roles: ["student"],
  },
  {
    key: "order_preparing",
    labelKey: "notifications.orderPreparing",
    descKey: "notifications.orderPreparingDesc",
    roles: ["student"],
  },
  {
    key: "order_ready",
    labelKey: "notifications.orderReady",
    descKey: "notifications.orderReadyDesc",
    roles: ["student"],
  },
  {
    key: "order_cancelled",
    labelKey: "notifications.orderCancelled",
    descKey: "notifications.orderCancelledDesc",
    roles: ["student"],
  },
  {
    key: "window_ending_soon",
    labelKey: "notifications.windowEndingSoon",
    descKey: "notifications.windowEndingSoonDesc",
    roles: ["student"],
  },
  {
    key: "new_order",
    labelKey: "notifications.newOrder",
    descKey: "notifications.newOrderDesc",
    roles: ["staff", "admin"],
  },
  {
    key: "order_ready_staff",
    labelKey: "notifications.orderReadyStaff",
    descKey: "notifications.orderReadyStaffDesc",
    roles: ["staff", "admin"],
  },
  {
    key: "low_stock",
    labelKey: "notifications.lowStock",
    descKey: "notifications.lowStockDesc",
    roles: ["staff", "admin"],
  },
  {
    key: "window_near_capacity",
    labelKey: "notifications.nearCapacity",
    descKey: "notifications.nearCapacityDesc",
    roles: ["staff", "admin"],
  },
  {
    key: "window_over_capacity",
    labelKey: "notifications.overCapacity",
    descKey: "notifications.overCapacityDesc",
    roles: ["staff", "admin"],
  },
];

export function NotificationSettingsPage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { role } = useRole();
  const { prefs, updatePrefs, toggleType, requestBrowserPermission } =
    useNotifications();

  const isStaff = role === "staff" || role === "admin";

  const visibleTypes = NOTIF_TYPES.filter((nt) =>
    isStaff ? nt.roles.includes("staff") || nt.roles.includes("admin") : nt.roles.includes("student"),
  );

  const browserPermission =
    typeof Notification !== "undefined" ? Notification.permission : "denied";

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("notifications.settings")}</h2>

      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.labelText}>{t("notifications.enabled")}</span>
          <Switch
            checked={prefs.enabled}
            onChange={(_, data) => updatePrefs({ enabled: data.checked })}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.label}>
            <span className={styles.labelText}>
              {t("notifications.browserNotify")}
            </span>
            <span className={styles.labelDesc}>
              {browserPermission === "granted"
                ? t("notifications.browserGranted")
                : t("notifications.browserNotGranted")}
            </span>
          </div>
          {browserPermission === "granted" ? (
            <Switch
              checked={prefs.browserNotifications}
              onChange={(_, data) =>
                updatePrefs({ browserNotifications: data.checked })
              }
              disabled={!prefs.enabled}
            />
          ) : (
            <Button
              appearance="primary"
              size="small"
              onClick={requestBrowserPermission}
              disabled={!prefs.enabled || browserPermission === "denied"}
            >
              {t("notifications.requestPermission")}
            </Button>
          )}
        </div>
      </div>

      <h3 className={styles.sectionTitle}>
        {t("notifications.notificationTypes")}
      </h3>

      <div className={styles.card}>
        {visibleTypes.map((nt) => (
          <div key={nt.key} className={styles.row}>
            <div className={styles.label}>
              <span className={styles.labelText}>{t(nt.labelKey)}</span>
              <span className={styles.labelDesc}>{t(nt.descKey)}</span>
            </div>
            <Switch
              checked={prefs.types[nt.key]}
              onChange={(_, data) => toggleType(nt.key, data.checked)}
              disabled={!prefs.enabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
