import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Tab,
  TabList,
  Badge,
  Button,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCart } from "../hooks/useCart";
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
    backgroundColor: "#3B2218",
    color: "#FFF9F3",
  },
  title: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase500,
    marginRight: "16px",
    color: "#DDAF6B",
    letterSpacing: "0.5px",
  },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  userName: {
    fontSize: "12px",
    color: "rgba(255,249,243,0.7)",
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

  const isStaff = role === "staff" || role === "admin";
  const tabs = role === "admin" ? adminTabs : isStaff ? staffTabs : studentTabs;

  const selectedTab =
    tabs.find((t) => t.value === location.pathname)?.value ||
    tabs[0].value;

  return (
    <nav className={styles.nav}>
      <span className={styles.title}>{t("nav.title")}</span>
      <TabList
        selectedValue={selectedTab}
        onTabSelect={(_, data) => navigate(data.value as string)}
        size="small"
        style={{ color: "#FFF9F3" }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            style={{
              color: selectedTab === tab.value ? "#DDAF6B" : "rgba(255,249,243,0.85)",
            }}
          >
            {t(tab.labelKey)}
            {tab.labelKey === "nav.cart" && itemCount > 0 && (
              <>
                {" "}
                <Badge
                  size="small"
                  appearance="filled"
                  style={{ backgroundColor: "#DDAF6B", color: "#3B2218" }}
                >
                  {itemCount}
                </Badge>
              </>
            )}
          </Tab>
        ))}
      </TabList>
      <div className={styles.rightGroup}>
        {isStaff && onToggleDashboard && (
          <Button
            appearance="subtle"
            size="small"
            onClick={onToggleDashboard}
            style={{
              color: dashboardOpen ? "#DDAF6B" : "rgba(255,249,243,0.85)",
              fontWeight: dashboardOpen ? 700 : 400,
            }}
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
