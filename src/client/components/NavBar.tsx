import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FluentProvider,
  Tab,
  TabList,
  Badge,
  Button,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCart } from "../hooks/useCart";
import { coffeeDarkTheme, coffeeHighContrastTheme } from "../coffee-theme";
import { useTeamsContext } from "../hooks/useTeamsContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationCenter } from "./NotificationCenter";
import type { Role } from "../hooks/useRole";

const useStyles = makeStyles({
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderBottom: "none",
    backgroundColor: "var(--coffee-nav-background)",
    color: "var(--coffee-nav-foreground)",
  },
  title: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase500,
    marginRight: "16px",
    color: "var(--coffee-nav-accent)",
    letterSpacing: "0.5px",
  },
  tabList: {
    backgroundColor: "transparent",
  },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  dashboardButton: {
    position: "relative",
    color: "var(--coffee-nav-muted) !important",
    borderRadius: "12px",
    border: "1px solid transparent !important",
    outlineStyle: "none",
    boxShadow: "none !important",
    WebkitTapHighlightColor: "transparent",
    ":hover": {
      color: "var(--coffee-nav-foreground) !important",
      backgroundColor: "transparent !important",
    },
    ":active": {
      backgroundColor: "transparent !important",
      boxShadow: "none !important",
    },
    ":focus": {
      outline: "none",
      boxShadow: "none !important",
    },
    ":focus-visible": {
      outline: "2px solid var(--coffee-nav-focus-ring)",
      outlineOffset: "2px",
      boxShadow: "0 0 0 1px var(--coffee-nav-background) !important",
    },
  },
  selectedDashboardButton: {
    color: "var(--coffee-nav-foreground) !important",
    fontWeight: tokens.fontWeightBold,
    backgroundColor: "transparent !important",
    border: "1px solid transparent !important",
    boxShadow: "none !important",
    "::before": {
      content: '""',
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: "4px",
      width: "60px",
      height: "3px",
      borderRadius: "999px",
      backgroundColor: "rgba(255, 246, 238, 0.42)",
      pointerEvents: "none",
    },
    "::after": {
      content: '""',
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: "5px",
      width: "38px",
      height: "3px",
      borderRadius: "999px",
      backgroundColor: "var(--coffee-nav-accent)",
      pointerEvents: "none",
    },
  },
  userName: {
    fontSize: "12px",
    color: "var(--coffee-nav-muted)",
  },
});

interface NavBarProps {
  role: Role;
  displayName: string;
  userId: string;
  onToggleDashboard?: () => void;
  dashboardOpen?: boolean;
}

const studentTabs = [
  { value: "/", labelKey: "nav.menu" },
  { value: "/cart", labelKey: "nav.cart" },
  { value: "/orders", labelKey: "nav.myOrders" },
];

const staffTabs = [
  { value: "/staff", labelKey: "nav.queue" },
  { value: "/staff/grid", labelKey: "nav.grid" },
  { value: "/staff/inventory", labelKey: "nav.inventory" },
  { value: "/staff/config", labelKey: "nav.config" },
];

const adminTabs = [
  ...staffTabs,
  { value: "/staff/roles", labelKey: "nav.roles" },
  { value: "/staff/reports", labelKey: "nav.reports" },
];

export function NavBar({ role, displayName, userId, onToggleDashboard, dashboardOpen }: NavBarProps) {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();
  const { t } = useTranslation();
  const { context } = useTeamsContext();

  const isStaff = role === "staff" || role === "admin";
  const tabs = role === "admin" ? adminTabs : isStaff ? staffTabs : studentTabs;
  const navTabTheme =
    context?.app?.theme === "contrast" ? coffeeHighContrastTheme : coffeeDarkTheme;

  const selectedTab = tabs.find((t) => t.value === location.pathname)?.value;

  return (
    <nav className={styles.nav}>
      <span className={styles.title}>{t("nav.title")}</span>
      <FluentProvider theme={navTabTheme} style={{ background: "transparent" }}>
        <TabList
          selectedValue={selectedTab}
          onTabSelect={(_, data) => navigate(data.value as string)}
          size="small"
          className={styles.tabList}
        >
          {tabs.map((tab) => (
            <Tab key={tab.value} value={tab.value}>
              {t(tab.labelKey)}
              {tab.labelKey === "nav.cart" && itemCount > 0 && (
                <>
                  {" "}
                  <Badge
                    size="small"
                    appearance="filled"
                    style={{ backgroundColor: "var(--coffee-nav-accent)", color: "#3B2218" }}
                  >
                    {itemCount}
                  </Badge>
                </>
              )}
            </Tab>
          ))}
        </TabList>
      </FluentProvider>
      <div className={styles.rightGroup}>
        {isStaff && onToggleDashboard && (
          <Button
            appearance="subtle"
            size="small"
            onClick={onToggleDashboard}
            className={mergeClasses(
              styles.dashboardButton,
              dashboardOpen ? styles.selectedDashboardButton : undefined
            )}
          >
            {t("nav.dashboard")}
          </Button>
        )}
        <NotificationCenter />
        <LanguageSwitcher />
        <span className={styles.userName} title={userId ? `ID: ${userId}` : undefined}>
          {displayName}
        </span>
      </div>
    </nav>
  );
}
