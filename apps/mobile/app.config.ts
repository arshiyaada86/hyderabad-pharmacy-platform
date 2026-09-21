import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Hyderabad Pharmacy",
  slug: "hyderabad-pharmacy",
  version: "1.0.0",
  icon: "./assets/pharmacy-icon.png",
  orientation: "portrait",
  userInterfaceStyle: "light",
  android: {
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1),
    softwareKeyboardLayoutMode: "resize",
    permissions: ["android.permission.VIBRATE"],
    package: "com.hyderabadpharmacy.customer",
    adaptiveIcon: {
      foregroundImage: "./assets/pharmacy-icon.png",
      backgroundColor: "#104B43",
    },
    allowBackup: false,
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
  },
  plugins: [
    [
      "expo-image-picker",
      {
        cameraPermission: "Take a prescription or medicine photo.",
        microphonePermission: false,
      },
    ],
    "expo-secure-store",
  ],
  extra: { dataMode: process.env.DATA_MODE ?? "mock" },
};
export default config;
