import React, { useState, useEffect, useCallback, useRef } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api } from "../api-client";
import { useNotifications, type DashboardStatsForNotif } from "../hooks/useNotifications";

interface DashboardStats {
  ordersToday: number;
  completedToday: number;
  pendingOrders: number;
  readyForPickup: number;
  cancelledToday: number;
  revenueToday: number;
  avgOrderValue: number;
  itemsSoldToday: number;
  topItems: { name: string; sold: number }[];
  lowStockItems: { name: string; stock: number }[];
  windowStats: { label: string; load: number; cap: number; status: string }[];
  hourlyOrders: { hour: string; count: number }[];
}

const useStyles = makeStyles({
  sidebar: {
    width: "360px",
    minWidth: "360px",
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  headerTitle: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase500,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: "20px",
    cursor: "pointer",
    padding: "4px 8px",
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  statCard: {
    padding: "12px",
    borderRadius: "10px",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },
  statLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingBottom: "4px",
  },
  topItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  topItemBar: {
    height: "4px",
    borderRadius: "2px",
    backgroundColor: tokens.colorBrandForeground2,
    marginTop: "2px",
  },
  lowStock: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: tokens.fontSizeBase200,
    padding: "4px 8px",
    borderRadius: "6px",
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground2,
  },
  windowRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  windowBar: {
    flex: 1,
    height: "8px",
    borderRadius: "4px",
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: "hidden",
  },
  windowFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  hourlyChart: {
    display: "flex",
    alignItems: "flex-end",
    gap: "4px",
    height: "60px",
  },
  hourBar: {
    flex: 1,
    borderRadius: "3px 3px 0 0",
    backgroundColor: tokens.colorBrandBackground,
    minWidth: "8px",
    position: "relative",
  },
  hourLabel: {
    fontSize: "9px",
    color: tokens.colorNeutralForeground3,
    textAlign: "center" as const,
    marginTop: "2px",
  },
});

function formatYen(cents: number): string {
  return `¥${(cents / 100).toFixed(0)}`;
}

function windowColor(status: string): string {
  if (status === "over-capacity") return tokens.colorPaletteRedBackground3;
  if (status === "near-capacity") return tokens.colorPaletteDarkOrangeBackground3;
  if (status === "busy") return tokens.colorPaletteYellowBackground3;
  return tokens.colorPaletteGreenBackground3;
}

interface DashboardPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DashboardPanel({ open, onClose }: DashboardPanelProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { checkDashboard } = useNotifications();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const prevStatsRef = useRef<DashboardStatsForNotif | null>(null);

  const fetchStats = useCallback(() => {
    api.get<DashboardStats>("/api/admin/dashboard").then((data) => {
      const forNotif: DashboardStatsForNotif = {
        lowStockItems: data.lowStockItems,
        windowStats: data.windowStats,
      };
      checkDashboard(prevStatsRef.current, forNotif);
      prevStatsRef.current = forNotif;
      setStats(data);
    });
  }, [checkDashboard]);

  useEffect(() => {
    if (!open) return;
    fetchStats();
    const timer = setInterval(fetchStats, 10000);
    return () => clearInterval(timer);
  }, [open, fetchStats]);

  if (!open) return null;

  const maxSold = stats?.topItems.reduce((m, i) => Math.max(m, i.sold), 0) ?? 1;
  const maxHourly = stats?.hourlyOrders.reduce((m, h) => Math.max(m, h.count), 0) ?? 1;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t("dashboard.title")}</span>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.body}>
        {!stats ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px",
                color: tokens.colorNeutralForeground3,
              }}
            >
              {t("common.loading")}
            </div>
          ) : (
            <>
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.ordersToday}</span>
                  <span className={styles.statLabel}>{t("dashboard.ordersToday")}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{formatYen(stats.revenueToday)}</span>
                  <span className={styles.statLabel}>{t("dashboard.revenue")}</span>
                </div>
                <div className={styles.statCard}>
                  <span
                    className={styles.statValue}
                    style={{ color: tokens.colorPaletteDarkOrangeForeground2 }}
                  >
                    {stats.pendingOrders}
                  </span>
                  <span className={styles.statLabel}>{t("dashboard.pending")}</span>
                </div>
                <div className={styles.statCard}>
                  <span
                    className={styles.statValue}
                    style={{ color: tokens.colorPaletteGreenForeground2 }}
                  >
                    {stats.readyForPickup}
                  </span>
                  <span className={styles.statLabel}>{t("dashboard.ready")}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.completedToday}</span>
                  <span className={styles.statLabel}>{t("dashboard.completed")}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{formatYen(stats.avgOrderValue)}</span>
                  <span className={styles.statLabel}>{t("dashboard.avgOrder")}</span>
                </div>
              </div>

              {stats.topItems.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>{t("dashboard.topItems")}</div>
                  {stats.topItems.map((item) => (
                    <div key={item.name}>
                      <div className={styles.topItem}>
                        <span>{item.name}</span>
                        <span>{t("dashboard.sold", { count: item.sold })}</span>
                      </div>
                      <div
                        className={styles.topItemBar}
                        style={{ width: `${(item.sold / maxSold) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {stats.lowStockItems.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>{t("dashboard.lowStockAlerts")}</div>
                  {stats.lowStockItems.map((item) => (
                    <div key={item.name} className={styles.lowStock}>
                      <span>{item.name}</span>
                      <span>{t("dashboard.left", { count: item.stock })}</span>
                    </div>
                  ))}
                </div>
              )}

              {stats.windowStats.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>{t("dashboard.windowLoad")}</div>
                  {stats.windowStats.map((w) => (
                    <div key={w.label} className={styles.windowRow}>
                      <span style={{ minWidth: "60px" }}>{w.label}</span>
                      <div className={styles.windowBar}>
                        <div
                          className={styles.windowFill}
                          style={{
                            width: `${Math.min((w.load / (w.cap || 1)) * 100, 100)}%`,
                            backgroundColor: windowColor(w.status),
                          }}
                        />
                      </div>
                      <span style={{ minWidth: "40px", textAlign: "right" }}>
                        {w.load}/{w.cap}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {stats.hourlyOrders.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>{t("dashboard.hourlyActivity")}</div>
                  <div className={styles.hourlyChart}>
                    {stats.hourlyOrders.map((h) => (
                      <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div
                          className={styles.hourBar}
                          style={{ height: `${(h.count / maxHourly) * 100}%` }}
                          title={t("dashboard.hourlyTooltip", { hour: h.hour, count: h.count })}
                        />
                        <span className={styles.hourLabel}>{h.hour}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
  );
}
