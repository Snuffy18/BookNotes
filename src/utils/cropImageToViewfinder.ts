import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

export type ViewfinderLayout = { width: number; height: number };

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

/**
 * Crops a captured photo to the region visible in a preview that scales the image
 * with "cover" behavior (fills the viewfinder, cropping overflow).
 */
export async function cropImageToViewfinder(
  imageUri: string,
  viewfinder: ViewfinderLayout
): Promise<string> {
  const viewW = viewfinder.width;
  const viewH = viewfinder.height;
  if (viewW <= 0 || viewH <= 0) return imageUri;

  const { width: imgW, height: imgH } = await getImageSize(imageUri);
  if (imgW <= 0 || imgH <= 0) return imageUri;

  const imgAspect = imgW / imgH;
  const viewAspect = viewW / viewH;
  const tol = 0.01;

  if (Math.abs(imgAspect - viewAspect) <= tol) {
    return imageUri;
  }

  let originX: number;
  let originY: number;
  let cropW: number;
  let cropH: number;

  if (imgAspect > viewAspect) {
    cropH = imgH;
    cropW = Math.round(imgH * viewAspect);
    originX = Math.round((imgW - cropW) / 2);
    originY = 0;
  } else {
    cropW = imgW;
    cropH = Math.round(imgW / viewAspect);
    originX = 0;
    originY = Math.round((imgH - cropH) / 2);
  }

  cropW = Math.max(1, Math.min(cropW, imgW - originX));
  cropH = Math.max(1, Math.min(cropH, imgH - originY));

  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ crop: { originX, originY, width: cropW, height: cropH } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  );

  return result.uri;
}
