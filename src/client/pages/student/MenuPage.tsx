import React, { useState, useEffect, useRef } from "react";
import {
  Tab,
  TabList,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api } from "../../api-client";
import { MenuItemCard } from "../../components/MenuItemCard";
import { AdBanner } from "../../components/AdBanner";
import { useCart } from "../../hooks/useCart";
import { getLocalizedCategoryLabel, getLocalizedMenuItemName } from "../../menu-localization";
import type { MenuResponse } from "../../../types/api";
import type { MenuItem, Category } from "../../../types/models";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "960px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "16px",
  },
  empty: {
    textAlign: "center" as const,
    padding: "32px",
    color: tokens.colorNeutralForeground3,
  },
});

export function MenuPage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { items: cartItems, addItem, updateQuantity } = useCart();
  const [categories, setCategories] = useState<(Category & { items: MenuItem[] })[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [scrollTarget, setScrollTarget] = useState<{
    itemId: string;
    requestId: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRequestIdRef = useRef(0);

  useEffect(() => {
    api
      .get<MenuResponse>("/api/menu")
      .then((data) => {
        setCategories(data.categories);
        if (data.categories.length > 0) {
          setSelectedCat(data.categories[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const allItems = categories.flatMap((c) => c.items);
  const currentCat = categories.find((c) => c.id === selectedCat);

  useEffect(() => {
    if (!scrollTarget) {
      return;
    }

    const target = itemRefs.current[scrollTarget.itemId];
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentCat, scrollTarget]);

  if (loading) return <Spinner label={t("menu.loading")} />;

  return (
    <div className={styles.container}>
      <AdBanner
        items={allItems}
        onItemClick={(item) => {
          setSelectedCat(item.categoryId);
          setScrollTarget({
            itemId: item.id,
            requestId: ++scrollRequestIdRef.current,
          });
        }}
      />

      <TabList
        selectedValue={selectedCat}
        onTabSelect={(_, data) => setSelectedCat(data.value as string)}
        size="small"
      >
        {categories.map((cat) => (
          <Tab key={cat.id} value={cat.id}>
            {getLocalizedCategoryLabel(t, cat)}
          </Tab>
        ))}
      </TabList>

      {currentCat && currentCat.items.length > 0 ? (
        <div className={styles.grid}>
          {currentCat.items.map((item) => {
            const cartItem = cartItems.find((ci) => ci.menuItemId === item.id);
            return (
              <div
                key={item.id}
                ref={(node) => {
                  itemRefs.current[item.id] = node;
                }}
              >
                <MenuItemCard
                  item={item}
                  quantity={cartItem?.quantity ?? 0}
                  onAdd={(i) =>
                    addItem({
                      menuItemId: i.id,
                      name: getLocalizedMenuItemName(t, i),
                      priceCents: i.priceCents,
                      itemClass: i.itemClass,
                    })
                  }
                  onUpdateQuantity={updateQuantity}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>{t("menu.noItems")}</div>
      )}
    </div>
  );
}
