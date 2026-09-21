import React, { useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles as s } from "../theme";
import { KeyboardLayout } from "./KeyboardLayout";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function SearchableSelect({ label, values, selected, onSelect, emptyLabel }: {
  label: string; values: readonly string[]; selected: string;
  onSelect: (value: string) => void; emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const matches = values.filter(value => value.toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { Keyboard.dismiss(); setOpen(false); setQuery(""); };
  const choose = (value: string) => { onSelect(value); close(); };
  return <View style={{ gap: 6 }}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={[s.input, s.between]}>
      <Text style={s.text}>{selected || emptyLabel}</Text><Ionicons name="chevron-down" size={20} color={colors.primary} />
    </Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <KeyboardLayout>
      <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end", alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss options" onPress={close} style={{ flex: 1, width: "100%" }} />
        <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 480, maxHeight: "85%", flexShrink: 1, backgroundColor: colors.white, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View style={s.between}><Text style={s.heading}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={close} style={{ padding: 12 }}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
          <TextInput autoFocus accessibilityLabel={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} value={query} onChangeText={setQuery} style={s.input} placeholderTextColor={colors.muted} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" onPress={() => choose("")} style={{ paddingVertical: 16 }}><Text style={[s.label, { color: colors.primary }]}>{emptyLabel}</Text></Pressable>
            {matches.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === selected }} onPress={() => choose(value)} style={[s.between, { paddingVertical: 16, borderTopWidth: 1, borderColor: colors.border }]}><Text style={s.text}>{value}</Text>{selected === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}</Pressable>)}
            {!matches.length && <Text style={s.small}>No matches found. Try another search.</Text>}
          </ScrollView>
        </View>
      </View>
      </KeyboardLayout>
    </Modal>
  </View>;
}
