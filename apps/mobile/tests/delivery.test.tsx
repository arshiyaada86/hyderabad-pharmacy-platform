import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AppProvider } from "../src/services/Provider";
import { CartScreen } from "../src/screens/Cart";
import { fixture, login } from "./helpers";
import { medicines } from "../src/data/catalog";
jest.mock("../src/navigation/types", () => ({ useNav: () => ({ navigate: jest.fn(), replace: jest.fn() }) }));

test("checkout requires an explicit selection and adds a flat contribution to the total", async () => {
  const { services } = fixture();
  await login(services);
  await services.cart.add(medicines[0].id, 2);
  render(<AppProvider services={services}><CartScreen /></AppProvider>);
  expect(await screen.findByRole("button", { name: "Place order" })).toBeDisabled();
  for (const amount of [0, 10, 20]) {
    fireEvent.press(screen.getByRole("radio", { name: `Delivery contribution ₹${amount}` }));
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
    expect(screen.getByText(`Includes ₹${amount} delivery contribution.`)).toBeTruthy();
    expect(screen.getAllByText(`₹${medicines[0].price * 2 + amount}`).length).toBeGreaterThan(0);
  }
  fireEvent.press(screen.getByRole("button", { name: `Increase quantity of ${medicines[0].brandName}` }));
  await waitFor(() => expect(screen.getByLabelText(`Quantity of ${medicines[0].brandName}: 3`)).toBeTruthy());
  expect(screen.getByText(`₹${medicines[0].price * 3 + 20}`)).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled());
  fireEvent.press(screen.getByRole("button", { name: "Place order" }));
  await waitFor(async () => expect((await services.order.list())[0].deliveryContribution).toBe(20));
});

test.each([0, 10, 20] as const)("order saves contribution %s once, and repeat orders do not carry it forward", async amount => {
  const { services } = fixture();
  await login(services);
  await services.cart.add(medicines[0].id, 3);
  const order = await services.order.place(amount);
  expect(order.total).toBe(medicines[0].price * 3 + amount);
  expect((await services.order.get(order.id)).deliveryContribution).toBe(amount);
  await services.order.again(order.id);
  const repeated = await services.order.place(0);
  expect(repeated.total).toBe(medicines[0].price * 3);
});

test.each([undefined, null, -10, 5, 30, "10", NaN])("rejects missing or invalid contribution %s without clearing cart", async amount => {
  const { services } = fixture();
  await login(services);
  await services.cart.add(medicines[0].id, 1);
  await expect(services.order.place(amount as 0)).rejects.toThrow("Select a delivery contribution");
  expect(await services.cart.list()).toHaveLength(1);
});
