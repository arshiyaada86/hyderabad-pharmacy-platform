import React from "react";
import { Text, View } from "react-native";
import { colors, styles as s } from "../theme";
import { money } from "./ui";

export function discountPercent(price: number, mrp?: number) {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(mrp) || !mrp || mrp <= price) return undefined;
  return Number((((mrp - price) / mrp) * 100).toFixed(2));
}

export function ProductPrice({ price, mrp, quantity = 1, prominent = false }: {
  price: number; mrp?: number; quantity?: number; prominent?: boolean;
}) {
  const discount = discountPercent(price, mrp);
  return <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, flexShrink: 1 }}>
    {discount !== undefined && <Text accessibilityLabel={`MRP ${money(mrp! * quantity)}`} style={[s.small, { textDecorationLine: "line-through" }]}>{money(mrp! * quantity)}</Text>}
    <Text accessibilityLabel={`Selling price ${money(price * quantity)}`} style={[prominent ? s.heading : s.label, { color: colors.primaryDark }]}>{money(price * quantity)}</Text>
    {discount !== undefined && <Text style={[s.small, { color: colors.primary, fontWeight: "700" }]}>{discount}% OFF</Text>}
  </View>;
}
