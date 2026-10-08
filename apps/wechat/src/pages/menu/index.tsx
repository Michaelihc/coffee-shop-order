import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import {
  addCartItem,
  toCartItem,
  type Category,
  type MenuItem,
} from "@coffee-shop/portable";
import { portableApi } from "../../api";
import { loadCart, saveCart } from "../../store";

export default function MenuPage() {
  const [categories, setCategories] = useState<(Category & { items: MenuItem[] })[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    portableApi
      .getMenu()
      .then((response) => {
        setCategories(response.categories);
        setSelectedCategoryId(response.categories[0]?.id || "");
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Failed to load menu")
      );
  }, []);

  const currentCategory =
    categories.find((entry) => entry.id === selectedCategoryId) || categories[0];

  function handleAdd(item: MenuItem) {
    const next = addCartItem(loadCart(), toCartItem(item));
    saveCart(next);
    Taro.switchTab({ url: "/pages/cart/index" });
  }

  return (
    <ScrollView scrollY className="page-shell">
      <Text className="section-title">Portable Menu</Text>
      {error ? <View className="error-box">{error}</View> : null}

      <View className="chip-row">
        {categories.map((category) => (
          <View
            key={category.id}
            className={`chip ${category.id === currentCategory?.id ? "chip--active" : ""}`}
            onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.label}
          </View>
        ))}
      </View>

      {(currentCategory?.items || []).map((item) => (
        <View key={item.id} className="card">
          <Text className="card-title">{item.name}</Text>
          {item.description ? <Text className="muted">{item.description}</Text> : null}
          <Text className="muted">¥{(item.priceCents / 100).toFixed(2)}</Text>
          <Button className="primary-button" onClick={() => handleAdd(item)}>
            Add to cart
          </Button>
        </View>
      ))}
    </ScrollView>
  );
}
