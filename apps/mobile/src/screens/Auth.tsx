import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../services/Provider";
import { colors, styles as s } from "../theme";
import {
  Button,
  ErrorText,
  Field,
  Notice,
  Screen,
  useAction,
} from "../components/ui";
import { ProfileForm } from "../components/ProfileForm";

export function AuthScreen() {
  const { services, refresh } = useApp();
  const [step, setStep] = useState<"phone" | "otp" | "register">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const { busy, error, run } = useAction();
  return (
    <Screen>
      {step === "phone" && (
        <View style={[s.between, { marginTop: 24, backgroundColor: colors.mint, borderRadius: 12, padding: 16 }]}>
          <View style={{ flex: 1, gap: 8 }}>
            <Ionicons name="leaf" size={44} color={colors.primary} />
            <Text style={[s.heading, { color: colors.primary }]}>Hyderabad{"\n"}Pharmacy</Text>
            <Text style={s.small}>Your Health, Our Priority</Text>
          </View>
          <Image source={require("../../assets/charminar-cutout.png")} style={{ width: "48%", height: 180 }} resizeMode="contain" accessibilityLabel="Charminar, Hyderabad" />
        </View>
      )}
      <Text style={s.title}>
        {step === "phone"
          ? "Welcome"
          : step === "otp"
            ? "Verify your number"
            : "Let’s get to know you"}
      </Text>
      <Text style={s.text}>
        {step === "phone"
          ? "Sign in or create an account with your mobile number."
          : step === "otp"
            ? `Enter the demo code for +91 ${phone}.`
            : "Add your details for a smooth delivery."}
      </Text>
      <Notice>
        Demo app · No SMS is sent. Use code {services.reference.demoOtp}. Please
        use fictional personal details and photos.
      </Notice>
      {step === "phone" && (
        <>
          <Field
            label="Mobile number"
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
            maxLength={16}
          />
          <Button
            title="Continue"
            disabled={busy}
            onPress={() =>
              run(async () => {
                await services.auth.sendOtp(phone);
                setStep("otp");
              }, "Demo code ready. Use 123456.")
            }
          />
          <Button
            title="Try a demo account"
            secondary
            disabled={busy}
            onPress={() =>
              run(async () => {
                setPhone(services.reference.demoPhone);
                await services.auth.sendOtp(services.reference.demoPhone);
                setStep("otp");
              }, "Demo code ready. Use 123456.")
            }
          />
        </>
      )}
      {step === "otp" && (
        <>
          <Field
            label="6-digit demo code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            title="Verify & continue"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const user = await services.auth.verifyOtp(phone, code);
                if (user) { await refresh(); }
                else { setStep("register"); }
              })
            }
          />
          <Button
            title="Resend demo code"
            secondary
            disabled={busy}
            onPress={() =>
              run(async () => {
                await services.auth.sendOtp(phone);
                setCode("");
              }, "Demo code reset. Use 123456.")
            }
          />
          <Button
            title="Change phone number"
            secondary
            onPress={() => {
              setCode("");
              setStep("phone");
            }}
          />
        </>
      )}
      {step === "register" && (
        <>
          <Text style={s.label}>Phone: +91 {phone}</Text>
          <ProfileForm
            label="Create account"
            busy={busy}
            onSave={(input) =>
              run(async () => {
                await services.auth.register(input);
                await refresh();
              }, "Account created successfully.")
            }
          />
          <Button
            title="Back to sign in"
            secondary
            onPress={() => setStep("phone")}
          />
        </>
      )}
      <ErrorText error={error} />
      <Text style={s.small}>
        Medicines, local doctors and thoughtful care — all in one place.
      </Text>
    </Screen>
  );
}
