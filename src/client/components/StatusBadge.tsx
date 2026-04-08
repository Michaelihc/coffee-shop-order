import React from "react";
import { Badge, makeStyles, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import type { OrderStatus } from "../../types/models";

const useStyles = makeStyles({
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    minHeight: "28px",
    paddingTop: "2px",
    paddingBottom: "2px",
    fontWeight: tokens.fontWeightSemibold,
  },
});

const statusColors: Record<
  OrderStatus,
  "success" | "warning" | "informative" | "danger" | "important" | "subtle"
> = {
  confirmed: "informative",
  preparing: "warning",
  ready: "success",
  collected: "subtle",
  cancelled: "danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const color = statusColors[status] || "subtle";
  return (
    <Badge appearance="filled" color={color} className={styles.badge}>
      {t(`status.${status}`)}
    </Badge>
  );
}
