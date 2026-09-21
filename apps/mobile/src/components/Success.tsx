import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Keyboard, Platform, Pressable, Text, Vibration, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles as s } from "../theme";
import { useWebKeyboardViewport } from "./KeyboardLayout";

export function cartFeedback() {
  // iOS uses its system vibration duration; unsupported browsers safely do nothing.
  if (Platform.OS !== "web") Vibration.vibrate(35);
  else if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(35);
}
export const orderPlacedFeedback = cartFeedback;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { alive = false; listener.remove(); };
  }, []);
  return reduced;
}
export function SuccessNotice({ message, large = false, title }: { message: string; large?: boolean; title?: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    progress.setValue(reduced ? 1 : 0);
    const animation = Animated.spring(progress, { toValue: 1, friction: 6, tension: 65, useNativeDriver: true });
    if (!reduced) animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return <View accessibilityLiveRegion="polite" style={[s.notice, large ? s.centered : s.row]}>
    <Animated.View testID="animated-success-icon" style={{ opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }] }}>
      <Ionicons name="checkmark-circle" size={large ? 64 : 28} color={colors.primary} />
    </Animated.View>
    {title && <Text style={[s.heading, { color: colors.primaryDark }]}>{title}</Text>}
    <Text style={[s.label, { color: colors.primaryDark, flexShrink: 1 }, large && { textAlign: "center" }]}>{message}</Text>
  </View>;
}

const SuccessContext = createContext<(message: string) => void>(() => {});
export const useSuccess = () => useContext(SuccessContext);
export function SuccessProvider({ children }: React.PropsWithChildren) {
  const viewportHeight = useWebKeyboardViewport();
  const [notice, setNotice] = useState<{ message: string; id: number }>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const serial = useRef(0);
  const success = useCallback((message: string) => {
    Keyboard.dismiss();
    setNotice({ message, id: ++serial.current });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(undefined), 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <SuccessContext.Provider value={success}>
    <View style={{ flex: 1, maxHeight: viewportHeight }}>
      {children}
      {notice && <View pointerEvents="box-none" style={{ position: "absolute", top: 64, left: 16, right: 16, zIndex: 100, alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss success message" onPress={() => setNotice(undefined)} style={{ width: "100%", maxWidth: 560, borderRadius: 12, borderWidth: 1, borderColor: colors.primary }}>
          <SuccessNotice key={notice.id} message={notice.message} />
        </Pressable>
      </View>}
    </View>
  </SuccessContext.Provider>;
}
