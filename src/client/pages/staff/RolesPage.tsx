import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Input,
  Dropdown,
  Option,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api } from "../../api-client";
import type { AdminStaffResponse } from "../../../types/api";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "700px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    margin: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  td: {
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  idCell: {
    fontSize: tokens.fontSizeBase100,
    fontFamily: "monospace",
    color: tokens.colorNeutralForeground3,
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  addForm: {
    display: "flex",
    gap: "8px",
    alignItems: "end",
    flexWrap: "wrap" as const,
    padding: "12px",
    borderRadius: "8px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  fieldLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    gap: "4px",
  },
});

interface StaffMember {
  aadId: string;
  displayName: string;
  role: "staff" | "admin";
}

export function RolesPage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add form
  const [newAadId, setNewAadId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"staff" | "admin">("staff");
  const [adding, setAdding] = useState(false);

  const loadStaff = useCallback(() => {
    api
      .get<AdminStaffResponse>("/api/admin/staff")
      .then((data) => setStaff(data.staff))
      .catch(() => setError(t("roles.failedToLoad")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  async function handleAdd() {
    if (!newAadId.trim() || !newName.trim()) {
      setError(t("roles.aadIdRequired"));
      return;
    }
    clearMessages();
    setAdding(true);
    try {
      await api.post("/api/admin/staff", {
        aadId: newAadId.trim(),
        displayName: newName.trim(),
        role: newRole,
      });
      setNewAadId("");
      setNewName("");
      setNewRole("staff");
      setSuccess(t("roles.staffAdded"));
      loadStaff();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("roles.failedToUpdate"));
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeRole(aadId: string, role: "staff" | "admin") {
    clearMessages();
    try {
      await api.patch(`/api/admin/staff/${aadId}`, { role });
      setSuccess(t("roles.roleUpdated"));
      loadStaff();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("roles.failedToUpdate"));
    }
  }

  async function handleRemove(aadId: string) {
    clearMessages();
    try {
      await api.delete(`/api/admin/staff/${aadId}`);
      setSuccess(t("roles.staffRemoved"));
      loadStaff();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("roles.failedToRemove"));
    }
  }

  if (loading) return <Spinner label={t("roles.loading")} />;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("roles.title")}</h2>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {success && (
        <MessageBar intent="success">
          <MessageBarBody>{success}</MessageBarBody>
        </MessageBar>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>{t("roles.name")}</th>
            <th className={styles.th}>{t("roles.aadId")}</th>
            <th className={styles.th}>{t("roles.role")}</th>
            <th className={styles.th}>{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.aadId}>
              <td className={styles.td}>{s.displayName}</td>
              <td className={`${styles.td} ${styles.idCell}`} title={s.aadId}>
                {s.aadId}
              </td>
              <td className={styles.td}>
                <Dropdown
                  value={s.role}
                  selectedOptions={[s.role]}
                  onOptionSelect={(_, data) =>
                    handleChangeRole(s.aadId, data.optionValue as "staff" | "admin")
                  }
                  size="small"
                  style={{ minWidth: "100px" }}
                >
                  <Option value="staff">{t("roles.staff")}</Option>
                  <Option value="admin">{t("roles.admin")}</Option>
                </Dropdown>
              </td>
              <td className={styles.td}>
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={() => handleRemove(s.aadId)}
                >
                  {t("roles.remove")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.addForm}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("roles.aadId")}</span>
          <Input
            size="small"
            value={newAadId}
            onChange={(_, data) => setNewAadId(data.value)}
            placeholder={t("roles.aadIdPlaceholder")}
            style={{ minWidth: "220px" }}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("roles.displayName")}</span>
          <Input
            size="small"
            value={newName}
            onChange={(_, data) => setNewName(data.value)}
            placeholder={t("roles.namePlaceholder")}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("roles.role")}</span>
          <Dropdown
            size="small"
            value={newRole}
            selectedOptions={[newRole]}
            onOptionSelect={(_, data) =>
              setNewRole(data.optionValue as "staff" | "admin")
            }
            style={{ minWidth: "100px" }}
          >
            <Option value="staff">{t("roles.staff")}</Option>
            <Option value="admin">{t("roles.admin")}</Option>
          </Dropdown>
        </div>
        <Button
          appearance="primary"
          size="small"
          onClick={handleAdd}
          disabled={adding}
        >
          {adding ? t("roles.adding") : t("common.add")}
        </Button>
      </div>
    </div>
  );
}
