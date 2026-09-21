import {
  categories,
  customers,
  doctors,
  doctorLocalities,
  localities,
  medicines,
  specialties,
} from "../data/catalog";
import {
  CartLine,
  KeyValueStorage,
  Media,
  MediaService,
  MedicineRequest,
  Order,
  Profile,
  ProfileInput,
  ReorderReview,
  Services,
} from "./types";

import { ORDER_STEPS } from "./rules";
import { matchesCategory } from "../data/shopCategories";
const DB_KEY = "hp.demo.v1";
const SESSION_KEY = "hp.demo.session";
// Six characters with both letters and digits; collisions are checked in the transaction.
export function shortOrderId(source: string, used: Set<string>): string {
  let hash = 0;
  for (const char of source) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const space = 36 ** 4;
  for (let attempt = 0; attempt < space; attempt++) {
    const candidate = `H${hash % 10}${((hash + attempt) % space).toString(36).toUpperCase().padStart(4, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Unable to create an order number.");
}
type Database = {
  version: 1;
  catalogHistoryVersion?: 1;
  customers: Profile[];
  carts: Record<string, CartLine[]>;
  orders: Order[];
  requests: MedicineRequest[];
};
export const normalizePhone = (phone: string) => {
  const clean = phone.replace(/[\s()-]/g, "").replace(/^\+91/, "");
  if (!/^[6-9]\d{9}$/.test(clean))
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  return clean;
};
function validateProfile(input: ProfileInput): ProfileInput {
  const clean = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [
      k,
      typeof v === "string" ? v.trim() : "",
    ]),
  ) as ProfileInput;
  if (!clean.name || clean.name.length > 80)
    throw new Error("Enter a name between 1 and 80 characters.");
  if (!clean.address || clean.address.length > 200)
    throw new Error("Enter a delivery address (up to 200 characters).");
  if (!localities.includes(clean.locality as (typeof localities)[number]))
    throw new Error("Choose a supported Hyderabad locality.");
  if (!clean.landmark || clean.landmark.length > 120)
    throw new Error("Enter a nearby landmark (up to 120 characters).");
  return {
    name: clean.name,
    address: clean.address,
    locality: clean.locality,
    landmark: clean.landmark,
  };
}
function seed(now: number): Database {
  const date = (days: number) => new Date(now - days * 86400000).toISOString();
  const orders: Order[] = customers.flatMap((customer, index) =>
    [0, 1, 2].map(
      (n): Order => ({
        id: `HP00${index + 1}${n + 1}`,
        sample: true,
        customerId: customer.id,
        date: date(n * 8 + 1),
        items: [{ medicine: medicines[n ? 1 : 0], quantity: 2 }],
        total: medicines[n ? 1 : 0].price * 2,
        delivery: {
          name: customer.name,
          address: customer.address,
          locality: customer.locality,
          landmark: customer.landmark,
        },
        status: n === 0 ? "Preparing" : n === 1 ? "Delivered" : "Cancelled",
        eta: n === 0 ? "Today, 6:00–8:00 PM (demo)" : undefined,
        prescriptionSubmitted: false,
        timeline: (n === 2
          ? (["Order Received", "Cancelled"] as const)
          : ORDER_STEPS.slice(0, n === 0 ? 3 : 5)
        ).map((status, j) => ({
          status,
          date: new Date(
            now - (n * 8 + 1) * 86400000 + j * 3600000,
          ).toISOString(),
        })),
      }),
    ),
  );
  return {
    version: 1,
    catalogHistoryVersion: 1,
    customers: customers.map((c) => ({ ...c })),
    carts: {},
    orders,
    requests: customers.map((c, i) => ({
      id: `REQ-DEMO-${i + 1}`,
      customerId: c.id,
      date: date(3),
      status: "Received",
      demo: true,
      photo: {
        id: "demo-photo",
        uri: "demo://medicine",
        size: 1,
        mimeType: "image/jpeg",
      },
    })),
  };
}
export function createMockServices(
  storage: KeyValueStorage,
  session: KeyValueStorage,
  media: MediaService,
  clock = () => Date.now(),
  uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): Services {
  let challenge: {
    phone: string;
    expires: number;
    attempts: number;
    verified: boolean;
  } | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<Database> => {
    const raw = await storage.getItem(DB_KEY);
    if (!raw) {
      const db = seed(clock());
      await storage.setItem(DB_KEY, JSON.stringify(db));
      return db;
    }
    try {
      const db = JSON.parse(raw) as Database;
      if (
        db.version !== 1 ||
        !Array.isArray(db.customers) ||
        !Array.isArray(db.orders) ||
        !Array.isArray(db.requests) ||
        !db.carts ||
        typeof db.carts !== "object"
      )
        throw new Error();
      const used = new Set(db.orders.filter(order => /^[A-Z0-9]{6}$/.test(order.id)).map(order => order.id));
      db.orders = db.orders.map(order => {
        // Normalize the retired status in old local records before exposing them.
        const legacy = "Confirmation Pending";
        const normalized = { ...order,
          status: (order.status as string) === legacy ? "Order Received" as const : order.status,
          timeline: order.timeline.filter(event => (event.status as string) !== legacy),
        };
        if (/^[A-Z0-9]{6}$/.test(order.id)) return normalized;
        const id = shortOrderId(order.id, used);
        used.add(id);
        return { ...normalized, id };
      });
      if (!db.catalogHistoryVersion) {
        const examples = seed(clock()).orders.filter(order => order.status === "Delivered" || order.status === "Cancelled");
        for (const example of examples) {
          const id = shortOrderId(`catalog-example-${example.id}`, new Set(db.orders.map(order => order.id)));
          db.orders.push({ ...example, id });
        }
        db.catalogHistoryVersion = 1;
        await storage.setItem(DB_KEY, JSON.stringify(db));
      }
      // Retired demo products are removed, never replaced with another medicine.
      // Historical orders retain their original product snapshots.
      for (const customerId of Object.keys(db.carts)) {
        db.carts[customerId] = db.carts[customerId].filter(line =>
          medicines.some(m => m.id === line.medicineId && m.active));
      }
      return db;
    } catch {
      throw new Error(
        "Local demo data could not be read. Clear the app data to reset this prototype.",
      );
    }
  };
  // ponytail: one serialized document suits a single-device demo; replace with API transactions later.
  const transact = <T>(fn: (db: Database) => Promise<T> | T): Promise<T> => {
    const result = queue.then(async () => {
      const db = await read();
      const value = await fn(db);
      await storage.setItem(DB_KEY, JSON.stringify(db));
      return value;
    });
    queue = result.catch(() => undefined);
    return result;
  };
  const current = async (): Promise<Profile | null> => {
    const id = await session.getItem(SESSION_KEY);
    if (!id) return null;
    return (await read()).customers.find((c) => c.id === id) ?? null;
  };
  const requireUser = async () => {
    const user = await current();
    if (!user) throw new Error("Please sign in to continue.");
    return user;
  };
  const medicine = (id: string) => {
    const found = medicines.find((m) => m.id === id && m.active);
    if (!found) throw new Error("This medicine is unavailable.");
    return found;
  };
  const quantity = (n: number) => {
    if (!Number.isInteger(n) || n < 0 || n > 20)
      throw new Error("Choose a quantity from 0 to 20 packs.");
  };
  const editCart = async (id: string, n: number, add: boolean) => {
    quantity(n);
    medicine(id);
    const user = await requireUser();
    await transact((db) => {
      const cart = db.carts[user.id] ?? [];
      const next = add
        ? (cart.find((l) => l.medicineId === id)?.quantity ?? 0) + n
        : n;
      quantity(next);
      db.carts[user.id] = !next
        ? cart.filter((line) => line.medicineId !== id)
        : cart.some((line) => line.medicineId === id)
          ? cart.map((line) => line.medicineId === id ? { ...line, quantity: next } : line)
          : [...cart, { medicineId: id, quantity: next }];
    });
  };
  return {
    reference: {
      categories,
      specialties,
      localities,
      doctorLocalities,
      demoPhone: customers[0].phone,
      demoOtp: "123456",
    },
    media,
    medicine: {
      list: async (query = "", category = "") =>
        medicines.filter(
          (m) =>
            m.active &&
            matchesCategory(m, category) &&
            `${m.brandName} ${m.genericName} ${m.composition} ${m.manufacturer}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        ),
      get: async (id) => medicine(id),
    },
    doctor: {
      list: async (query = "", specialty = "", locality = "") =>
        doctors.filter(
          (d) =>
            (!specialty || d.specialty === specialty) &&
            (!locality || d.clinics.some(clinic => clinic.locality === locality)) &&
            `${d.name} ${d.specialty} ${d.clinics.map(clinic => `${clinic.name} ${clinic.locality} ${clinic.address}`).join(" ")}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        ),
      get: async (id) => {
        const doctor = doctors.find((d) => d.id === id);
        if (!doctor) throw new Error("Doctor not found.");
        return doctor;
      },
    },
    auth: {
      current,
      sendOtp: async (phone) => {
        challenge = {
          phone: normalizePhone(phone),
          expires: clock() + 300000,
          attempts: 0,
          verified: false,
        };
      },
      verifyOtp: async (phone, code) => {
        const normalized = normalizePhone(phone);
        if (
          !challenge ||
          challenge.phone !== normalized ||
          challenge.expires < clock() ||
          challenge.attempts >= 5
        )
          throw new Error("Request a new demo code and try again.");
        challenge.attempts++;
        if (code !== "123456")
          throw new Error("Incorrect demo code. Use 123456.");
        challenge.verified = true;
        const user =
          (await read()).customers.find((c) => c.phone === normalized) ?? null;
        if (user) {
          await session.setItem(SESSION_KEY, user.id);
          challenge = null;
        }
        return user;
      },
      register: async (input) => {
        if (!challenge?.verified || challenge.expires < clock())
          throw new Error("Verify your phone number first.");
        const values = validateProfile(input);
        const phone = challenge.phone;
        const user = await transact((db) => {
          if (db.customers.some((c) => c.phone === phone))
            throw new Error(
              "This phone is already registered. Please sign in.",
            );
          const next: Profile = { ...values, phone, id: uuid(), demo: true };
          db.customers.push(next);
          return next;
        });
        await session.setItem(SESSION_KEY, user.id);
        challenge = null;
        return user;
      },
      update: async (input) => {
        const user = await requireUser();
        const values = validateProfile(input);
        return transact((db) => {
          const next = { ...user, ...values };
          db.customers = db.customers.map((c) => (c.id === user.id ? next : c));
          return next;
        });
      },
      logout: async () => {
        await session.removeItem(SESSION_KEY);
        challenge = null;
      },
    },
    cart: {
      list: async () => {
        const user = await requireUser();
        return (await read()).carts[user.id] ?? [];
      },
      setQuantity: (id, n) => editCart(id, n, false),
      add: (id, n) => editCart(id, n, true),
    },
    order: {
      again: async (id) => {
        const user = await requireUser();
        return transact(db => {
          const order = db.orders.find(item => item.id === id && item.customerId === user.id);
          if (!order) throw new Error("Order not found.");
          const review: ReorderReview = { orderId: order.id, available: [], unavailable: [] };
          const cart = [...(db.carts[user.id] ?? [])];
          for (const item of order.items) {
            const current = medicines.find(m => m.id === item.medicine.id && m.active);
            if (!current) { review.unavailable.push(`${item.medicine.brandName} · ${item.medicine.packageSize}`); continue; }
            quantity(item.quantity);
            if (!item.quantity) throw new Error("This order contains an invalid quantity.");
            const line = { medicineId: current.id, quantity: item.quantity };
            const index = cart.findIndex(entry => entry.medicineId === current.id);
            if (index < 0) cart.push(line); else cart[index] = line;
            review.available.push({ ...line, name: current.brandName, previousPrice: item.medicine.price, currentPrice: current.price });
          }
          db.carts[user.id] = cart;
          return review;
        });
      },
      list: async () => {
        const user = await requireUser();
        return (await read()).orders
          .filter((o) => o.customerId === user.id)
          .sort((a, b) => b.date.localeCompare(a.date));
      },
      get: async (id) => {
        const user = await requireUser();
        const order = (await read()).orders.find(
          (o) => o.id === id && o.customerId === user.id,
        );
        if (!order) throw new Error("Order not found.");
        return order;
      },
      place: async (prescription) => {
        const user = await requireUser();
        return transact(async (db) => {
          const cart = db.carts[user.id] ?? [];
          if (!cart.length) throw new Error("Your cart is empty.");
          const items = cart.map((line) => {
            quantity(line.quantity);
            if (!line.quantity) throw new Error("Invalid cart quantity.");
            return {
              medicine: { ...medicine(line.medicineId) },
              quantity: line.quantity,
            };
          });
          if (
            items.some((i) => i.medicine.prescriptionRequired) &&
            !prescription
          )
            throw new Error("Upload a prescription to order these medicines.");
          if (prescription) await media.validate(prescription);
          const date = new Date(clock()).toISOString();
          const order: Order = {
            id: shortOrderId(uuid(), new Set(db.orders.map(order => order.id))),
            customerId: user.id,
            date,
            items,
            total: items.reduce(
              (sum, i) => sum + i.medicine.price * i.quantity,
              0,
            ),
            delivery: validateProfile(user),
            status: "Order Received",
            timeline: [{ status: "Order Received", date }],
            prescription,
            prescriptionSubmitted: !!prescription,
          };
          db.orders.unshift(order);
          db.carts[user.id] = [];
          return order;
        });
      },
    },
    request: {
      list: async () => {
        const user = await requireUser();
        return (await read()).requests.filter((r) => r.customerId === user.id);
      },
      submit: async (photo) => {
        const user = await requireUser();
        await media.validate(photo);
        return transact((db) => {
          const request: MedicineRequest = {
            id: `REQ-${uuid()}`,
            customerId: user.id,
            photo,
            date: new Date(clock()).toISOString(),
            status: "Received",
          };
          db.requests.unshift(request);
          return request;
        });
      },
    },
  };
}
