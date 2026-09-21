import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useReducedMotion } from "./Success";
import { styles as s } from "../theme";

export const GREETINGS = ["Assalamualaikum", "Good Morning", "నమస్కారం"];
export function greetingLetters(text: string): string[] {
  if (typeof Intl.Segmenter === "function") return [...new Intl.Segmenter("te", { granularity: "grapheme" }).segment(text)].map(part => part.segment);
  return text.match(/\P{Mark}\p{Mark}*/gu) ?? [text];
}
export function TypingGreeting() {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(0);
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const letters = greetingLetters(GREETINGS[index]);
  useEffect(() => {
    if (!focused || reduced) return;
    const timer = setTimeout(() => {
      if (length < letters.length) setLength(n => n + 1);
      else { setLength(0); setIndex(n => (n + 1) % GREETINGS.length); }
    }, length < letters.length ? 115 : 1800);
    return () => clearTimeout(timer);
  }, [focused, reduced, index, length, letters.length]);
  return <View accessible accessibilityLabel={GREETINGS[index]} style={{ minHeight: 28, justifyContent: "center" }}>
    <Text accessible={false} style={[s.label, s.white, { lineHeight: 26 }]}>{reduced ? GREETINGS[index] : letters.slice(0, length).join("")}<Text style={{ opacity: 0.7 }}>{reduced ? "" : "|"}</Text></Text>
  </View>;
}
