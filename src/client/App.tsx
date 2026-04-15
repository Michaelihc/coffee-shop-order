import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { NavBar } from "./components/NavBar";
import { useRole } from "./hooks/useRole";
import { CartProvider } from "./hooks/useCart";
import { NotificationProvider } from "./hooks/useNotifications";
import { useTeamsContext } from "./hooks/useTeamsContext";
import {
  getTeamsDeepLinkSubPageId,
  resolveTeamsSubPagePath,
} from "./teams-deep-link";

const DashboardPanel = lazy(() =>
  import("./components/DashboardPanel").then((module) => ({
    default: module.DashboardPanel,
  }))
);
const MenuPage = lazy(() =>
  import("./pages/student/MenuPage").then((module) => ({
    default: module.MenuPage,
  }))
);
const CartPage = lazy(() =>
  import("./pages/student/CartPage").then((module) => ({
    default: module.CartPage,
  }))
);
const OrdersPage = lazy(() =>
  import("./pages/student/OrdersPage").then((module) => ({
    default: module.OrdersPage,
  }))
);
const QueuePage = lazy(() =>
  import("./pages/staff/QueuePage").then((module) => ({
    default: module.QueuePage,
  }))
);
const GridPage = lazy(() =>
  import("./pages/staff/GridPage").then((module) => ({
    default: module.GridPage,
  }))
);
const InventoryPage = lazy(() =>
  import("./pages/staff/InventoryPage").then((module) => ({
    default: module.InventoryPage,
  }))
);
const ConfigPage = lazy(() =>
  import("./pages/staff/ConfigPage").then((module) => ({
    default: module.ConfigPage,
  }))
);
const RolesPage = lazy(() =>
  import("./pages/staff/RolesPage").then((module) => ({
    default: module.RolesPage,
  }))
);
const ReportsPage = lazy(() =>
  import("./pages/staff/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  }))
);
const NotificationSettingsPage = lazy(() =>
  import("./pages/NotificationSettingsPage").then((module) => ({
    default: module.NotificationSettingsPage,
  }))
);

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
  routeFallback: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "240px",
  },
});

function TeamsDeepLinkNavigator({ isStaff }: { isStaff: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { context } = useTeamsContext();
  const targetPath = resolveTeamsSubPagePath(
    getTeamsDeepLinkSubPageId(context, location.search),
    isStaff
  );

  useEffect(() => {
    if (!targetPath || location.pathname === targetPath) {
      return;
    }

    navigate(targetPath, { replace: true });
  }, [location.pathname, navigate, targetPath]);

  return null;
}

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
  const routeFallback = (
    <div className={styles.routeFallback}>
      <Spinner size="large" label={t("common.loading")} />
    </div>
  );

  return (
    <CartProvider>
      <NotificationProvider>
        <div className={styles.container}>
          <TeamsDeepLinkNavigator isStaff={isStaff} />
          <NavBar
            role={role}
            displayName={displayName}
            userId={userId}
            onToggleDashboard={() => setDashboardOpen((v) => !v)}
            dashboardOpen={dashboardOpen}
          />
          <div className={styles.contentRow}>
            <main className={styles.main}>
              <Suspense fallback={routeFallback}>
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
              </Suspense>
            </main>
            {isStaff && (
              <Suspense fallback={null}>
                <DashboardPanel
                  open={dashboardOpen}
                  onClose={() => setDashboardOpen(false)}
                />
              </Suspense>
            )}
          </div>
        </div>
      </NotificationProvider>
    </CartProvider>
  );
}
