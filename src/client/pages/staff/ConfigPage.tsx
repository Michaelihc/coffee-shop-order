import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Input,
  Switch,
  Badge,
  Spinner,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import {
  deleteWindow,
  fetchSettings as fetchSettingsData,
  fetchWindows as fetchWindowsData,
  saveWindow,
  updateSetting,
  updateWindow,
} from "../../admin-api";
import type { PickupWindow } from "../../../types/models";

const DEFAULT_SETTING_VALUES = {
  max_items_per_order: "10",
  max_order_total_cents: "25000",
  daily_spend_limit_cents: "30000",
  enforce_window_cap: "1",
} as const;

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
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  card: {
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
  },
  time: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  capInput: {
    width: "80px",
  },
  section: {
    marginTop: "16px",
  },
  limitCard: {
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "12px",
  },
  fieldLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    gap: "4px",
    marginTop: "4px",
  },
  capacityBar: {
    height: "6px",
    borderRadius: "3px",
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: "hidden",
  },
  capacityFill: {
    height: "100%",
    borderRadius: "3px",
    transition: "width 0.3s ease",
  },
});

function statusColor(status: PickupWindow["status"]) {
  switch (status) {
    case "free": return "success" as const;
    case "busy": return "warning" as const;
    case "near-capacity": return "severe" as const;
    case "over-capacity": return "danger" as const;
    case "closed": return "subtle" as const;
    default: return "subtle" as const;
  }
}

function statusLabel(status: PickupWindow["status"], t: (key: string) => string) {
  switch (status) {
    case "free": return t("window.free");
    case "busy": return t("window.busy");
    case "near-capacity": return t("window.nearCapacity");
    case "over-capacity": return t("window.overCapacity");
    case "closed": return t("window.closed");
    default: return status;
  }
}

function capacityColor(status: PickupWindow["status"]) {
  switch (status) {
    case "free": return tokens.colorPaletteGreenBackground3;
    case "busy": return tokens.colorPaletteYellowBackground3;
    case "near-capacity": return tokens.colorPaletteDarkOrangeBackground3;
    case "over-capacity": return tokens.colorPaletteRedBackground3;
    default: return tokens.colorNeutralBackground3;
  }
}

const emptyWindowForm = {
  id: "",
  label: "",
  startsAt: "09:00",
  endsAt: "09:30",
  madeToOrderCap: 15,
};

export function ConfigPage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const [windows, setWindows] = useState<PickupWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({
    ...DEFAULT_SETTING_VALUES,
  });
  const [windowCapDrafts, setWindowCapDrafts] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Window dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);
  const [windowForm, setWindowForm] = useState(emptyWindowForm);
  const [saving, setSaving] = useState(false);

  const fetchWindows = useCallback(() => {
    fetchWindowsData()
      .then((data) => {
        setWindows(data.windows);
        setError(null);
        setWindowCapDrafts(
          Object.fromEntries(
            data.windows.map((window) => [window.id, String(window.madeToOrderCap)])
          )
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.failedToLoad"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  const fetchSettings = useCallback(() => {
    fetchSettingsData()
      .then((data) => {
        setSettings(data.settings);
        setError(null);
        setSettingDrafts({
          max_items_per_order:
            data.settings.max_items_per_order || DEFAULT_SETTING_VALUES.max_items_per_order,
          max_order_total_cents:
            data.settings.max_order_total_cents || DEFAULT_SETTING_VALUES.max_order_total_cents,
          daily_spend_limit_cents:
            data.settings.daily_spend_limit_cents || DEFAULT_SETTING_VALUES.daily_spend_limit_cents,
          enforce_window_cap:
            data.settings.enforce_window_cap || DEFAULT_SETTING_VALUES.enforce_window_cap,
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.failedToLoad"));
      });
  }, [t]);

  useEffect(() => {
    fetchWindows();
    fetchSettings();
  }, [fetchSettings, fetchWindows]);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  async function commitWindowCap(windowId: string) {
    clearMessages();
    const rawValue = windowCapDrafts[windowId];
    const cap = Number.parseInt(rawValue, 10);
    const currentWindow = windows.find((window) => window.id === windowId);
    if (!currentWindow) {
      return;
    }

    if (!Number.isInteger(cap) || cap < 0) {
      setError(t("common.failedToSave"));
      setWindowCapDrafts((prev) => ({
        ...prev,
        [windowId]: String(currentWindow.madeToOrderCap),
      }));
      return;
    }

    if (cap === currentWindow.madeToOrderCap) {
      return;
    }

    try {
      await updateWindow(windowId, { madeToOrderCap: cap });
      setSuccess(t("config.windowUpdated"));
      fetchWindows();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.failedToSave"));
      setWindowCapDrafts((prev) => ({
        ...prev,
        [windowId]: String(currentWindow.madeToOrderCap),
      }));
    }
  }

  async function handleToggleActive(windowId: string, isActive: boolean) {
    clearMessages();
    try {
      await updateWindow(windowId, { isActive });
      setSuccess(t("config.windowUpdated"));
      fetchWindows();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.failedToSave"));
    }
  }

  async function handleSettingChange(key: string, value: string): Promise<boolean> {
    try {
      await updateSetting(key, value);
      setSuccess(t("config.settingUpdated"));
      fetchSettings();
      setTimeout(() => setSuccess(null), 2000);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.failedToSave"));
      return false;
    }
  }

  async function commitSetting(key: "max_items_per_order" | "max_order_total_cents" | "daily_spend_limit_cents") {
    clearMessages();
    const rawValue = settingDrafts[key];
    const nextValue = Number.parseInt(rawValue, 10);
    const currentValue = settings[key] || DEFAULT_SETTING_VALUES[key];
    if (!Number.isInteger(nextValue) || nextValue <= 0) {
      setError(t("common.failedToSave"));
      setSettingDrafts((prev) => ({
        ...prev,
        [key]: currentValue,
      }));
      return;
    }

    if (String(nextValue) === currentValue) {
      return;
    }

    const saved = await handleSettingChange(key, String(nextValue));
    if (!saved) {
      setSettingDrafts((prev) => ({
        ...prev,
        [key]: currentValue,
      }));
    }
  }

  function handleCommitOnEnter(
    event: React.KeyboardEvent<HTMLInputElement>,
    commit: () => void
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  function openAddWindow() {
    setEditingWindowId(null);
    setWindowForm(emptyWindowForm);
    setDialogOpen(true);
  }

  function openEditWindow(w: PickupWindow) {
    setEditingWindowId(w.id);
    setWindowForm({
      id: w.id,
      label: w.label,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      madeToOrderCap: w.madeToOrderCap,
    });
    setDialogOpen(true);
  }

  async function handleSaveWindow() {
    clearMessages();
    setSaving(true);
    try {
      await saveWindow({
        id: windowForm.id,
        label: windowForm.label,
        startsAt: windowForm.startsAt,
        endsAt: windowForm.endsAt,
        madeToOrderCap: windowForm.madeToOrderCap,
      }, editingWindowId);
      if (editingWindowId) {
        setSuccess(t("config.windowUpdated"));
      } else {
        setSuccess(t("config.windowCreated"));
      }
      setDialogOpen(false);
      fetchWindows();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWindow(windowId: string) {
    if (!confirm(t("config.deleteConfirm"))) return;
    clearMessages();
    try {
      const result = await deleteWindow(windowId);
      if (result.deactivated) {
        setSuccess(t("config.windowDeactivated"));
      } else {
        setSuccess(t("config.windowDeleted"));
      }
      fetchWindows();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.failedToDelete"));
    }
  }

  if (loading) return <Spinner label={t("config.loading")} />;

  const enforceCap = settings.enforce_window_cap !== "0";

  return (
    <div className={styles.container}>
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

      <div className={styles.topBar}>
        <h2 className={styles.heading}>{t("config.pickupWindows")}</h2>
        <Button appearance="primary" size="small" onClick={openAddWindow}>
          {t("config.addWindow")}
        </Button>
      </div>

      {windows.map((w) => {
        const ratio = w.madeToOrderCap > 0
          ? Math.min(((w.currentMadeToOrderCount ?? 0) / w.madeToOrderCap) * 100, 120)
          : 0;

        return (
          <div key={w.id} className={styles.card}>
            <div className={styles.row}>
              <span className={styles.label}>{w.label}</span>
              <Badge appearance="filled" color={statusColor(w.status)}>
                {statusLabel(w.status, t)}
              </Badge>
            </div>
            <span className={styles.time}>
              {w.startsAt} – {w.endsAt}
            </span>

            <div className={styles.capacityBar}>
              <div
                className={styles.capacityFill}
                style={{
                  width: `${Math.min(ratio, 100)}%`,
                  backgroundColor: capacityColor(w.status),
                }}
              />
            </div>

            <div className={styles.row}>
              <span>
                {t("config.madeToOrderCap")}
              </span>
              <Input
                className={styles.capInput}
                type="number"
                size="small"
                value={windowCapDrafts[w.id] ?? String(w.madeToOrderCap)}
                onChange={(_, data) =>
                  setWindowCapDrafts((prev) => ({
                    ...prev,
                    [w.id]: data.value,
                  }))
                }
                onBlur={() => void commitWindowCap(w.id)}
                onKeyDown={(event) => handleCommitOnEnter(event, () => void commitWindowCap(w.id))}
              />
            </div>
            <div className={styles.row}>
              <span style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                {t("config.load", { current: w.currentMadeToOrderCount ?? 0, max: w.madeToOrderCap })}
              </span>
              <Switch
                checked={w.isActive}
                onChange={(_, data) => handleToggleActive(w.id, data.checked)}
                label={w.isActive ? t("config.active") : t("config.inactive")}
              />
            </div>
            <div className={styles.actions}>
              <Button appearance="subtle" size="small" onClick={() => openEditWindow(w)}>
                {t("common.edit")}
              </Button>
              <Button appearance="subtle" size="small" onClick={() => handleDeleteWindow(w.id)}>
                {t("common.delete")}
              </Button>
            </div>
          </div>
        );
      })}

      <div className={styles.section}>
        <h2 className={styles.heading}>{t("config.capacitySettings")}</h2>
        <div className={styles.limitCard}>
          <div className={styles.row}>
            <div>
              <div>{t("config.enforceWindowCap")}</div>
              <span style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                {t("config.enforceDescription")}
              </span>
            </div>
            <Switch
              checked={enforceCap}
              onChange={(_, data) =>
                handleSettingChange("enforce_window_cap", data.checked ? "1" : "0")
              }
              label={enforceCap ? t("config.enforced") : t("config.notEnforced")}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>{t("config.orderLimits")}</h2>
        <div className={styles.limitCard}>
          <div className={styles.row}>
            <span>{t("config.maxItemsPerOrder")}</span>
            <Input
              className={styles.capInput}
              type="number"
              size="small"
              value={settingDrafts.max_items_per_order}
              onChange={(_, data) =>
                setSettingDrafts((prev) => ({
                  ...prev,
                  max_items_per_order: data.value,
                }))
              }
              onBlur={() => void commitSetting("max_items_per_order")}
              onKeyDown={(event) => handleCommitOnEnter(event, () => void commitSetting("max_items_per_order"))}
            />
          </div>
          <div className={styles.row}>
            <span>{t("config.maxOrderTotal")}</span>
            <Input
              className={styles.capInput}
              type="number"
              size="small"
              value={settingDrafts.max_order_total_cents}
              onChange={(_, data) =>
                setSettingDrafts((prev) => ({
                  ...prev,
                  max_order_total_cents: data.value,
                }))
              }
              onBlur={() => void commitSetting("max_order_total_cents")}
              onKeyDown={(event) => handleCommitOnEnter(event, () => void commitSetting("max_order_total_cents"))}
            />
          </div>
          <div className={styles.row}>
            <span>{t("config.dailySpendLimit")}</span>
            <Input
              className={styles.capInput}
              type="number"
              size="small"
              value={settingDrafts.daily_spend_limit_cents}
              onChange={(_, data) =>
                setSettingDrafts((prev) => ({
                  ...prev,
                  daily_spend_limit_cents: data.value,
                }))
              }
              onBlur={() => void commitSetting("daily_spend_limit_cents")}
              onKeyDown={(event) => handleCommitOnEnter(event, () => void commitSetting("daily_spend_limit_cents"))}
            />
          </div>
          <span style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
            {t("config.maxTotalHint")}
          </span>
          <span style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
            {t("config.dailySpendHint")}
          </span>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingWindowId ? t("config.editPickupWindow") : t("config.addPickupWindow")}</DialogTitle>
            <DialogContent>
              {!editingWindowId && (
                <div className={styles.formField}>
                  <span className={styles.fieldLabel}>{t("config.idSlug")}</span>
                  <Input
                    size="small"
                    value={windowForm.id}
                    onChange={(_, data) => setWindowForm({ ...windowForm, id: data.value })}
                    placeholder={t("config.idPlaceholder")}
                  />
                </div>
              )}
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("config.label")}</span>
                <Input
                  size="small"
                  value={windowForm.label}
                  onChange={(_, data) => setWindowForm({ ...windowForm, label: data.value })}
                  placeholder={t("config.labelPlaceholder")}
                />
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("config.startsAt")}</span>
                <Input
                  size="small"
                  type="time"
                  value={windowForm.startsAt}
                  onChange={(_, data) => setWindowForm({ ...windowForm, startsAt: data.value })}
                />
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("config.endsAt")}</span>
                <Input
                  size="small"
                  type="time"
                  value={windowForm.endsAt}
                  onChange={(_, data) => setWindowForm({ ...windowForm, endsAt: data.value })}
                />
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("config.madeToOrderCap")}</span>
                <Input
                  size="small"
                  type="number"
                  value={String(windowForm.madeToOrderCap)}
                  onChange={(_, data) =>
                    setWindowForm({ ...windowForm, madeToOrderCap: parseInt(data.value, 10) || 0 })
                  }
                />
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">{t("common.cancel")}</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleSaveWindow} disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
