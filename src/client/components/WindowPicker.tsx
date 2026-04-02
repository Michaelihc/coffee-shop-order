import React from "react";
import {
  Badge,
  RadioGroup,
  Radio,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import type { PickupWindow } from "../../../types/models";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    marginBottom: "4px",
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  time: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

interface WindowPickerProps {
  windows: PickupWindow[];
  selected: string | null;
  onSelect: (windowId: string) => void;
}

const STATUS_KEYS: Record<string, { key: string; color: "success" | "warning" | "severe" | "danger" | "subtle" }> = {
  free: { key: "window.free", color: "success" },
  busy: { key: "window.busy", color: "warning" },
  "near-capacity": { key: "window.nearCapacity", color: "severe" },
  "over-capacity": { key: "window.overCapacity", color: "danger" },
  closed: { key: "window.closed", color: "subtle" },
};

export function WindowPicker({ windows, selected, onSelect }: WindowPickerProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.label}>{t("window.pickupWindow")}</div>
      <RadioGroup
        value={selected || ""}
        onChange={(_, data) => onSelect(data.value)}
      >
        {windows.map((w) => {
          const disabled = w.status === "closed";
          return (
            <Radio
              key={w.id}
              value={w.id}
              disabled={disabled}
              label={
                <span className={styles.option}>
                  {w.label}
                  <span className={styles.time}>
                    {w.startsAt} – {w.endsAt}
                  </span>
                  {STATUS_KEYS[w.status] && (
                    <Badge appearance="filled" color={STATUS_KEYS[w.status].color} size="small">
                      {t(STATUS_KEYS[w.status].key)}
                    </Badge>
                  )}
                </span>
              }
            />
          );
        })}
      </RadioGroup>
    </div>
  );
}
