import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "@tarojs/components";
import {
  formatCurrency,
  type Order,
} from "@coffee-shop/portable";
import { portableApi } from "../../api";
import { loadOrders, saveOrders } from "../../store";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(loadOrders());

  useEffect(() => {
    const timer = setInterval(() => {
      const pendingOrders = loadOrders().filter(
        (order) => order.paymentMethod === "wechat-pay" && order.paymentStatus === "pending"
      );
      if (pendingOrders.length === 0) {
        setOrders(loadOrders());
        return;
      }

      Promise.all(
        pendingOrders.map(async (order) => {
          const status = await portableApi.getPaymentStatus(order.id);
          if (status.paymentStatus === order.paymentStatus) {
            return order;
          }

          return { ...order, paymentStatus: status.paymentStatus, status: status.status };
        })
      )
        .then((updatedPendingOrders) => {
          const current = loadOrders();
          const merged = current.map(
            (order) => updatedPendingOrders.find((candidate) => candidate.id === order.id) || order
          );
          saveOrders(merged);
          setOrders(merged);
        })
        .catch(() => undefined);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  return (
    <ScrollView scrollY className="page-shell">
      <Text className="section-title">Recent Orders</Text>
      {orders.length === 0 ? <Text className="muted">No portable orders saved yet.</Text> : null}
      {orders.map((order) => (
        <View key={order.id} className="card">
          <Text className="card-title">{order.id}</Text>
          <Text className="muted">
            {order.studentName} · {order.paymentMethod} · {order.paymentStatus}
          </Text>
          <Text className="muted">
            {order.status} · {formatCurrency(order.totalCents)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
