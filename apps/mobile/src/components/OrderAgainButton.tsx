import React from "react";
import { View } from "react-native";
import { useApp } from "../services/Provider";
import { useNav } from "../navigation/types";
import { Button, ErrorText, useAction } from "./ui";
import { cartFeedback } from "./Success";

export function OrderAgainButton({ orderId }: { orderId: string }) {
  const { services, refresh, setCartReview } = useApp();
  const action = useAction();
  const nav = useNav();
  return <View style={{ gap: 8 }}>
    <Button title={action.busy ? "Preparing cart…" : "Order Again"} icon="refresh-outline" disabled={action.busy} onPress={() => action.run(async () => {
      const review = await services.order.again(orderId);
      await refresh();
      setCartReview(review);
      if (review.available.length) cartFeedback();
      nav.navigate("Cart");
    })} />
    <ErrorText error={action.error} />
  </View>;
}
