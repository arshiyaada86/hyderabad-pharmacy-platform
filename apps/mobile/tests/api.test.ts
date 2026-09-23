import { createApiServices } from "../src/services/api";
import { MediaService } from "../src/services/types";
jest.mock("expo-crypto", () => ({ randomUUID: () => "checkout-key-123456789" }));

test("API sessions use native-safe keys and refresh does not silently accept a changed price quote", async () => {
  const saved = new Map<string, string>();
  const keys: string[] = [];
  const storage = {
    getItem: async (key: string) => { keys.push(key); return saved.get(key) ?? null; },
    setItem: async (key: string, value: string) => { keys.push(key); saved.set(key, value); },
    removeItem: async (key: string) => { saved.delete(key); },
  };
  let quoteCalls = 0;
  let submitted: any;
  const previous = global.fetch;
  global.fetch = jest.fn(async (url: any, options: any) => {
    const path = String(url).split("/api")[1];
    let data: any = {};
    if (path === "/auth/otp") data = { challenge: "challenge" };
    if (path === "/auth/verify") data = { token: "session", user: { id: "customer" } };
    if (path === "/cart") data = [{ medicineId: "product", quantity: 1 }];
    if (path === "/checkout/quote") data = { fingerprint: "quote-" + ++quoteCalls };
    if (path === "/orders") { submitted = JSON.parse(options.body); data = { id: "O1ABCD" }; }
    return { ok: true, status: 200, json: async () => data } as Response;
  });
  try {
    const services = createApiServices("http://192.168.1.10:4000", storage, {} as MediaService);
    await services.auth.sendOtp("9000000001");
    await services.auth.verifyOtp("9000000001", "123456");
    expect(keys.every(key => /^[a-zA-Z0-9._-]+$/.test(key))).toBe(true);
    await services.cart.list();
    await services.cart.list();
    expect(quoteCalls).toBe(1);
    await services.order.place(10);
    expect(submitted.fingerprint).toBe("quote-1");
    expect(submitted.deliveryContribution).toBe(10);
    await services.cart.setQuantity("product", 2);
    await services.cart.list();
    expect(quoteCalls).toBe(2);
  } finally { global.fetch = previous; }
});
