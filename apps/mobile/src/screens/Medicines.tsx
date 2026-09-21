import React, { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useApp } from "../services/Provider";
import { RootStack, Tabs, useNav } from "../navigation/types";
import { styles as s } from "../theme";
import {
  Badge,
  Button,
  Chips,
  Empty,
  ErrorText,
  Field,
  Loading,
  money,
  Notice,
  Quantity,
  Screen,
  useAction,
  useAsync,
} from "../components/ui";
import { MedicineArt, MedicineCard } from "../components/cards";
import { KeyboardList } from "../components/KeyboardLayout";
import { cartFeedback } from "../components/Success";
import { shopCategories } from "../data/shopCategories";

export function MedicinesScreen() {
  const { services } = useApp();
  const nav = useNav();
  const route = useRoute<RouteProp<Tabs, "Medicines">>();
  const [query, setQuery] = useState(route.params?.query ?? "");
  const [category, setCategory] = useState(route.params?.category ?? "");
  const [subcategory, setSubcategory] = useState("");
  useEffect(() => {
    setQuery(route.params?.query ?? "");
    setCategory(route.params?.category ?? "");
    setSubcategory("");
  }, [route.params]);
  const { data, loading, error } = useAsync(
    () => services.medicine.list(query, subcategory || category),
    [services, query, category, subcategory],
  );
  return (
    <KeyboardList
      showsVerticalScrollIndicator={false}
      style={s.page}
      contentContainerStyle={s.content}
      data={data ?? []}
      keyExtractor={(m) => m.id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <MedicineCard
          medicine={item}
          onPress={() => nav.navigate("Medicine", { id: item.id })}
        />
      )}
      ListHeaderComponent={
        <View style={s.section}>
          <Text style={s.title}>Your daily care</Text>
          <Text style={s.text}>Cipla, Dr. Reddy’s & Abbott medicines and health essentials.</Text>
          <Field
            label="Search medicines"
            placeholder="Brand or generic name"
            value={query}
            onChangeText={setQuery}
          />
          <Chips values={services.reference.categories} selected={category} onSelect={value => { setCategory(value); setSubcategory(""); }} all="All categories" />
          {!!category && <Chips values={shopCategories.find(item => item.name === category)?.subcategories ?? []} selected={subcategory} onSelect={setSubcategory} all={`All ${category}`} />}
          <Text style={s.small}>
            {data?.length ?? 0} products · illustrative prices · stock to be confirmed
          </Text>
          <ErrorText error={error} />
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <Loading />
        ) : (
          <View style={s.section}><Empty title="No medicines found" detail={category ? `No matching products are currently listed in ${category}.` : "Try another name or category."} /><Button title="Request a medicine" secondary onPress={() => nav.navigate("Request")} /></View>
        )
      }
    />
  );
}
export function MedicineScreen() {
  const { services, refresh, cartCount, cartLines } = useApp();
  const route = useRoute<RouteProp<RootStack, "Medicine">>();
  const nav = useNav();
  const {
    data: medicine,
    loading,
    error,
  } = useAsync(
    () => services.medicine.get(route.params.id),
    [services, route.params.id],
  );
  const quantity = cartLines.find(line => line.medicineId === route.params.id)?.quantity ?? 0;
  const action = useAction();
  if (loading) return <Loading />;
  if (!medicine)
    return (
      <Screen>
        <ErrorText error={error} />
      </Screen>
    );
  return (
    <Screen>
      <MedicineArt large image={medicine.image} name={medicine.brandName} />
      <Badge text={medicine.category} />
      <Text style={s.title}>{medicine.brandName}</Text>
      <Text style={s.text}>
        {medicine.genericName} · {medicine.strength}
      </Text>
      <Text style={s.heading}>
        {money(medicine.price)}{" "}
        <Text style={s.small}>/ {medicine.packageSize}</Text>
      </Text>
      {medicine.prescriptionRequired && (
        <Notice>
          A prescription is required. Add a clear photo before placing your
          order.
        </Notice>
      )}
      <View style={s.card}>
        <Text style={s.heading}>Product details</Text>
        {[
          ["Composition", medicine.composition],
          ["Strength", medicine.strength],
          ["Dosage form", medicine.dosageForm],
          ["Pack", medicine.packageSize],
          ["Manufacturer", medicine.manufacturer],
        ].map(([label, value]) => (
          <View key={label}>
            <Text style={s.small}>{label}</Text>
            <Text style={s.text}>{value}</Text>
          </View>
        ))}
      </View>
      {quantity > 0 ? <View style={s.section}>
        <Text style={s.label}>In your cart</Text>
        <Quantity value={quantity} minimum={0} productName={medicine.brandName} disabled={action.busy} onChange={value => action.run(async () => {
          await services.cart.setQuantity(medicine.id, value);
          await refresh();
          cartFeedback();
        })} />
        <Text style={s.small}>Decrease to zero to remove this product.</Text>
      </View> : <Button
        title={action.busy ? "Adding…" : "Add to cart"}
        disabled={action.busy}
        icon="bag-add-outline"
        onPress={() => action.run(async () => {
          await services.cart.setQuantity(medicine.id, 1);
          await refresh();
          cartFeedback();
        })}
      />}
      <Button
        title="View cart"
        secondary={cartCount === 0}
        onPress={() => nav.navigate("Cart")}
      />
      <ErrorText error={action.error} />
      {medicine.sourceUrl && <Button title="Product information & photo source" secondary icon="open-outline" onPress={() => action.run(async () => { await Linking.openURL(medicine.sourceUrl!); })} />}
      <Text style={s.small}>
        Demo prices; product listings do not confirm local stock. Your pharmacy team would confirm
        availability before fulfilment.
      </Text>
    </Screen>
  );
}
