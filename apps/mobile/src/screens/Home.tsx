import React, { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useApp } from "../services/Provider";
import { useNav } from "../navigation/types";
import { colors, styles as s } from "../theme";
import { Button, ErrorText, Screen, money, useAsync } from "../components/ui";
import { MedicineArt, OrderCard } from "../components/cards";
import { shopCategories } from "../data/shopCategories";


export function HomeScreen() {
  const { user, services, revision } = useApp();
  const nav = useNav();
  const [query, setQuery] = useState("");
  const { data: orders, error } = useAsync(() => services.order.list(), [services, revision]);
  const { data: medicines, error: medicineError } = useAsync(() => services.medicine.list(), [services]);
  const search = () => nav.navigate("Tabs", { screen: "Medicines", params: { query, category: "" } });
  return (
    <Screen>
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, marginTop: -12, marginHorizontal: -16, gap: 8 }}>
        <View style={s.between}>
          <View style={s.grow}>
            <Text style={[s.heading, s.white]}>{user?.name}</Text>
          </View>
          <Ionicons name="leaf" size={30} color={colors.white} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit delivery location" onPress={() => nav.navigate("Account")} style={s.row}>
          <Ionicons name="location-outline" size={15} color={colors.white} />
          <Text style={[s.small, s.white, { flex: 1 }]}>{[user?.locality?.trim(), user?.landmark?.trim()].filter(Boolean).join(" - ")}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.white} />
        </Pressable>
        <View style={[s.row, { backgroundColor: colors.white, borderRadius: 8, paddingLeft: 12, gap: 4 }]}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput accessibilityLabel="Find your medicines" placeholder="Search medicines or brands" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={search} style={{ flex: 1, minHeight: 48, fontSize: 14, color: colors.text }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Search medicines" onPress={search} style={{ padding: 14 }}><Ionicons name="arrow-forward" size={20} color={colors.primary} /></Pressable>
        </View>
      </View>
      <View style={[s.row, { alignItems: "stretch", gap: 10 }]}>
        <View style={{ flex: 1.4, backgroundColor: "#B6D9CD", borderRadius: 18, overflow: "hidden", padding: 14, minHeight: 150 }}>
          <Image source={require("../../assets/charminar-cutout.png")} style={{ position: "absolute", right: -8, bottom: 0, width: "53%", height: 105, borderTopLeftRadius: 18 }} resizeMode="contain" />
          <Text style={[s.heading, { color: colors.primaryDark, maxWidth: "90%", fontSize: 16, lineHeight: 21 }]}>Your neighbourhood pharmacy</Text>
          <Pressable accessibilityRole="button" onPress={() => nav.navigate("Tabs", { screen: "Medicines" })} style={{ marginTop: 12, backgroundColor: colors.primary, borderRadius: 6, padding: 10, alignSelf: "flex-start" }}><Text style={[s.label, s.white]}>Order now</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Request Medicine" onPress={() => nav.navigate("Request")} style={{ flex: 1, borderRadius: 18, backgroundColor: colors.primaryDark, padding: 14, justifyContent: "center", gap: 10 }}>
          <Ionicons name="camera-outline" size={32} color={colors.white} />
          <Text style={[s.label, s.white]}>Send a photo</Text>
          <Text style={[s.small, s.white]}>Request your medicine</Text>
          <Ionicons name="arrow-forward-circle" size={24} color={colors.white} />
        </Pressable>
      </View>
      <View style={s.between}>
        <Text style={s.heading}>Featured products</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See all medicines" onPress={() => nav.navigate("Tabs", { screen: "Medicines" })} style={{ padding: 10 }}><Text style={[s.small, { color: colors.primary }]}>See all</Text></Pressable>
      </View>
      <ErrorText error={medicineError} />
      <View style={[s.row, { alignItems: "stretch", gap: 10 }]}>
        {medicines?.slice(0, 2).map(medicine => (
          <Pressable key={medicine.id} accessibilityRole="button" accessibilityLabel={`View ${medicine.brandName}`} onPress={() => nav.navigate("Medicine", { id: medicine.id })} style={[s.card, { flex: 1, padding: 12, gap: 6 }]}>
            <View style={s.row}><MedicineArt image={medicine.image} name={medicine.brandName} /><Ionicons name="chevron-forward" size={18} color={colors.primary} /></View>
            <Text style={s.label}>{medicine.brandName}</Text>
            <Text style={s.small}>{medicine.strength}</Text>
            <View style={s.between}><Text style={s.label}>{money(medicine.price)}</Text><Ionicons name="arrow-forward-circle" size={26} color={colors.primary} /></View>
          </Pressable>
        ))}
      </View>
      <Text style={s.heading}>Shop by category</Text>
      <View style={[s.wrap, { justifyContent: "space-between" }]}>
        {shopCategories.map((category, index) => (
          <Pressable key={category.name} accessibilityRole="button" accessibilityLabel={`Shop ${category.name}`} onPress={() => nav.navigate("Tabs", { screen: "Medicines", params: { category: category.name, query: "" } })} style={{ width: "30%", alignItems: "center", gap: 6, marginBottom: 8, paddingVertical: 8 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: index % 2 ? colors.blue : colors.mint, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name={category.icon} size={25} color={colors.primary} /></View>
            <Text style={[s.small, { textAlign: "center", color: colors.text }]}>{category.name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[s.card, { backgroundColor: colors.mint }]}>
        <View style={s.row}><Ionicons name="people-outline" size={30} color={colors.primary} /><View style={s.grow}><Text style={s.heading}>Find care near you</Text><Text style={s.small}>Good care starts close to home.</Text></View></View>
        <Button title="Find a Doctor" secondary onPress={() => nav.navigate("Tabs", { screen: "Doctors" })} />
      </View>
      <View style={s.between}><Text style={s.heading}>Recent orders</Text><Pressable accessibilityRole="button" onPress={() => nav.navigate("Tabs", { screen: "Orders" })} style={{ padding: 12 }}><Text style={[s.small, { color: colors.primary }]}>View all</Text></Pressable></View>
      <ErrorText error={error} />
      {orders?.slice(0, 2).map(order => <OrderCard key={order.id} order={order} onPress={() => nav.navigate("Order", { id: order.id })} />)}
      {!orders?.length && <Text style={s.text}>Your first order will appear here.</Text>}
      <Text style={s.small}>Real product and hospital listings. Prices and orders are illustrative; local stock is not connected.</Text>
    </Screen>
  );
}
