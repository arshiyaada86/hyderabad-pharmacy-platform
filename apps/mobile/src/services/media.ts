import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import { Media, MediaService } from "./types";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function assertOwnedMedia(media: Media, directory: string) {
  if (
    !media ||
    !/^[a-f0-9-]{36}$/.test(media.id) ||
    media.uri !== `${directory}${media.id}.jpg` ||
    media.mimeType !== "image/jpeg" ||
    !Number.isFinite(media.size) ||
    media.size <= 0 ||
    media.size > MAX_IMAGE_BYTES
  ) {
    throw new Error("Select a valid photo from this app (maximum 10 MB).");
  }
}
const directory = `${FileSystem.documentDirectory}pharmacy-images/`;
export const localMedia: MediaService = {
  async pick(source) {
    if (!FileSystem.documentDirectory)
      throw new Error("Photo storage requires the Android app.");
    let uri: string;
    let size: number | undefined;
    let width: number | undefined;
    if (source === "file") {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return null;
      uri = result.assets[0].uri;
      size = result.assets[0].size;
    } else {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Camera access is needed to take a photo. You can upload a photo instead.",
          );
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.8,
        exif: false,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return null;
      uri = result.assets[0].uri;
      size = result.assets[0].fileSize;
      width = result.assets[0].width;
      if (
        (result.assets[0].width ?? 0) * (result.assets[0].height ?? 0) >
        50000000
      )
        throw new Error("Choose a photo smaller than 50 megapixels.");
    }
    if (!uri.startsWith("file://"))
      throw new Error("Choose a local image file.");
    const info = await FileSystem.getInfoAsync(uri);
    if (
      !info.exists ||
      info.isDirectory ||
      (size ?? info.size) > MAX_IMAGE_BYTES ||
      info.size > MAX_IMAGE_BYTES
    )
      throw new Error("Choose an image smaller than 10 MB.");
    // Decode and re-encode: never trust a filename or copy an arbitrary selected file into permanent storage.
    const result = await ImageManipulator.manipulateAsync(
      uri,
      width && width <= 1600 ? [] : [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    const id = randomUUID();
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const destination = `${directory}${id}.jpg`;
    await FileSystem.copyAsync({ from: result.uri, to: destination });
    const saved = await FileSystem.getInfoAsync(destination);
    if (!saved.exists || saved.isDirectory || saved.size > MAX_IMAGE_BYTES) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      throw new Error("The photo could not be saved. Try a smaller image.");
    }
    return { id, uri: destination, size: saved.size, mimeType: "image/jpeg" };
  },
  async validate(media) {
    assertOwnedMedia(media, directory);
    const info = await FileSystem.getInfoAsync(media.uri);
    if (
      !info.exists ||
      info.isDirectory ||
      info.size !== media.size ||
      info.size > MAX_IMAGE_BYTES
    )
      throw new Error(
        "The photo is missing or changed. Please select it again.",
      );
    const magic = await FileSystem.readAsStringAsync(media.uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 3,
      position: 0,
    });
    if (magic !== "/9j/")
      throw new Error("The selected file is not a valid photo.");
  },
  async remove(media) {
    assertOwnedMedia(media, directory);
    await FileSystem.deleteAsync(media.uri, { idempotent: true });
  },
};
