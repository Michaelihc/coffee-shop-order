import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Button,
  Badge,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
} from "../hooks/useNotifications";

const useStyles = makeStyles({
  wrapper: {
    position: "relative",
  },
  list: {
    maxHeight: "360px",
    overflow: "auto",
    minWidth: "280px",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "8px 12px",
  },
  itemTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  itemBody: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  itemTime: {
    fontSize: "10px",
    color: tokens.colorNeutralForeground4,
  },
  unread: {
    borderLeft: "3px solid #DDAF6B",
  },
  empty: {
    padding: "16px",
    textAlign: "center" as const,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  badge: {
    position: "absolute",
    top: "-2px",
    right: "-2px",
  },
});

function timeAgo(ts: number, t: (k: string, p?: Record<string, unknown>) => string): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return t("notifications.justNow");
  const mins = Math.floor(diff / 60);
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  return t("notifications.hoursAgo", { count: hrs });
}

export function NotificationCenter() {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } =
    useNotifications();
  const [open, setOpen] = useState(false);

  function handleNotificationClick(id: string, targetPath?: string) {
    markRead(id);

    if (targetPath) {
      setOpen(false);
      setTimeout(() => navigate(targetPath), 100);
    }
  }

  return (
    <div className={styles.wrapper}>
      <Menu open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            size="small"
            style={{
              color: "rgba(255,249,243,0.85)",
              minWidth: "auto",
              position: "relative",
            }}
          >
            {"\u{1F514}"}
            {unreadCount > 0 && (
              <Badge
                size="small"
                appearance="filled"
                className={styles.badge}
                style={{ backgroundColor: "#c43e1c", color: "#fff" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                {t("notifications.noNotifications")}
              </div>
            ) : (
              <MenuList>
                {notifications.slice(0, 20).map((n) => (
                  <MenuItem
                    key={n.id}
                    className={n.read ? undefined : styles.unread}
                    onClick={() => handleNotificationClick(n.id, n.targetPath)}
                  >
                    <div className={styles.item}>
                      <span className={styles.itemTitle}>{t(n.titleKey)}</span>
                      <span className={styles.itemBody}>
                        {t(n.bodyKey, n.bodyParams ?? {})}
                      </span>
                      <span className={styles.itemTime}>
                        {timeAgo(n.timestamp, t)}
                      </span>
                    </div>
                  </MenuItem>
                ))}
              </MenuList>
            )}
          </div>
          <MenuDivider />
          <MenuList>
            {unreadCount > 0 && (
              <MenuItem onClick={markAllRead}>
                {t("notifications.markAllRead")}
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                setOpen(false);
                setTimeout(() => navigate("/settings/notifications"), 100);
              }}
            >
              {t("notifications.settings")}
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
