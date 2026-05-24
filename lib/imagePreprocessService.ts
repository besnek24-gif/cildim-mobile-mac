/**
 * imagePreprocessService
 * Barkod taramadan önce görseli boyutlandırır.
 * - uri döner → expo-camera scanFromURLAsync (native barkod motoru) için
 * - base64 de döner → isteğe bağlı kullanım için
 */

import * as ImageManipulator from "expo-image-manipulator";
import type { PickedImage } from "./imagePickerService";

const MAX_DIMENSION = 1600; // Barkod tespiti için yeterli çözünürlük

export interface ProcessedImage {
  uri: string;       // Native barkod tarama için (scanFromURLAsync)
  base64: string;
  width: number;
  height: number;
  wasResized: boolean;
}

/**
 * Görseli max MAX_DIMENSION piksel olacak şekilde küçültür.
 * Zaten küçükse URI'yi değiştirmeden döner.
 */
export async function preprocessImage(image: PickedImage): Promise<ProcessedImage> {
  const { uri, width, height, base64 } = image;

  const maxDim = Math.max(width, height);
  if (maxDim <= MAX_DIMENSION) {
    return { uri, base64, width, height, wasResized: false };
  }

  const scale = MAX_DIMENSION / maxDim;
  const newWidth  = Math.round(width  * scale);
  const newHeight = Math.round(height * scale);

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: newWidth, height: newHeight } }],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!result.uri) throw new Error("Resize sonrası URI yok");

    return {
      uri: result.uri,
      base64: result.base64 ?? base64,
      width: result.width,
      height: result.height,
      wasResized: true,
    };
  } catch {
    // Fallback: orijinal görsel
    return { uri, base64, width, height, wasResized: false };
  }
}
