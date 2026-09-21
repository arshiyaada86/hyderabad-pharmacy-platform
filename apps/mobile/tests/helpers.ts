import { createMockServices } from "../src/services/mock";
import { KeyValueStorage, Media, MediaService } from "../src/services/types";
export function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}
export const photo: Media = {
  id: "12345678-1234-1234-1234-123456789abc",
  uri: "file:///demo/photo.jpg",
  mimeType: "image/jpeg",
  size: 120,
};
export function fixture() {
  const storage = memoryStorage();
  const session = memoryStorage();
  const media: MediaService = {
    pick: jest.fn(async () => photo),
    validate: jest.fn(async (value) => {
      if (
        !value ||
        value.size <= 0 ||
        value.mimeType !== "image/jpeg" ||
        Array.isArray(value)
      )
        throw new Error("Invalid photo");
    }),
    remove: jest.fn(async () => {}),
  };
  let id = 0;
  let time = Date.parse("2026-09-19T10:00:00Z");
  const services = createMockServices(
    storage,
    session,
    media,
    () => time,
    () => `test-${++id}`,
  );
  return {
    services,
    storage,
    session,
    media,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
export async function login(
  services: ReturnType<typeof fixture>["services"],
  phone = "9000000001",
) {
  await services.auth.sendOtp(phone);
  return services.auth.verifyOtp(phone, "123456");
}
