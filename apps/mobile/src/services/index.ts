import { createApiServices } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import { createMockServices } from "./mock";
import { localMedia } from "./media";
import { Services } from "./types";

export function createServices(mode: string): Services {
  if (mode === "api") {
    const url = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;
    if (!url) throw new Error("Set EXPO_PUBLIC_API_URL to the shared API address.");
    return createApiServices(url, Platform.OS === "web" ? AsyncStorage : { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync }, localMedia);
  }
  if (mode !== "mock")
    throw new Error(
      "API mode is not configured. Set DATA_MODE=mock for this prototype.",
    );
  return createMockServices(
    AsyncStorage,
    Platform.OS === "web"
      ? AsyncStorage
      : {
          getItem: SecureStore.getItemAsync,
          setItem: SecureStore.setItemAsync,
          removeItem: SecureStore.deleteItemAsync,
        },
    localMedia,
    Date.now,
    randomUUID,
  );
}
export const services = createServices(
  process.env.EXPO_PUBLIC_DATA_MODE ?? (process.env.EXPO_PUBLIC_API_URL ? "api" : Constants.expoConfig?.extra?.dataMode ?? "mock"),
);
