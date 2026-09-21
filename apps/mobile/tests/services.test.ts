import { createMockServices, normalizePhone } from "../src/services/mock";
import { medicines, doctors } from "../src/data/catalog";
import { ProfileInput } from "../src/services/types";
import { fixture, login, photo } from "./helpers";
const profile: ProfileInput = {
  name: "Test Customer",
  address: "1 Demo Road",
  locality: "Barkas",
  landmark: "Demo park",
};

describe("Medicine catalog", () => {
  test("contains only sourced products from the requested manufacturers", async () => {
    const { services } = fixture();
    expect(medicines).toHaveLength(18);
    expect(await services.medicine.list()).toHaveLength(18);
    await expect(services.medicine.get("med-60")).rejects.toThrow(
      "unavailable",
    );
    for (const m of medicines) {
      expect(m.manufacturer).toBeTruthy();
      expect(m.composition).toBeTruthy();
      expect(m.image).toBeTruthy();
    }
  });
  test("searches brand, generic, whitespace and category together", async () => {
    const { services } = fixture();
    expect((await services.medicine.list(" digene ")).length).toBe(2);
    expect((await services.medicine.list("CIPROFLOXACIN")).length).toBe(2);
    expect(await services.medicine.list("ciprofloxacin", "Heart care")).toEqual(
      [],
    );
    expect(await services.medicine.list("", "Heart care")).toHaveLength(1);
  });
});
describe("Doctor directory", () => {
  test("real doctors have hospital profile sources", async () => {
    const { services } = fixture();
    expect(await services.doctor.list()).toHaveLength(9);
    expect(new Set(doctors.map((d) => d.specialty )).size).toBe(8);
    expect(doctors.every((d) => d.sourceUrl.startsWith("https://www.yashodahospitals.com/doctor/"))).toBe(true);
  });
  test("search and specialty/locality filters combine", async () => {
    const { services } = fixture();
    expect(
      await services.doctor.list("santosh reddy", "General Physician", "Malakpet"),
    ).toHaveLength(1);
    expect(await services.doctor.list("", "Cardiologist")).toHaveLength(1);
    expect(await services.doctor.list("santosh reddy", "ENT")).toHaveLength(0);
    expect(await services.doctor.get("yashoda-santosh-reddy")).toMatchObject({
      locality: "Malakpet",
    });
    await expect(services.doctor.get("missing")).rejects.toThrow();
  });
});
describe("Login and profile", () => {
  test("validates phone, wrong OTP, expiry and attempts", async () => {
    const { services, advance } = fixture();
    expect(normalizePhone("+91 90000 00001")).toBe("9000000001");
    expect(() => normalizePhone("123")).toThrow();
    await services.auth.sendOtp("9000000001");
    await expect(
      services.auth.verifyOtp("9000000001", "000000"),
    ).rejects.toThrow("Incorrect");
    advance(300001);
    await expect(
      services.auth.verifyOtp("9000000001", "123456"),
    ).rejects.toThrow("new demo code");
    await services.auth.sendOtp("9000000001");
    for (let i = 0; i < 5; i++)
      await expect(
        services.auth.verifyOtp("9000000001", "0"),
      ).rejects.toThrow();
    await expect(
      services.auth.verifyOtp("9000000001", "123456"),
    ).rejects.toThrow();
  });
  test("returning session survives service recreation; logout clears it", async () => {
    const { services, storage, session, media } = fixture();
    await login(services);
    expect(
      (await createMockServices(storage, session, media).auth.current())?.name,
    ).toBe("Amina Demo");
    await services.auth.logout();
    expect(await services.auth.current()).toBeNull();
    await expect(services.cart.list()).rejects.toThrow("sign in");
  });
  test("registration requires verified phone and valid fields; profile persists", async () => {
    const { services, storage, session, media } = fixture();
    await expect(services.auth.register(profile)).rejects.toThrow("Verify");
    expect(await login(services, "9888888888")).toBeNull();
    await expect(
      services.auth.register({ ...profile, locality: "" }),
    ).rejects.toThrow("locality");
    const user = await services.auth.register(profile);
    expect(user.phone).toBe("9888888888");
    await services.auth.update({ ...profile, address: "2 Demo Road" });
    expect(
      (await createMockServices(storage, session, media).auth.current())
        ?.address,
    ).toBe("2 Demo Road");
  });
});
describe("Cart and orders", () => {
  test("add, increment, remove, persistence and limits", async () => {
    const { services, storage, session, media } = fixture();
    await login(services);
    await Promise.all([
      services.cart.add("abbott-digene-mint", 1),
      services.cart.add("abbott-digene-mint", 2),
    ]);
    expect(await services.cart.list()).toEqual([
      { medicineId: "abbott-digene-mint", quantity: 3 },
    ]);
    await expect(services.cart.add("abbott-digene-mint", 20)).rejects.toThrow("quantity");
    await expect(services.cart.setQuantity("abbott-digene-mint", -1)).rejects.toThrow();
    await expect(services.cart.setQuantity("abbott-digene-mint", 1.5)).rejects.toThrow();
    expect(
      await createMockServices(storage, session, media).cart.list(),
    ).toHaveLength(1);
    await services.cart.setQuantity("abbott-digene-mint", 0);
    expect(await services.cart.list()).toEqual([]);
  });
  test("mixed cart requires prescription in service, rejects invalid photo, preserves cart", async () => {
    const { services } = fixture();
    await login(services);
    await services.cart.add("abbott-digene-mint", 1);
    await services.cart.add("india-2", 1);
    await expect(services.order.place()).rejects.toThrow("prescription");
    await expect(services.order.place({ ...photo, size: 0 })).rejects.toThrow(
      "photo",
    );
    expect(await services.cart.list()).toHaveLength(2);
    const order = await services.order.place(photo);
    expect(order.total).toBe(73);
    expect(order.prescriptionSubmitted).toBe(true);
    expect(order.status).toBe("Order Received");
    expect(order.timeline).toHaveLength(1);
    expect(await services.cart.list()).toEqual([]);
  });
  test("non-Rx checkout succeeds, snapshots address, and duplicate placement fails", async () => {
    const { services } = fixture();
    await login(services);
    await services.cart.add("abbott-digene-mint", 2);
    const results = await Promise.allSettled([
      services.order.place(),
      services.order.place(),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const order = (await services.order.list()).find((o) =>
      o.status === "Order Received",
    )!;
    expect(order.total).toBe(56);
    await services.auth.update(profile);
    expect((await services.order.get(order.id)).delivery.name).toBe(
      "Amina Demo",
    );
  });
  test("orders and carts are isolated by account", async () => {
    const { services } = fixture();
    await login(services);
    await services.cart.add("abbott-digene-mint", 1);
    const order = await services.order.place();
    await services.cart.add("reddy-becozinc", 1);
    await services.auth.logout();
    await login(services, "9000000002");
    await expect(services.order.get(order.id)).rejects.toThrow("not found");
    expect(await services.cart.list()).toEqual([]);
    expect(
      (await services.order.list()).every((o) => o.customerId === "customer-2"),
    ).toBe(true);
  });
  test("storage failure preserves cart and does not claim an order was placed", async () => {
    const { services, storage } = fixture();
    await login(services);
    await services.cart.add("abbott-digene-mint", 1);
    const save = storage.setItem;
    storage.setItem = jest.fn(async () => {
      throw new Error("Disk full");
    });
    await expect(services.order.place()).rejects.toThrow("Disk full");
    storage.setItem = save;
    expect(await services.cart.list()).toHaveLength(1);
    expect(await services.order.list()).toHaveLength(3);
  });
});
describe("Photo-only medicine requests", () => {
  test("validates, persists one photo, and isolates requests", async () => {
    const { services, storage, session, media } = fixture();
    await login(services);
    await expect(services.request.submit(undefined as never)).rejects.toThrow();
    const request = await services.request.submit(photo);
    expect(Object.keys(request).sort()).toEqual([
      "customerId",
      "date",
      "id",
      "photo",
      "status",
    ]);
    expect(
      (await createMockServices(storage, session, media).request.list()).some(
        (r) => r.id === request.id,
      ),
    ).toBe(true);
    await services.auth.logout();
    await login(services, "9000000002");
    expect(
      (await services.request.list()).some((r) => r.id === request.id),
    ).toBe(false);
  });
});

test("cart quantity changes preserve product order and other quantities", async () => {
  const { services } = fixture();
  await login(services);
  await services.cart.add("abbott-digene-mint", 1);
  await services.cart.add("reddy-becozinc", 3);
  await services.cart.setQuantity("abbott-digene-mint", 2);
  expect(await services.cart.list()).toEqual([
    { medicineId: "abbott-digene-mint", quantity: 2 },
    { medicineId: "reddy-becozinc", quantity: 3 },
  ]);
  await services.cart.add("abbott-digene-mint", 1);
  expect(await services.cart.list()).toEqual([
    { medicineId: "abbott-digene-mint", quantity: 3 },
    { medicineId: "reddy-becozinc", quantity: 3 },
  ]);
});


test("short order IDs are alphanumeric, collision safe and migrate existing orders", async () => {
  const { shortOrderId } = require("../src/services/mock");
  const first = shortOrderId("fixed-source", new Set());
  const second = shortOrderId("fixed-source", new Set([first]));
  expect(first).toMatch(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/);
  expect(second).not.toBe(first);
  const { services, storage } = fixture();
  await login(services);
  const raw = JSON.parse((await storage.getItem("hp.demo.v1"))!);
  raw.orders[0].id = "HP-legacy-long-id";
  await storage.setItem("hp.demo.v1", JSON.stringify(raw));
  const orders = await services.order.list();
  expect(orders.every(order => /^[A-Z0-9]{6}$/.test(order.id))).toBe(true);
  expect((await services.order.get(orders[0].id)).total).toBe(orders[0].total);
  expect((await services.order.list())[0].id).toBe(orders[0].id);
  await services.cart.add("abbott-digene-mint", 1);
  expect((await services.order.place()).id).toMatch(/^[A-Z0-9]{6}$/);
});

test("catalog includes real pack images, Rx and OTC products across all three manufacturers", async () => {
  const { productImages } = require("../src/data/productImages");
  expect(new Set(medicines.map(m => m.manufacturerGroup))).toEqual(new Set(["Cipla", "Abbott", "Dr. Reddy's"]));
  expect(medicines.filter(m => m.prescriptionRequired)).toHaveLength(11);
  expect(medicines.filter(m => !m.prescriptionRequired)).toHaveLength(7);
  expect(new Set(medicines.map(m => m.dosageForm)).size).toBeGreaterThanOrEqual(8);
  expect(new Set(medicines.map(m => m.id)).size).toBe(medicines.length);
  for (const m of medicines) {
    expect(m.sourceUrl).toMatch(/^https:\/\/www.apollopharmacy.in\//);
    expect(productImages[m.image]).toBeDefined();
  }
  const { services } = fixture();
  expect(await services.medicine.list("Cipla")).toHaveLength(7);
  expect(await services.medicine.list("Dr. Reddy")).toHaveLength(5);
  expect(await services.medicine.list("Abbott")).toHaveLength(6);
});

test("retired products leave the cart without changing historical orders or replacing medicines", async () => {
  const { services, storage } = fixture();
  await login(services);
  const db = JSON.parse((await storage.getItem("hp.demo.v1"))!);
  db.carts["customer-1"] = [{ medicineId: "med-1", quantity: 2 }, { medicineId: "india-2", quantity: 3 }, { medicineId: "india-10", quantity: 1 }];
  const history = db.orders;
  await storage.setItem("hp.demo.v1", JSON.stringify(db));
  expect(await services.cart.list()).toEqual([{ medicineId: "india-2", quantity: 3 }]);
  expect((await services.order.list()).map(o => o.items)).toEqual(history.filter((o: any) => o.customerId === "customer-1").map((o: any) => o.items));
  await expect(services.cart.add("med-1", 1)).rejects.toThrow("unavailable");
});
