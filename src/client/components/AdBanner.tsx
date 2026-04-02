import React, { useState, useEffect, useCallback } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { getLocalizedMenuItemName } from "../menu-localization";
import type { MenuItem } from "../../../types/models";

const useStyles = makeStyles({
  wrapper: {
    position: "relative",
    width: "100%",
    height: "120px",
    borderRadius: "12px",
    overflow: "hidden",
    cursor: "pointer",
  },
  slide: {
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    transition: "opacity 0.5s ease",
  },
  textArea: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    zIndex: 1,
  },
  featured: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: "rgba(255,249,243,0.85)",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },
  itemName: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightBold,
    color: "#FFF9F3",
    margin: 0,
  },
  itemPrice: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: "#DDAF6B",
  },
  cta: {
    padding: "6px 18px",
    borderRadius: "20px",
    border: "2px solid #FFF9F3",
    backgroundColor: "transparent",
    color: "#FFF9F3",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    cursor: "pointer",
    zIndex: 1,
    ":hover": {
      backgroundColor: "rgba(255,249,243,0.15)",
    },
  },
  dots: {
    position: "absolute",
    bottom: "8px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "6px",
    zIndex: 2,
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
});

const GRADIENTS = [
  "linear-gradient(135deg, #9F5A37 0%, #7B4529 50%, #5A3420 100%)",
  "linear-gradient(135deg, #B07A46 0%, #C79257 38%, #E0BA72 100%)",
  "linear-gradient(135deg, #3B2218 0%, #7B4529 50%, #9F5A37 100%)",
  "linear-gradient(135deg, #5A3420 0%, #DDAF6B 100%)",
];

interface AdBannerProps {
  items: MenuItem[];
  onItemClick: (categoryId: string) => void;
}

export function AdBanner({ items, onItemClick }: AdBannerProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const featured = items.filter((i) => i.isAvailable).slice(0, 4);

  const next = useCallback(() => {
    if (featured.length <= 1) return;
    setCurrent((c) => (c + 1) % featured.length);
  }, [featured.length]);

  useEffect(() => {
    if (paused || featured.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, next, featured.length]);

  if (featured.length === 0) return null;

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {featured.map((item, i) => (
        <div
          key={item.id}
          className={styles.slide}
          style={{
            background: item.imageUrl
              ? `linear-gradient(90deg, rgba(59,34,24,0.85) 0%, rgba(59,34,24,0.4) 100%), url(${item.imageUrl}) center/cover`
              : GRADIENTS[i % GRADIENTS.length],
            opacity: i === current ? 1 : 0,
            pointerEvents: i === current ? "auto" : "none",
          }}
          onClick={() => onItemClick(item.categoryId)}
        >
          <div className={styles.textArea}>
            <span className={styles.featured}>{t("adBanner.featured")}</span>
            <h3 className={styles.itemName}>{getLocalizedMenuItemName(t, item)}</h3>
            <span className={styles.itemPrice}>
              ¥{(item.priceCents / 100).toFixed(2)}
            </span>
          </div>
          <button
            className={styles.cta}
            onClick={(e) => {
              e.stopPropagation();
              onItemClick(item.categoryId);
            }}
          >
            {t("adBanner.orderNow")}
          </button>
        </div>
      ))}
      {featured.length > 1 && (
        <div className={styles.dots}>
          {featured.map((_, i) => (
            <button
              key={i}
              className={styles.dot}
              style={{
                backgroundColor:
                  i === current ? "#DDAF6B" : "rgba(255,249,243,0.5)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrent(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
