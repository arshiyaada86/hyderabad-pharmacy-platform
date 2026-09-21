import React, { useEffect, useRef, useState } from "react";
import { FlatList, FlatListProps, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";

// Mobile Safari/Chrome resize the visual viewport, not necessarily the page layout.
// Constrain the app to that visible area so its scroll containers and actions remain reachable.
export function useWebKeyboardViewport() {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    let frame: number;
    const update = () => {
      setHeight(viewport?.height);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(active.tagName)) {
          active.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
    };
  }, []);
  return height;
}

// A resized viewport leaves results, actions and errors scrollable above the keyboard.
export function KeyboardLayout({ children }: React.PropsWithChildren) {
  const view = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const viewportHeight = useWebKeyboardViewport();
  return <View ref={view} style={{ flex: 1, minWidth: 0, maxHeight: viewportHeight }} onLayout={() => view.current?.measureInWindow((_x, y) => setOffset(y))}><KeyboardAvoidingView
    style={{ flex: 1, minWidth: 0 }}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    enabled={Platform.OS !== "web"} keyboardVerticalOffset={offset}
  >{children}</KeyboardAvoidingView></View>;
}

export function useInputVisibility(getScroll: () => ScrollView | null | undefined) {
  const getter = useRef(getScroll);
  getter.current = getScroll;
  const frame = useRef<number | undefined>(undefined);
  const reveal = () => {
    if (Platform.OS === "web") return;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (input) getter.current()?.scrollResponderScrollNativeHandleToKeyboard(input, 96, true);
    });
  };
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", reveal);
    const changed = Keyboard.addListener("keyboardDidChangeFrame", reveal);
    return () => { shown.remove(); changed.remove(); if (frame.current !== undefined) cancelAnimationFrame(frame.current); };
  }, []);
  return reveal;
}

export function KeyboardList<ItemT>(props: FlatListProps<ItemT>) {
  const list = useRef<FlatList<ItemT>>(null);
  // React Native's FlatList declaration uses JSX.Element for this imperative responder.
  const reveal = useInputVisibility(() => list.current?.getScrollResponder() as unknown as ScrollView | null);
  return <KeyboardLayout><FlatList {...props} ref={list} onFocus={reveal} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" /></KeyboardLayout>;
}
