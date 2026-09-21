import React, { useState } from "react";
import { Text, View } from "react-native";
import { ProfileInput } from "../services/types";
import { useApp } from "../services/Provider";
import { styles as s } from "../theme";
import { Button, Field } from "./ui";
import { SearchableSelect } from "./SearchableSelect";

export function ProfileForm({
  initial,
  onSave,
  busy,
  label,
}: {
  initial?: ProfileInput;
  onSave: (profile: ProfileInput) => void;
  busy: boolean;
  label: string;
}) {
  const { services } = useApp();
  const [values, setValues] = useState<ProfileInput>(
    initial ?? { name: "", address: "", locality: "", landmark: "" },
  );
  const set = (key: keyof ProfileInput, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  return (
    <View style={s.section}>
      <Field
        label="Full name"
        value={values.name}
        onChangeText={(v) => set("name", v)}
        autoComplete="name"
        maxLength={80}
      />
      <Field
        label="Delivery address"
        value={values.address}
        onChangeText={(v) => set("address", v)}
        multiline
        maxLength={200}
      />

      <SearchableSelect label="Locality"
        values={services.reference.localities}
        selected={values.locality}
        onSelect={(v) => set("locality", v)}
        emptyLabel="Choose locality"
      />
      <Field
        label="Nearby landmark"
        value={values.landmark}
        onChangeText={(v) => set("landmark", v)}
        maxLength={120}
      />
      <Button
        title={busy ? "Saving…" : label}
        disabled={busy}
        onPress={() => onSave(values)}
      />
    </View>
  );
}
