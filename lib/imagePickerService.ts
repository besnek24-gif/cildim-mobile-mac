/**
 * imagePickerService
 * Kamera veya galeriden görsel alma işlemlerini soyutlar.
 */

import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export interface PickedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

export type PickSource = "camera" | "gallery";

async function ensurePermission(source: PickSource): Promise<boolean> {
  if (source === "camera") {
    const { granted, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      if (!canAskAgain) {
        Alert.alert(
          "Kamera İzni Gerekli",
          "Ayarlar → Uygulama → İzinler kısmından kamera iznini açın."
        );
      } else {
        Alert.alert("İzin Gerekli", "Fotoğraf çekmek için kamera erişimine izin verin.");
      }
      return false;
    }
    return true;
  } else {
    const { granted, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      if (!canAskAgain) {
        Alert.alert(
          "Galeri İzni Gerekli",
          "Ayarlar → Uygulama → İzinler kısmından fotoğraf iznini açın."
        );
      } else {
        Alert.alert("İzin Gerekli", "Galeri erişimine izin verin.");
      }
      return false;
    }
    return true;
  }
}

/**
 * Kamera veya galeriden görsel seç.
 * İzin reddedilirse null döner.
 * Kullanıcı iptal ederse null döner.
 */
export async function pickImage(source: PickSource): Promise<PickedImage | null> {
  const hasPermission = await ensurePermission(source);
  if (!hasPermission) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    base64: true,
    exif: false,
    allowsEditing: false,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) return null;

  return {
    uri: asset.uri,
    base64: asset.base64,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
  };
}
