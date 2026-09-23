import React from "react";
import { Pressable, Text, View } from "react-native";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../services/Provider";
import { RootStack, Tabs } from "./types";
import { colors, styles as s } from "../theme";
import { Button, ErrorText, Loading, Screen } from "../components/ui";
import { AuthScreen } from "../screens/Auth";
import { HomeScreen } from "../screens/Home";
import { MedicinesScreen, MedicineScreen } from "../screens/Medicines";
import { DoctorsScreen, DoctorScreen } from "../screens/Doctors";
import { OrdersScreen, OrderScreen } from "../screens/Orders";
import { CartScreen } from "../screens/Cart";
import { RequestScreen } from "../screens/Request";
import { ProfileScreen, AccountScreen, MedicineRequestsScreen, InformationScreen } from "../screens/Profile";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
const Stack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator<Tabs>();
const icons: Record<keyof Tabs, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Medicines: "medkit-outline",
  Orders: "receipt-outline",
  Doctors: "people-outline",
  Profile: "person-outline",
};
function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 3 },
        tabBarLabelPosition: "below-icon",
        tabBarStyle: {
          height: 60 + Math.max(insets.bottom, 8),
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: "#E3EEE8",
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, focused }) => (
          <View style={{ width: 56, height: 32, borderRadius: 18, backgroundColor: focused ? colors.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={focused ? icons[route.name].replace("-outline", "") as keyof typeof Ionicons.glyphMap : icons[route.name]} color={focused ? colors.white : color} size={23} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Medicines" component={MedicinesScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Doctors" component={DoctorsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
export function AppNavigation() {
  const { loading, error, user, cartCount, configuration, refresh } = useApp();
  if (loading) return <Loading />;
  if (error)
    return (
      <Screen>
        <ErrorText error={error} />
        <Button title="Retry connection" onPress={() => { void refresh().catch(() => undefined); }} />
      </Screen>
    );
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.white,
          text: colors.text,
          border: colors.border,
        },
      }}
    >
      {!user ? (
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}><AuthScreen /></SafeAreaView>
      ) : (
        <Stack.Navigator
          screenOptions={({ navigation }) => ({
            headerShadowVisible: false,
            headerTintColor: colors.white,
            headerStyle: { backgroundColor: colors.primaryDark },
            headerTitleStyle: { fontSize: 19, fontWeight: "700" },
            animation: "slide_from_right",
            contentStyle: s.page,
            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open cart"
                accessibilityHint={`${cartCount} ${cartCount === 1 ? "item" : "items"} in cart`}
                onPress={() => navigation.navigate("Cart")}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="bag-outline" size={24} color={colors.white} />
                {cartCount > 0 && (
                  <View style={{ position: "absolute", right: 0, top: 2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#B3261E", borderWidth: 2, borderColor: colors.primaryDark, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                    <Text testID="cart-count" accessibilityLiveRegion="polite" style={{ color: colors.white, fontSize: 11, fontWeight: "700" }}>{cartCount > 99 ? "99+" : cartCount}</Text>
                  </View>
                )}
              </Pressable>
            ),
          })}
        >
          <Stack.Screen
            name="Tabs"
            component={TabNavigator}
            options={{ title: configuration?.shopName ?? "Hyderabad Pharmacy" }}
          />
          <Stack.Screen
            name="Medicine"
            component={MedicineScreen}
            options={{ title: "Medicine details" }}
          />
          <Stack.Screen
            name="Doctor"
            component={DoctorScreen}
            options={{ title: "Doctor profile" }}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ title: "Your cart", headerRight: () => null }}
          />
          <Stack.Screen
            name="Order"
            component={OrderScreen}
            options={({ route, navigation }) => ({
              title: "Your order",
              ...(route.params.placed ? {
                headerBackVisible: false,
                headerLeft: () => <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go to Home"
                  onPress={() => navigation.reset({ index: 0, routes: [{ name: "Tabs", params: { screen: "Home" } }] })}
                  style={{ minHeight: 48, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
                ><Ionicons name="home-outline" size={22} color={colors.white} /><Text style={[s.label, s.white]}>Home</Text></Pressable>,
              } : {}),
            })}
          />
          <Stack.Screen name="MyOrders" component={OrdersScreen} options={{ title: "My orders" }} />
          <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Account information" }} />
          <Stack.Screen name="MedicineRequests" component={MedicineRequestsScreen} options={{ title: "Medicine requests" }} />
          <Stack.Screen name="Information" component={InformationScreen} options={{ title: "Information" }} />
          <Stack.Screen
            name="Request"
            component={RequestScreen}
            options={{ title: "Request Medicine" }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
