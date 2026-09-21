import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles as s } from "../theme";
import { KeyboardLayout, useInputVisibility } from "./KeyboardLayout";
import { useSuccess } from "./Success";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function Screen({ children }: React.PropsWithChildren) {
  const scroll = React.useRef<ScrollView>(null);
  const reveal = useInputVisibility(() => scroll.current);
  const insets = useSafeAreaInsets();
  return (
    <KeyboardLayout>
    <ScrollView
      ref={scroll}
      onFocus={reveal}
      style={s.page}
      contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
    </KeyboardLayout>
  );
}
export function Button({
  title,
  onPress,
  secondary,
  disabled,
  icon,
  accessibilityLabel,
  dimDisabled = true,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  dimDisabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: secondary ? "#A5CDBF" : "#258778" }}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        ((disabled && dimDisabled) || pressed) && s.disabled,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={21}
          color={secondary ? colors.primary : colors.white}
        />
      )}
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.section}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={s.input}
        {...props}
      />
    </View>
  );
}
export function Badge({ text, warning }: { text: string; warning?: boolean }) {
  return (
    <View style={[s.badge, warning && s.warning]}>
      <Text style={[s.badgeText, warning && { color: colors.amber }]}>
        {text}
      </Text>
    </View>
  );
}
export function Notice({ children }: React.PropsWithChildren) {
  return (
    <View style={s.notice}>
      <Text style={s.text}>{children}</Text>
    </View>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={s.error}
    >
      {error}
    </Text>
  ) : null;
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={[s.card, s.centered]}>
      <Ionicons name="leaf-outline" size={36} color={colors.primary} />
      <Text style={s.heading}>{title}</Text>
      <Text style={[s.text, s.muted, { textAlign: "center" }]}>{detail}</Text>
    </View>
  );
}
export function Chips({
  values,
  selected,
  onSelect,
  all = "All",
}: {
  values: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
  all?: string;
}) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0, width: "100%", minWidth: 0 }}
      contentContainerStyle={[s.row, { paddingVertical: 2, paddingHorizontal: 2 }]}
    >
      {["", ...values].map((value) => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityLabel={value || all}
          accessibilityState={{ selected: value === selected }}
          onPress={() => onSelect(value)}
          style={[s.chip, { flexShrink: 0, paddingVertical: 10 }, value === selected && s.chipActive]}
        >
          <Text style={[s.label, value === selected && s.white]}>
            {value || all}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Quantity({
  value,
  onChange,
  label = "packs",
  minimum = 1,
  productName,
  disabled = false,
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
  minimum?: number;
  productName?: string;
  disabled?: boolean;
}) {
  return (
    <View style={s.row}>
      <Button
        title="−"
        dimDisabled={value <= minimum}
        accessibilityLabel={productName ? `Decrease quantity of ${productName}` : undefined}
        secondary
        disabled={disabled || value <= minimum}
        onPress={() => onChange(value - 1)}
      />
      <View style={{ minHeight: 54, minWidth: 48, justifyContent: "center", alignItems: "center", flexShrink: 1, paddingVertical: 8 }}>
      <Text accessibilityLabel={productName ? `Quantity of ${productName}: ${value}` : undefined} accessibilityLiveRegion="polite" style={[s.text, { textAlign: "center", lineHeight: 26, includeFontPadding: true, textAlignVertical: "center" }]}>
        {value} {label}
      </Text>
      </View>
      <Button
        title="+"
        dimDisabled={value >= 20}
        accessibilityLabel={productName ? `Increase quantity of ${productName}` : undefined}
        secondary
        disabled={disabled || value >= 20}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}
export const money = (value: number) => `₹${value.toFixed(2)}`;
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function useAsync<T>(
  load: () => Promise<T>,
  deps: React.DependencyList,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    load()
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((e) => {
        if (alive) setError(e.message || "Something went wrong. Try again.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, deps);
  return { data, error, loading, setData };
}
export function Loading() {
  return (
    <View style={s.centered}>
      <ActivityIndicator
        size="large"
        color={colors.primary}
        accessibilityLabel="Loading"
      />
    </View>
  );
}
export function useAction() {
  const success = useSuccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = React.useRef(false);
  const run = async (action: () => Promise<void>, message?: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (message) success(message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run };
}
