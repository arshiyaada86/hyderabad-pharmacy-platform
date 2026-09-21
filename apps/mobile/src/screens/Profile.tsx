import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useApp } from "../services/Provider";
import { RootStack, useNav } from "../navigation/types";
import { colors, styles as s } from "../theme";
import { Badge, Button, dateLabel, ErrorText, Loading, Screen, useAction, useAsync } from "../components/ui";
import { ProfileForm } from "../components/ProfileForm";

function MenuItem({ title, detail, icon, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [s.row, { minHeight: 76, padding: 16, gap: 14, backgroundColor: pressed ? colors.mint : colors.white, borderRadius: 14 }]}>
    <Ionicons name={icon} size={24} color={colors.primary} />
    <View style={s.grow}><Text style={s.label}>{title}</Text><Text style={s.small}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
  </Pressable>;
}
export function ProfileScreen() {
  const { user, services, refresh } = useApp();
  const nav = useNav();
  const action = useAction();
  return <Screen>
    <Text style={s.title}>Your profile</Text>
    <View style={[s.card, s.row]}>
      <Ionicons name="person-circle-outline" size={54} color={colors.primary} />
      <View style={s.grow}><Text style={s.heading}>{user?.name}</Text><Text style={s.text}>+91 {user?.phone}</Text><Text style={s.small}>{user?.locality}</Text></View>
    </View>
    <Text style={s.heading}>Your account</Text>
    <MenuItem title="Account information" detail="Name, mobile number & delivery address" icon="person-outline" onPress={() => nav.navigate("Account")} />
    <MenuItem title="My orders" detail="Track orders & order again" icon="receipt-outline" onPress={() => nav.navigate("MyOrders")} />
    <MenuItem title="Medicine requests" detail="View your photo requests" icon="camera-outline" onPress={() => nav.navigate("MedicineRequests")} />
    <Text style={s.heading}>Help & information</Text>
    <MenuItem title="Help & support" detail="Ordering, prescriptions & common questions" icon="help-circle-outline" onPress={() => nav.navigate("Information", { page: "help" })} />
    <MenuItem title="Terms & conditions" detail="Using this app" icon="document-text-outline" onPress={() => nav.navigate("Information", { page: "terms" })} />
    <MenuItem title="Privacy information" detail="How this prototype stores your data" icon="shield-checkmark-outline" onPress={() => nav.navigate("Information", { page: "privacy" })} />
    <MenuItem title="About Hyderabad Pharmacy" detail="App information" icon="information-circle-outline" onPress={() => nav.navigate("Information", { page: "about" })} />
    <Button title="Logout" icon="log-out-outline" secondary disabled={action.busy} onPress={() => action.run(async () => { await services.auth.logout(); await refresh(); })} />
    <ErrorText error={action.error} />
  </Screen>;
}
export function AccountScreen() {
  const { user, services, refresh } = useApp();
  const action = useAction();
  return <Screen>
    <Text style={s.title}>Account information</Text>
    <Text style={s.label}>Mobile number</Text><Text style={s.text}>+91 {user?.phone}</Text>
    <Text style={s.small}>Your saved address is used for future orders. Existing orders keep their original address.</Text>
    <ProfileForm key={user?.id} initial={user ?? undefined} busy={action.busy} label="Save profile" onSave={input => action.run(async () => { await services.auth.update(input); await refresh(); }, "Profile saved successfully.")} />
    <ErrorText error={action.error} />
  </Screen>;
}
export function MedicineRequestsScreen() {
  const { services, revision } = useApp();
  const nav = useNav();
  const { data: requests, error, loading } = useAsync(() => services.request.list(), [services, revision]);
  return <Screen>
    <Text style={s.title}>Medicine requests</Text>
    <Text style={s.text}>Your submitted medicine photos and request status.</Text>
    <ErrorText error={error} />
    {loading && <Loading />}
    {requests?.map(request => <View key={request.id} style={s.card}>
      <Text style={s.label}>Request ID: {request.id}</Text>
      <Text style={s.small}>{dateLabel(request.date)} · One photo submitted{request.demo ? " · Demo example" : ""}</Text>
      <Badge text={request.status} />
    </View>)}
    {requests?.length === 0 && <Text style={s.text}>You haven’t sent any photo requests yet.</Text>}
    <Button title="Request a medicine" icon="camera-outline" onPress={() => nav.navigate("Request")} />
  </Screen>;
}
const information = {
  help: { title: "Help & support", sections: [
    ["How do I change my cart?", "After adding a product, use − and + to change its quantity. Decrease to zero or tap Remove in the cart to remove it. Your cart count updates automatically."],
    ["How do prescriptions work?", "Products marked Prescription Required need a clear prescription photo before checkout. You can choose a photo or use the camera on a supported device."],
    ["Can I repeat an order?", "Open My orders, select Past Orders, then Order Again. Review quantities and current prices in the cart. Unavailable products are listed separately."],
    ["Where do I edit my address?", "Open Account information from your profile. Save your delivery address and locality before placing your next order."],
    ["Need to contact the pharmacy?", "Live customer support is not connected in this prototype. Orders and photo requests are local demonstrations; they are not sent to a pharmacy."]
  ] },
  terms: { title: "Terms & conditions", sections: [
    ["Prototype use", "This version is a demonstration for exploring the app. Use fictional account details and sample photos. It does not provide a live pharmacy service."],
    ["Catalog and orders", "Product prices are illustrative and local availability is not connected. Placing an order does not make a purchase, take payment or arrange delivery."],
    ["Prescriptions and doctor listings", "Prescription uploads demonstrate the ordering flow. Doctor listings link to public hospital information; appointments cannot be booked here."],
    ["Before a live launch", "The pharmacy’s final ordering, cancellation, delivery and refund terms are not yet available. These prototype notes do not promise a live service."]
  ] },
  privacy: { title: "Privacy information", sections: [
    ["Data stored by the prototype", "Account details, cart items, orders and medicine requests are stored on this device. Submitted images are stored locally in the native app. No pharmacy backend receives these records."],
    ["Demo accounts", "Demo sign-in uses a public fixed code. These accounts are not private customer accounts. Do not use real personal or medical information."],
    ["External links", "Directions and product or hospital links open third-party services. Those services have their own privacy practices."],
    ["Keeping or removing data", "Logging out ends the session but keeps saved records on the device. Clearing app data or browser site data removes locally saved records. Uninstalling the native app also removes its local records."]
  ] },
  about: { title: "About Hyderabad Pharmacy", sections: [
    ["Care close to home", "Browse medicines and health essentials, explore local doctor listings and try the order flow."],
    ["Version 1.0.0 · Prototype", "This version uses local sample accounts and orders. Live pharmacy inventory, payments, deliveries, appointments and customer support are not connected."],
    ["Product and doctor information", "The catalog includes Cipla, Dr. Reddy’s and Abbott products. Product pages and doctor profiles link to their information sources."]
  ] }
};
export function InformationScreen() {
  const route = useRoute<RouteProp<RootStack, "Information">>();
  const page = information[route.params.page];
  return <Screen><Text style={s.title}>{page.title}</Text>{page.sections.map(([title, body]) => <View key={title} style={s.card}><Text style={s.heading}>{title}</Text><Text style={s.text}>{body}</Text></View>)}</Screen>;
}
