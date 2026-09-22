import { fixture, login } from "./helpers";
import { medicines } from "../src/data/catalog";
import { ORDER_STEPS } from "../src/services/rules";

test("Order Again uses available items, exact quantities and current prices without placing an order", async () => {
  const { services, storage } = fixture();
  await login(services);
  const db = JSON.parse((await storage.getItem("hp.demo.v1"))!);
  const past = db.orders.find((o: any) => o.customerId === "customer-1" && o.status === "Delivered");
  past.items = [
    { medicine: { ...medicines[0], price: 12, mrp: 20 }, quantity: 3 },
    { medicine: { ...medicines[1], id: "retired", brandName: "Retired product" }, quantity: 2 },
  ];
  await storage.setItem("hp.demo.v1", JSON.stringify(db));
  await services.cart.add(medicines[0].id, 1);
  await services.cart.add(medicines[1].id, 2);
  const beforeOrders = await services.order.list();
  const result = await services.order.again(past.id);
  expect(result.available).toEqual([{ medicineId: medicines[0].id, name: medicines[0].brandName, quantity: 3, previousPrice: 12, currentPrice: medicines[0].price }]);
  expect(result.unavailable).toEqual([`Retired product · ${medicines[1].packageSize}`]);
  expect(await services.cart.list()).toEqual([{ medicineId: medicines[0].id, quantity: 3 }, { medicineId: medicines[1].id, quantity: 2 }]);
  await services.order.again(past.id);
  expect((await services.cart.list())[0].quantity).toBe(3);
  expect(await services.order.list()).toEqual(beforeOrders);
  const placed = await services.order.place(0);
  expect(placed.total).toBe(medicines[0].price * 3 + medicines[1].price * 2);
  expect(placed.items[0].medicine.mrp).toBe(medicines[0].mrp);
  expect((await services.order.get(past.id)).items[0].medicine.mrp).toBe(20);
});

test("repeat ordering enforces account ownership and preserves cart on failed writes", async () => {
  const { services, storage } = fixture();
  await login(services);
  const id = (await services.order.list())[0].id;
  await services.auth.logout();
  await login(services, "9000000002");
  await expect(services.order.again(id)).rejects.toThrow("not found");
  expect(await services.cart.list()).toEqual([]);
  const ownId = (await services.order.list())[0].id;
  const save = storage.setItem;
  storage.setItem = jest.fn(async () => { throw new Error("Disk full"); });
  await expect(services.order.again(ownId)).rejects.toThrow("Disk full");
  storage.setItem = save;
  expect(await services.cart.list()).toEqual([]);
});

test("repeat ordering cannot bypass prescriptions, including baby medicines", async () => {
  const { services, storage } = fixture();
  await login(services);
  const db = JSON.parse((await storage.getItem("hp.demo.v1"))!);
  const past = db.orders.find((o: any) => o.customerId === "customer-1");
  past.items = [{ medicine: medicines.find(m => m.prescriptionRequired), quantity: 1 }];
  await storage.setItem("hp.demo.v1", JSON.stringify(db));
  const product = medicines.find(m => m.prescriptionRequired)!;
  const originalCategory = product.category;
  product.category = "Baby medicines";
  try {
    await services.order.again(past.id);
    await expect(services.order.place(0)).rejects.toThrow("prescription");
  } finally { product.category = originalCategory; }
});

test("retired pending status migrates and existing demo accounts gain available past-order examples only once", async () => {
  const { services, storage } = fixture();
  await login(services);
  const db = JSON.parse((await storage.getItem("hp.demo.v1"))!);
  delete db.catalogHistoryVersion;
  db.orders[0].status = "Confirmation Pending";
  db.orders[0].timeline.push({ status: "Confirmation Pending", date: db.orders[0].date });
  await storage.setItem("hp.demo.v1", JSON.stringify(db));
  const once = await services.order.list();
  const twice = await services.order.list();
  expect(once).toEqual(twice);
  expect(once.filter(o => o.sample && ["Delivered", "Cancelled"].includes(o.status))).toHaveLength(4);
  expect(once.some(o => (o.status as string) === "Confirmation Pending")).toBe(false);
  expect(once.flatMap(o => o.timeline).some(event => (event.status as string) === "Confirmation Pending")).toBe(false);
  expect(ORDER_STEPS).toEqual(["Order Received", "Confirmed", "Preparing", "Out for Delivery", "Delivered"]);
});

test("shop categories are exactly the five requested groups and preserve subcategory filtering", async () => {
  const { services } = fixture();
  expect(services.reference.categories).toEqual(["Medicines", "Skin & Personal Care", "Baby Care", "Vitamins & Wellness", "Women & Family Care"]);
  expect((await services.medicine.list("", "Vitamins & Wellness")).map(m => m.brandName)).toEqual(["Becozinc", "Ensure Vanilla"]);
  expect(await services.medicine.list("", "Heart care")).toHaveLength(1);
  expect((await services.medicine.list("", "Skin & Personal Care"))[0].brandName).toBe("Cipladine");
});
