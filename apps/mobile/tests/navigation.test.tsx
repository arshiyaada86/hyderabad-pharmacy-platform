import React from "react";
import { Linking, Vibration } from "react-native";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigation } from "../src/navigation/AppNavigation";
import { AppProvider } from "../src/services/Provider";
import { fixture, login } from "./helpers";

test("returning login reaches five tabs, doctor profile and cart", async () => {
  const { services } = fixture();
  render(
    <SafeAreaProvider>
      <AppProvider services={services}>
        <AppNavigation />
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText("Welcome");
  fireEvent.press(screen.getByRole("button", { name: "Try a demo account" }));
  await screen.findByText("Verify your number");
  fireEvent.changeText(screen.getByLabelText("6-digit demo code"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "Verify & continue" }));
  await screen.findByText("Good care starts close to home.");
  for (const name of ["Home", "Medicines", "Orders", "Doctors", "Profile"])
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  fireEvent.press(screen.getByText("Doctors"));
  await screen.findByText("Find your doctor");
  fireEvent.press(
    await screen.findByRole("button", { name: "View Dr. C.H. Santosh Reddy" }),
  );
  await screen.findByText("Consultation timings");
  expect(screen.queryByText("Clinic location")).toBeNull();
  expect(screen.queryByText("View on Google Maps")).toBeNull();
  const openMaps = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  fireEvent.press(screen.getByRole("button", { name: "Get Directions" }));
  await waitFor(() => expect(openMaps).toHaveBeenCalledWith(expect.stringContaining("https://www.google.com/maps/dir/?api=1&destination=")));
  openMaps.mockRestore();
  fireEvent.press(screen.getByRole("button", { name: "Open cart" }));
  await screen.findByText("Your cart is empty");
});
test("medicine to cart flow, prescription gate and order confirmation", async () => {
  const { services } = fixture();
  await login(services);
  render(
    <SafeAreaProvider>
      <AppProvider services={services}>
        <AppNavigation />
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText("Good care starts close to home.");
  fireEvent.press(screen.getByRole("button", { name: "Shop Medicines" }));
  fireEvent.changeText(
    await screen.findByLabelText("Search medicines"),
    "Ciplox 500",
  );
  fireEvent.press(await screen.findByRole("button", { name: "View Ciplox 500" }));
  await screen.findByText("Product details");
  fireEvent.press(screen.getByRole("button", { name: "Add to cart" }));
  await screen.findByText("In your cart");
  expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
  expect(screen.queryByText("Added to your cart.")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "View cart" }));
  await screen.findByText("Add your prescription");
  expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "Upload photo" }));
  await screen.findByLabelText("Selected photo preview");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole("button", { name: "Place order" }));
  await screen.findByText(
    "Order received successfully. Our pharmacy team will call you shortly to confirm medicine availability.",
  );
  expect(screen.getByText("Order Placed")).toBeTruthy();
  expect(screen.getAllByTestId("animated-success-icon").length).toBeGreaterThan(0);
  expect(screen.queryByText("Confirmation Pending")).toBeNull();
});

test("cart badge follows additions, isolated quantity updates, removal and checkout", async () => {
  const vibration = jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
  vibration.mockClear();
  const { services } = fixture();
  await login(services);
  await services.cart.add("abbott-digene-mint", 1);
  await services.cart.add("reddy-becozinc", 3);
  render(<SafeAreaProvider><AppProvider services={services}><AppNavigation /></AppProvider></SafeAreaProvider>);
  await screen.findByText("Good care starts close to home.");
  expect(screen.getByTestId("cart-count")).toHaveTextContent("4");
  fireEvent.press(await screen.findByRole("button", { name: "View Digene Mint" }));
  expect(screen.queryByText("Prescription Required")).toBeNull();
  expect(screen.queryByText("No Prescription Required")).toBeNull();
  expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
  fireEvent.press(await screen.findByRole("button", { name: "Increase quantity of Digene Mint" }));
  await screen.findByLabelText("Quantity of Digene Mint: 2");
  expect(screen.queryByText("Added to your cart.")).toBeNull();
  expect(screen.getByTestId("cart-count")).toHaveTextContent("5");
  expect(vibration).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole("button", { name: "View cart" }));
  fireEvent.press(await screen.findByRole("button", { name: "Increase quantity of Digene Mint" }));
  await screen.findByLabelText("Quantity of Digene Mint: 3");
  expect(screen.getByLabelText("Quantity of Becozinc: 3")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Decrease quantity of Digene Mint" })).toBeEnabled());
  fireEvent.press(screen.getByRole("button", { name: "Decrease quantity of Digene Mint" }));
  await screen.findByLabelText("Quantity of Digene Mint: 2");
  expect(screen.getByLabelText("Quantity of Becozinc: 3")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Remove Becozinc" })).toBeEnabled());
  fireEvent.press(screen.getByRole("button", { name: "Remove Becozinc" }));
  await waitFor(() => expect(screen.queryByLabelText("Quantity of Becozinc: 3")).toBeNull());
  await waitFor(() => expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled());
  fireEvent.press(screen.getByRole("button", { name: "Place order" }));
  await screen.findByText("Order received successfully. Our pharmacy team will call you shortly to confirm medicine availability.");
  expect(screen.queryByTestId("cart-count")).toBeNull();
  expect(vibration).toHaveBeenCalledTimes(4);
  vibration.mockRestore();
});


test("add button becomes cart controls, guards duplicate taps and returns after removal", async () => {
  const { services } = fixture();
  await login(services);
  render(<SafeAreaProvider><AppProvider services={services}><AppNavigation /></AppProvider></SafeAreaProvider>);
  fireEvent.press(await screen.findByRole("button", { name: "View Digene Mint" }));
  const add = await screen.findByRole("button", { name: "Add to cart" });
  fireEvent.press(add);
  fireEvent.press(add);
  await screen.findByLabelText("Quantity of Digene Mint: 1");
  expect(await services.cart.list()).toEqual([{ medicineId: "abbott-digene-mint", quantity: 1 }]);
  expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Decrease quantity of Digene Mint" })).toBeEnabled());
  fireEvent.press(screen.getByRole("button", { name: "Decrease quantity of Digene Mint" }));
  await screen.findByRole("button", { name: "Add to cart" });
  expect(await services.cart.list()).toEqual([]);
  expect(screen.queryByTestId("cart-count")).toBeNull();
});

test("profile menu opens editable account information and category-only browsing", async () => {
  const { services } = fixture();
  await login(services);
  render(<SafeAreaProvider><AppProvider services={services}><AppNavigation /></AppProvider></SafeAreaProvider>);
  fireEvent.press(await screen.findByText("Profile"));
  for (const name of ["Account information", "My orders", "Medicine requests", "Help & support", "Terms & conditions", "Privacy information", "About Hyderabad Pharmacy", "Logout"])
    expect(screen.getByRole("button", { name })).toBeTruthy();
  expect(screen.queryByLabelText("Delivery address")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Account information" }));
  await screen.findByLabelText("Delivery address");
  fireEvent.changeText(screen.getByLabelText("Full name"), "Amina Updated");
  fireEvent.press(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Profile saved successfully.");
  expect((await services.auth.current())?.name).toBe("Amina Updated");
});

test("medicine browsing offers category filters without brand or prescription tabs", async () => {
  const { services } = fixture();
  await login(services);
  render(<SafeAreaProvider><AppProvider services={services}><AppNavigation /></AppProvider></SafeAreaProvider>);
  fireEvent.press(await screen.findByRole("button", { name: "See all medicines" }));
  await screen.findByLabelText("Search medicines");
  for (const name of ["All brands", "Dr. Reddy's", "Abbott", "Cipla", "All types", "Prescription", "Non-prescription"])
    expect(screen.queryByRole("button", { name })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Skin & Personal Care" }));
  await screen.findByRole("button", { name: "View Cipladine" });
  expect(screen.queryByRole("button", { name: "View Digene Mint" })).toBeNull();
});
