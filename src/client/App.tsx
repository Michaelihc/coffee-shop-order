import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { NavBar } from "./components/NavBar";
import { DashboardPanel } from "./components/DashboardPanel";
import { useRole } from "./hooks/useRole";
import { CartProvider } from "./hooks/useCart";
import { NotificationProvider } from "./hooks/useNotifications";

// Student pages
import { MenuPage } from "./pages/student/MenuPage";
import { CartPage } from "./pages/student/CartPage";
import { OrdersPage } from "./pages/student/OrdersPage";

// Staff pages
import { QueuePage } from "./pages/staff/QueuePage";
import { GridPage } from "./pages/staff/GridPage";
import { InventoryPage } from "./pages/staff/InventoryPage";
import { ConfigPage } from "./pages/staff/ConfigPage";
import { RolesPage } from "./pages/staff/RolesPage";
import { ReportsPage } from "./pages/staff/ReportsPage";

// Shared pages
import { NotificationSettingsPage } from "./pages/NotificationSettingsPage";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  contentRow: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    overflow: "auto",
    padding: "16px",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
});

export function App() {
  const styles = useStyles();
  const { role, displayName, userId, loading } = useRole();
  const { t } = useTranslation();
  const [dashboardOpen, setDashboardOpen] = useState(false);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="large" label={t("common.loading")} />
      </div>
    );
  }

  const isStaff = role === "staff" || role === "admin";

  return (
    <CartProvider>
      <NotificationProvider>
        <div className={styles.container}>
          <NavBar
            role={role}
            displayName={displayName}
            userId={userId}
            onToggleDashboard={() => setDashboardOpen((v) => !v)}
            dashboardOpen={dashboardOpen}
          />
          <div className={styles.contentRow}>
            <main className={styles.main}>
              <Routes>
                {isStaff ? (
                  <>
                    <Route path="/" element={<QueuePage />} />
                    <Route path="/staff" element={<QueuePage />} />
                    <Route path="/staff/grid" element={<GridPage />} />
                    <Route path="/staff/inventory" element={<InventoryPage />} />
                    <Route path="/staff/config" element={<ConfigPage />} />
                    {role === "admin" && (
                      <Route path="/staff/roles" element={<RolesPage />} />
                    )}
                    {role === "admin" && (
                      <Route path="/staff/reports" element={<ReportsPage />} />
                    )}
                  </>
                ) : (
                  <>
                    <Route path="/" element={<MenuPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                  </>
                )}
                <Route
                  path="/settings/notifications"
                  element={<NotificationSettingsPage />}
                />
              </Routes>
            </main>
            {isStaff && (
              <DashboardPanel
                open={dashboardOpen}
                onClose={() => setDashboardOpen(false)}
              />
            )}
          </div>
        </div>
      </NotificationProvider>
    </CartProvider>
  );
}
