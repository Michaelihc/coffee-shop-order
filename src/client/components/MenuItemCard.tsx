import React from "react";
import {
  Badge,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import {
  getLocalizedMenuItemDescription,
  getLocalizedMenuItemName,
} from "../menu-localization";
import type { MenuItem } from "../../../types/models";

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
    gap: "8px",
  },
  image: {
    width: "100%",
    height: "120px",
    objectFit: "cover" as const,
    borderRadius: "8px",
    marginBottom: "4px",
  },
  imagePlaceholder: {
    width: "100%",
    height: "120px",
    borderRadius: "8px",
    marginBottom: "4px",
    backgroundColor: "#E8D5C0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "36px",
    color: "#D4C0A8",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  name: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    margin: 0,
  },
  price: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: "#DDAF6B",
  },
  description: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    margin: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
  },
  addButton: {
    padding: "6px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    cursor: "pointer",
    fontSize: tokens.fontSizeBase200,
    ":hover": {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
    ":disabled": {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
      color: tokens.colorNeutralForegroundDisabled,
      cursor: "not-allowed",
    },
  },
  stepper: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  stepperBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: tokens.fontWeightBold,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  stepperQty: {
    minWidth: "24px",
    textAlign: "center" as const,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
});

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

const AVAILABILITY_KEYS: Record<string, { key: string; color: "success" | "warning" | "informative" | "danger" }> = {
  available: { key: "menuItem.available", color: "success" },
  limited: { key: "menuItem.limited", color: "warning" },
  "made-fresh": { key: "menuItem.madeFresh", color: "informative" },
  "sold-out": { key: "menuItem.soldOut", color: "danger" },
};

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: (item: MenuItem) => void;
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
}

export function MenuItemCard({ item, quantity, onAdd, onUpdateQuantity }: MenuItemCardProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const localizedName = getLocalizedMenuItemName(t, item);
  const localizedDescription = getLocalizedMenuItemDescription(t, item);
  const isSoldOut = item.availabilityLabel === "sold-out";
  const atStockLimit =
    item.itemClass === "premade" &&
    item.stockCount !== null &&
    quantity >= item.stockCount;

  return (
    <div className={styles.card} style={isSoldOut ? { opacity: 0.5 } : undefined}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={localizedName} className={styles.image} />
      ) : (
        <div className={styles.imagePlaceholder}>&#9749;</div>
      )}
      <div className={styles.header}>
        <h3 className={styles.name}>{localizedName}</h3>
        <span className={styles.price}>{formatPrice(item.priceCents)}</span>
      </div>
      {localizedDescription && (
        <p className={styles.description}>{localizedDescription}</p>
      )}
      <div className={styles.footer}>
        <div>
          {AVAILABILITY_KEYS[item.availabilityLabel] && (
            <Badge appearance="filled" color={AVAILABILITY_KEYS[item.availabilityLabel].color}>
              {t(AVAILABILITY_KEYS[item.availabilityLabel].key)}
            </Badge>
          )}
          {item.itemClass === "premade" &&
            item.stockCount !== null &&
            item.stockCount > 0 &&
            item.stockCount <= 5 && (
              <span style={{ fontSize: "11px", color: tokens.colorPaletteYellowForeground2, marginLeft: "6px" }}>
                {t("menuItem.left", { count: item.stockCount })}
              </span>
            )}
        </div>
        {quantity > 0 ? (
          <div className={styles.stepper}>
            <button
              className={styles.stepperBtn}
              onClick={() => onUpdateQuantity(item.id, quantity - 1)}
            >
              -
            </button>
            <span className={styles.stepperQty}>{quantity}</span>
            <button
              className={styles.stepperBtn}
              disabled={atStockLimit}
              onClick={() => onUpdateQuantity(item.id, quantity + 1)}
            >
              +
            </button>
          </div>
        ) : (
          <button
            className={styles.addButton}
            disabled={isSoldOut}
            onClick={() => onAdd(item)}
          >
            {t("menuItem.add")}
          </button>
        )}
      </div>
    </div>
  );
}
