import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ProductPrice, discountPercent } from "../src/components/ProductPrice";
import { money } from "../src/components/ui";

test("discount display uses MRP, selling price and calculated percentage", () => {
  render(<ProductPrice price={225} mrp={250} />);
  expect(screen.getByLabelText("MRP ₹250")).toHaveStyle({ textDecorationLine: "line-through" });
  expect(screen.getByLabelText("Selling price ₹225")).toBeTruthy();
  expect(screen.getByText("10% OFF")).toBeTruthy();
  expect(discountPercent(85, 100)).toBe(15);
  expect(discountPercent(70, 84)).toBe(16.67);
});

test.each([undefined, 0, 85, 80, NaN])("does not advertise a discount with missing or non-discount MRP %s", mrp => {
  render(<ProductPrice price={85} mrp={mrp} />);
  expect(screen.queryByText(/% OFF/)).toBeNull();
  expect(screen.queryByLabelText(/^MRP/)).toBeNull();
  expect(screen.getByLabelText("Selling price ₹85")).toBeTruthy();
});

test("quantity changes extend both amounts without changing the discount", () => {
  const view = render(<ProductPrice price={85} mrp={100} quantity={2} />);
  expect(screen.getByLabelText("MRP ₹200")).toBeTruthy();
  expect(screen.getByLabelText("Selling price ₹170")).toBeTruthy();
  expect(screen.getByText("15% OFF")).toBeTruthy();
  view.rerender(<ProductPrice price={85} mrp={100} quantity={3} />);
  expect(screen.getByLabelText("Selling price ₹255")).toBeTruthy();
  expect(screen.getByText("15% OFF")).toBeTruthy();
  expect(money(123456.5)).toBe("₹1,23,456.50");
});
