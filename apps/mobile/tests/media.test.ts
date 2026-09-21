import { assertOwnedMedia, MAX_IMAGE_BYTES } from "../src/services/media";
import { photo } from "./helpers";
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///private/",
}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));
test("owned image path rejects traversal, external URLs, wrong type and oversized files", () => {
  const directory = "file:///private/images/";
  const owned = { ...photo, uri: `${directory}${photo.id}.jpg` };
  expect(() => assertOwnedMedia(owned, directory)).not.toThrow();
  for (const uri of [
    "https://example.com/image.jpg",
    "file:///private/images/../secret.jpg",
    "file:///other/image.jpg",
  ])
    expect(() => assertOwnedMedia({ ...owned, uri }, directory)).toThrow();
  expect(() =>
    assertOwnedMedia({ ...owned, size: MAX_IMAGE_BYTES + 1 }, directory),
  ).toThrow();
  expect(() =>
    assertOwnedMedia({ ...owned, id: "../secret" }, directory),
  ).toThrow();
  expect(() =>
    assertOwnedMedia({ ...owned, mimeType: "text/html" as never }, directory),
  ).toThrow();
});
