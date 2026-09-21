import React, { useRef, useState } from "react";
import { Text } from "react-native";
import { Media } from "../services/types";
import { REQUEST_SUCCESS } from "../services/rules";
import { useApp } from "../services/Provider";
import { useNav } from "../navigation/types";
import { styles as s } from "../theme";
import { Button, ErrorText, Notice, Screen, useAction } from "../components/ui";
import { PhotoPicker } from "../components/PhotoPicker";
import { SuccessNotice } from "../components/Success";

export function RequestScreen() {
  const { services, refresh } = useApp();
  const nav = useNav();
  const [photo, setPhoto] = useState<Media>();
  const retained = useRef(false);
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState(false);
  const action = useAction();
  return (
    <Screen>
      <Text style={s.title}>A photo.{"\n"}We’ll handle the rest.</Text>
      <Text style={s.text}>
        Take or upload one clear photo of the medicine you need.
      </Text>
      {done ? (
        <>
          <SuccessNotice large message={REQUEST_SUCCESS} />
          <Button
            title="Back to Home"
            onPress={() => nav.navigate("Tabs", { screen: "Home" })}
          />
        </>
      ) : (
        <>
          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            retainedRef={retained}
            disabled={action.busy}
            onBusyChange={setPicking}
          />
          <Button
            title={action.busy ? "Sending…" : "Send request"}
            disabled={!photo || picking || action.busy}
            onPress={() =>
              action.run(async () => {
                if (!photo) return;
                await services.request.submit(photo);
                retained.current = true;
                setDone(true);
                await refresh();
              })
            }
          />
        </>
      )}
      <ErrorText error={action.error} />
      <Text style={s.small}>Demo mode · Requests stay on this device.</Text>
    </Screen>
  );
}
