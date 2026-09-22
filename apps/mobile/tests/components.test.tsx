import React from "react";
import {
  act,
  fireEvent,
  fireEventAsync,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { TextInput, Vibration } from "react-native";
import { AppProvider } from "../src/services/Provider";
import { Button, Quantity } from "../src/components/ui";
import { ProfileForm } from "../src/components/ProfileForm";
import { PhotoPicker } from "../src/components/PhotoPicker";
import { RequestScreen } from "../src/screens/Request";
import { fixture, login, photo } from "./helpers";
import { Media } from "../src/services/types";
jest.mock("../src/navigation/types", () => ({
  useNav: () => ({ navigate: jest.fn() }),
}));

test("buttons respect disabled state and quantity boundaries", () => {
  const press = jest.fn();
  const change = jest.fn();
  render(
    <>
      <Button title="Send" onPress={press} disabled />
      <Quantity value={1} onChange={change} />
    </>,
  );
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "−" })).toBeDisabled();
  expect(press).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "+" }));
  expect(change).toHaveBeenCalledWith(2);
});
test("profile form submits editable delivery fields", async () => {
  const { services } = fixture();
  const save = jest.fn();
  render(
    <AppProvider services={services}>
      <ProfileForm busy={false} label="Save" onSave={save} />
    </AppProvider>,
  );
  await act(async () => {});
  fireEvent.changeText(screen.getByLabelText("Full name"), "Test Person");
  fireEvent.changeText(screen.getByLabelText("Delivery address"), "Demo Road");
  fireEvent.changeText(screen.getByLabelText("Nearby landmark"), "Demo park");
  fireEvent.press(screen.getByRole("button", { name: "Choose locality" }));
  fireEvent.changeText(screen.getByLabelText("Search locality"), "Bark");
  fireEvent.press(screen.getByRole("button", { name: "Barkas" }));
  fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith({
    name: "Test Person",
    address: "Demo Road",
    locality: "Barkas",
    landmark: "Demo park",
  });
});
test("photo picker supports preview, replacement and removal", async () => {
  const { services, media } = fixture();
  function Harness() {
    const [value, setValue] = React.useState<Media>();
    return <PhotoPicker value={value} onChange={setValue} allowFile />;
  }
  render(
    <AppProvider services={services}>
      <Harness />
    </AppProvider>,
  );
  await act(async () => {});
  await fireEventAsync.press(
    screen.getByRole("button", { name: "Upload photo" }),
  );
  await screen.findByLabelText("Selected photo preview");
  await fireEventAsync.press(
    screen.getByRole("button", { name: "Replace with camera" }),
  );
  expect(media.pick).toHaveBeenCalledWith("camera");
  expect(media.remove).toHaveBeenCalledWith(photo);
  await fireEventAsync.press(
    screen.getByRole("button", { name: "Remove photo" }),
  );
  expect(screen.queryByLabelText("Selected photo preview")).toBeNull();
});
test("request medicine has no text fields, requires one photo, persists and shows exact success text", async () => {
  const vibration = jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
  vibration.mockClear();
  const { services, media } = fixture();
  await login(services);
  const view = render(
    <AppProvider services={services}>
      <RequestScreen />
    </AppProvider>,
  );
  expect(view.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "Upload photo" }));
  await screen.findByLabelText("Selected photo preview");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole("button", { name: "Send request" }));
  await screen.findByText("Request received. We'll contact you soon.");
  expect(await services.request.list()).toHaveLength(2);
  expect(media.remove).not.toHaveBeenCalled();
  expect(vibration).toHaveBeenCalledTimes(1);
  expect(vibration).toHaveBeenCalledWith(35);
  vibration.mockRestore();
});

test("failed cart quantity update preserves displayed quantities", async () => {
  const { services } = fixture();
  await login(services);
  await services.cart.add("abbott-digene-mint", 1);
  await services.cart.add("reddy-becozinc", 2);
  services.cart.setQuantity = jest.fn(async () => { throw new Error("Could not save cart. Try again."); });
  const { CartScreen } = require("../src/screens/Cart");
  render(<AppProvider services={services}><CartScreen /></AppProvider>);
  fireEvent.press(await screen.findByRole("button", { name: "Increase quantity of Digene Mint" }));
  await screen.findByText("Could not save cart. Try again.");
  expect(screen.getByLabelText("Quantity of Digene Mint: 1")).toBeTruthy();
  expect(screen.getByLabelText("Quantity of Becozinc: 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Increase quantity of Digene Mint" })).toBeEnabled();
});


test("checkout stays visually steady but disabled while a cart quantity saves", async () => {
  const { services } = fixture();
  await login(services);
  await services.cart.add("abbott-digene-mint", 1);
  const original = services.cart.setQuantity;
  let release!: () => void;
  services.cart.setQuantity = async (id, quantity) => {
    await new Promise<void>(resolve => { release = resolve; });
    await original(id, quantity);
  };
  const { CartScreen } = require("../src/screens/Cart");
  render(<AppProvider services={services}><CartScreen /></AppProvider>);
  const checkout = await screen.findByRole("button", { name: "Place order" });
  const before = checkout.props.style;
  fireEvent.press(screen.getByRole("button", { name: "Increase quantity of Digene Mint" }));
  expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Place order" }).props.style).toEqual(before);
  await act(async () => { release(); });
  await screen.findByLabelText("Quantity of Digene Mint: 2");
  await waitFor(() => expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled());
});
