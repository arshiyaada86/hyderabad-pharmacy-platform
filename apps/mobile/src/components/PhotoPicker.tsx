import React, { useEffect, useRef } from "react";
import { Image, Text, View } from "react-native";
import { Media } from "../services/types";
import { useApp } from "../services/Provider";
import { styles as s } from "../theme";
import { Button, ErrorText, useAction } from "./ui";
import { useSuccess } from "./Success";

export function PhotoPicker({
  value,
  onChange,
  allowFile = false,
  retainedRef,
  disabled = false,
  onBusyChange,
}: {
  value?: Media;
  onChange: (media?: Media) => void;
  allowFile?: boolean;
  retainedRef?: React.RefObject<boolean>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { services } = useApp();
  const success = useSuccess();
  const { busy, error, run } = useAction();
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      if (latest.current && !retainedRef?.current)
        void services.media.remove(latest.current).catch(() => undefined);
    },
    [services, retainedRef],
  );
  const pick = (source: "camera" | "gallery" | "file") =>
    run(async () => {
      const next = await services.media.pick(source);
      if (next) {
        if (value) await services.media.remove(value);
        onChange(next);
        success(value ? "Photo replaced successfully." : "Photo added successfully.");
      }
    });
  return (
    <View style={s.section}>
      {value ? (
        <>
          <Image
            source={{ uri: value.uri }}
            style={s.photo}
            accessibilityLabel="Selected photo preview"
            resizeMode="contain"
          />
          <Button
            title="Remove photo"
            secondary
            disabled={busy || disabled}
            onPress={() =>
              run(async () => {
                await services.media.remove(value);
                onChange(undefined);
              }, "Photo removed.")
            }
          />
        </>
      ) : (
        <View style={[s.card, s.centered]}>
          <Text style={s.heading}>One clear photo is all we need</Text>
          <Text style={s.small}>JPG, PNG or WebP · up to 10 MB</Text>
        </View>
      )}
      <Button
        title={value ? "Replace with camera" : "Take photo"}
        icon="camera-outline"
        secondary
        disabled={busy || disabled}
        onPress={() => pick("camera")}
      />
      <Button
        title={value ? "Replace from gallery" : "Upload photo"}
        icon="image-outline"
        secondary
        disabled={busy || disabled}
        onPress={() => pick("gallery")}
      />
      {allowFile && (
        <Button
          title="Choose image file"
          icon="document-outline"
          secondary
          disabled={busy || disabled}
          onPress={() => pick("file")}
        />
      )}
      <ErrorText error={error} />
    </View>
  );
}
