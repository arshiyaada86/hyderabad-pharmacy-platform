import { ProductPrice } from "../components/ProductPrice";
import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../services/Provider";
import { ORDER_STEPS, ORDER_SUCCESS } from "../services/rules";
import { RootStack, useNav } from "../navigation/types";
import { colors, styles as s } from "../theme";
import {
  Badge,
  Button,
  Chips,
  dateLabel,
  Empty,
  ErrorText,
  Loading,
  money,
  Notice,
  Screen,
  useAsync,
} from "../components/ui";
import { OrderCard } from "../components/cards";
import { OrderAgainButton } from "../components/OrderAgainButton";
import { SuccessNotice } from "../components/Success";

export function OrdersScreen() {
  const { services, revision } = useApp();
  const nav = useNav();
  const [past, setPast] = useState("");
  const { data, loading, error } = useAsync(
    () => services.order.list(),
    [services, revision],
  );
  const orders = data?.filter(
    (order) => ["Delivered", "Cancelled"].includes(order.status) === !!past,
  );
  return (
    <Screen>
      <Text style={s.title}>Your orders</Text>
      <Text style={s.text}>A clear view of your care, every step.</Text>
      <Chips
        values={["Past Orders"]}
        selected={past}
        onSelect={setPast}
        all="Current Orders"
      />
      <ErrorText error={error} />
      {loading && <Loading />}
      {orders?.map((order) => (
        <View key={order.id} style={s.section}>
        <OrderCard
          order={order}
          onPress={() => nav.navigate("Order", { id: order.id })}
        />
        {!!past && <OrderAgainButton orderId={order.id} />}
        </View>
      ))}
      {!loading && !orders?.length && (
        <Empty
          title={past ? "No past orders" : "No current orders"}
          detail="Your medicine orders will appear here."
        />
      )}
    </Screen>
  );
}
export function OrderScreen() {
  const { services, revision } = useApp();
  const route = useRoute<RouteProp<RootStack, "Order">>();
  const nav = useNav();
  const {
    data: order,
    loading,
    error,
  } = useAsync(
    () => services.order.get(route.params.id),
    [services, revision, route.params.id],
  );
  if (loading) return <Loading />;
  if (!order)
    return (
      <Screen>
        <ErrorText error={error} />
      </Screen>
    );
  const timeline =
    order.status === "Cancelled"
      ? [...order.timeline.map((t) => t.status)]
      : ORDER_STEPS;
  return (
    <Screen>
      {route.params.placed && <SuccessNotice large title="Order Placed" message={ORDER_SUCCESS} />}
      <Badge text={order.status} />
      <Text style={s.title}>Order details</Text>
      <Text selectable style={s.label}>
        Order ID: {order.id}
      </Text>
      <Text style={s.small}>{dateLabel(order.date)}</Text>
      {order.sample && <Text style={s.small}>Sample order</Text>}
      {order.eta && <Notice>Estimated delivery: {order.eta}</Notice>}
      <View style={s.card}>
        <Text style={s.heading}>Order progress</Text>
        {timeline.map((status) => {
          const event = order.timeline.find((t) => t.status === status);
          return (
            <View key={status} style={s.row}>
              <Ionicons
                name={event ? "checkmark-circle" : "ellipse-outline"}
                color={event ? colors.primary : colors.muted}
                size={25}
              />
              <View style={s.grow}>
                <Text style={[s.text, !event && s.muted]}>{status}</Text>
                {event && (
                  <Text style={s.small}>
                    {dateLabel(event.date)} ·{" "}
                    {new Date(event.date).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Medicines</Text>
        {order.items.map((item) => (
          <View key={item.medicine.id} style={s.section}>
            <Text style={s.label}>
              {item.medicine.brandName} · {item.medicine.strength}
            </Text>
            <View style={s.between}>
              <Text style={[s.small, s.grow]}>
                {item.medicine.packageSize} × {item.quantity}
              </Text>
              <ProductPrice price={item.medicine.price} mrp={item.medicine.mrp} quantity={item.quantity} />
            </View>
          </View>
        ))}
        <View style={s.divider} />
        {order.deliveryContribution !== undefined && <View style={s.between}>
          <Text style={s.text}>Delivery contribution</Text>
          <Text style={s.label}>{money(order.deliveryContribution)}</Text>
        </View>}
        <View style={s.between}>
          <Text style={s.heading}>Total</Text>
          <Text style={s.heading}>{money(order.total)}</Text>
        </View>
      </View>
      {order.prescriptionSubmitted && <View style={s.card}>
        <Text style={s.heading}>Prescription</Text>
        <Badge text="Prescription submitted" />
        {order.prescription && (
          <Image
            source={{ uri: order.prescription.uri }}
            style={s.photo}
            resizeMode="contain"
            accessibilityLabel="Submitted prescription"
          />
        )}
      </View>}
      <View style={s.card}>
        <Text style={s.heading}>Delivery address</Text>
        <Text style={s.text}>{order.delivery.name}</Text>
        <Text style={s.text}>
          {order.delivery.address}, {order.delivery.locality}
        </Text>
        <Text style={s.small}>Landmark: {order.delivery.landmark}</Text>
      </View>
      {["Delivered", "Cancelled"].includes(order.status) && <OrderAgainButton orderId={order.id} />}
      <Button
        title="View all orders"
        secondary
        onPress={() => nav.navigate("Tabs", { screen: "Orders" })}
      />
      <Text style={s.small}>
        Demo order updates are stored locally. Newly placed orders remain at
        Order Received.
      </Text>
    </Screen>
  );
}
