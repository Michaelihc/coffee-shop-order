import React, { useState, useCallback } from "react";
import {
  Button,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { usePoller } from "../../hooks/usePoller";
import {
  downloadAuthenticatedFile,
  fetchBalanceReport,
  fetchSpendingReport,
} from "../../admin-api";
import type {
  StudentBalanceReportRow,
  StudentSpendingReportRow,
} from "../../../types/api";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "800px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    margin: 0,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  sectionCard: {
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionHeading: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    margin: 0,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  summaryCard: {
    padding: "12px",
    borderRadius: "10px",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  summaryValue: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
  },
  summaryLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  td: {
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: tokens.fontSizeBase300,
  },
  totalRow: {
    fontWeight: tokens.fontWeightBold,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  empty: {
    textAlign: "center" as const,
    padding: "32px",
    color: tokens.colorNeutralForeground3,
  },
  note: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
});

export function ReportsPage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const [balances, setBalances] = useState<StudentBalanceReportRow[]>([]);
  const [totalDueCents, setTotalDueCents] = useState(0);
  const [spending, setSpending] = useState<StudentSpendingReportRow[]>([]);
  const [totalTodaySpendCents, setTotalTodaySpendCents] = useState(0);
  const [totalLifetimeSpendCents, setTotalLifetimeSpendCents] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([
      fetchBalanceReport(),
      fetchSpendingReport(),
    ])
      .then(([balanceData, spendingData]) => {
        setBalances(balanceData.balances);
        setTotalDueCents(balanceData.totalDueCents);
        setSpending(spendingData.spending);
        setTotalTodaySpendCents(spendingData.totalTodaySpendCents);
        setTotalLifetimeSpendCents(spendingData.totalLifetimeSpendCents);
      })
      .finally(() => setLoading(false));
  }, []);

  usePoller(fetchData, 30000);

  async function handleExportCsv() {
    await downloadAuthenticatedFile(
      "/api/admin/reports/balance/csv",
      "student-balances.csv"
    );
  }

  async function handleExportSpendingCsv() {
    await downloadAuthenticatedFile(
      "/api/admin/reports/spending/csv",
      "student-spending.csv"
    );
  }

  if (loading) return <Spinner label={t("reports.loading")} />;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>{t("reports.title")}</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button appearance="secondary" size="small" onClick={fetchData}>
            {t("reports.refresh")}
          </Button>
          <Button appearance="primary" size="small" onClick={handleExportCsv}>
            {t("reports.exportBalancesCsv")}
          </Button>
          <Button appearance="secondary" size="small" onClick={handleExportSpendingCsv}>
            {t("reports.exportSpendingCsv")}
          </Button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>
            &yen;{(totalDueCents / 100).toFixed(2)}
          </span>
          <span className={styles.summaryLabel}>{t("reports.totalOutstanding")}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>
            &yen;{(totalTodaySpendCents / 100).toFixed(2)}
          </span>
          <span className={styles.summaryLabel}>{t("reports.totalSpentToday")}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>
            &yen;{(totalLifetimeSpendCents / 100).toFixed(2)}
          </span>
          <span className={styles.summaryLabel}>{t("reports.totalLifetimeSpend")}</span>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionHeading}>{t("reports.balanceTitle")}</h3>
        <p className={styles.note}>{t("reports.description")}</p>

        {balances.length === 0 ? (
          <div className={styles.empty}>{t("reports.noBalances")}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>{t("reports.student")}</th>
                <th className={styles.th}>{t("reports.orders")}</th>
                <th className={styles.th}>{t("reports.amountDue")}</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.studentAadId}>
                  <td className={styles.td}>{b.studentName}</td>
                  <td className={styles.td}>{b.orderCount}</td>
                  <td className={styles.td}>
                    &yen;{(b.totalDueCents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td className={styles.td}>{t("reports.total")}</td>
                <td className={styles.td}>
                  {balances.reduce((s, b) => s + b.orderCount, 0)}
                </td>
                <td className={styles.td}>
                  &yen;{(totalDueCents / 100).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionHeading}>{t("reports.spendingTitle")}</h3>
        <p className={styles.note}>{t("reports.spendingDescription")}</p>

        {spending.length === 0 ? (
          <div className={styles.empty}>{t("reports.noSpending")}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>{t("reports.student")}</th>
                <th className={styles.th}>{t("reports.orders")}</th>
                <th className={styles.th}>{t("reports.spentToday")}</th>
                <th className={styles.th}>{t("reports.lifetimeSpend")}</th>
              </tr>
            </thead>
            <tbody>
              {spending.map((row) => (
                <tr key={row.studentAadId}>
                  <td className={styles.td}>{row.studentName}</td>
                  <td className={styles.td}>{row.orderCount}</td>
                  <td className={styles.td}>
                    &yen;{(row.todaySpendCents / 100).toFixed(2)}
                  </td>
                  <td className={styles.td}>
                    &yen;{(row.totalSpendCents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td className={styles.td}>{t("reports.total")}</td>
                <td className={styles.td}>
                  {spending.reduce((sum, row) => sum + row.orderCount, 0)}
                </td>
                <td className={styles.td}>
                  &yen;{(totalTodaySpendCents / 100).toFixed(2)}
                </td>
                <td className={styles.td}>
                  &yen;{(totalLifetimeSpendCents / 100).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
