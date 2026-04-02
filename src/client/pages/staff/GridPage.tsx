import React, { useState, useCallback } from "react";
import {
  Button,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api } from "../../api-client";
import { usePoller } from "../../hooks/usePoller";
import type { AdminGridResponse } from "../../../types/api";
import type { GridSlot } from "../../../types/models";

type EnrichedSlot = GridSlot & { studentName?: string | null; pickupCode?: string | null };

function SafeClearButton({ onClear }: { onClear: () => void }) {
  const [primed, setPrimed] = useState(false);
  const { t } = useTranslation();

  function handleClick() {
    if (primed) {
      onClear();
      setPrimed(false);
    } else {
      setPrimed(true);
      setTimeout(() => setPrimed(false), 3000);
    }
  }

  return (
    <Button
      appearance={primed ? "primary" : "subtle"}
      size="small"
      onClick={handleClick}
      style={primed ? { backgroundColor: "#c43e1c", color: "#fff" } : undefined}
    >
      {primed ? t("grid.confirmClear") : t("grid.clear")}
    </Button>
  );
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "10px",
  },
  slot: {
    padding: "12px",
    borderRadius: "10px",
    border: "2px solid",
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minHeight: "80px",
  },
  empty: {
    borderColor: tokens.colorPaletteGreenBorder1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  occupied: {
    borderColor: tokens.colorPaletteYellowBorder1,
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  slotLabel: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase400,
  },
  slotInfo: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

export function GridPage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const [slots, setSlots] = useState<EnrichedSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGrid = useCallback(() => {
    api
      .get<AdminGridResponse>("/api/admin/grid")
      .then((data) => setSlots(data.slots))
      .finally(() => setLoading(false));
  }, []);

  usePoller(fetchGrid, 5000);

  async function handleClear(slotId: string) {
    await api.patch(`/api/admin/grid/${slotId}`, { clear: true });
    fetchGrid();
  }

  if (loading) return <Spinner label={t("grid.loading")} />;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("grid.title")}</h2>
      <div className={styles.grid}>
        {slots.map((slot) => (
          <div
            key={slot.id}
            className={`${styles.slot} ${
              slot.isOccupied ? styles.occupied : styles.empty
            }`}
          >
            <span className={styles.slotLabel}>{slot.label}</span>
            {slot.isOccupied && slot.currentOrderId ? (
              <>
                <span className={styles.slotInfo}>#{slot.currentOrderId}</span>
                {slot.studentName && (
                  <span className={styles.slotInfo}>{slot.studentName}</span>
                )}
                {slot.pickupCode && (
                  <span className={styles.slotInfo}>{t("grid.code", { code: slot.pickupCode })}</span>
                )}
                <SafeClearButton onClear={() => handleClear(slot.id)} />
              </>
            ) : (
              <span className={styles.slotInfo}>{t("grid.empty")}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
