import { NavigatorScreenParams, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
export type Tabs = {
  Home: undefined;
  Medicines: { category?: string; query?: string } | undefined;
  Orders: undefined;
  Doctors: undefined;
  Profile: undefined;
};
export type RootStack = {
  Tabs: NavigatorScreenParams<Tabs> | undefined;
  Medicine: { id: string };
  Doctor: { id: string };
  Cart: undefined;
  Order: { id: string; placed?: boolean };
  Request: undefined;
  Account: undefined;
  MyOrders: undefined;
  MedicineRequests: undefined;
  Information: { page: "help" | "terms" | "privacy" | "about" };
};
export const useNav = () =>
  useNavigation<NativeStackNavigationProp<RootStack>>();
