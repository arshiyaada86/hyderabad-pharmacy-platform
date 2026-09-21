import React from "react";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppProvider } from "./src/services/Provider";
import { services } from "./src/services";
import { AppNavigation } from "./src/navigation/AppNavigation";
import { colors } from "./src/theme";

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#D5E0DB", alignItems: "center" }}>
      <SafeAreaView
        style={{ flex: 1, width: "100%", maxWidth: Platform.OS === "web" ? 480 : undefined, backgroundColor: colors.primaryDark }}
        // The native stack header owns the top inset; do not apply it twice.
        edges={["left", "right"]}
      >
        <StatusBar style="light" />
        <AppProvider services={services}>
          <AppNavigation />
        </AppProvider>
      </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}
