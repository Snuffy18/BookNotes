import { Asset } from "expo-asset";

const CANELA_REGULAR_OTF = require("../../assets/CanelaText-Regular-Trial.otf");
const CANELA_BOLD_OTF = require("../../assets/CanelaText-Bold-Trial.otf");

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(binary);
}

async function fontFaceRuleFromAsset(
  module: number,
  weight: 400 | 700,
): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri;
  if (!uri) throw new Error("Canela font asset is unavailable for PDF export.");
  const res = await fetch(uri);
  const buf = await res.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  return `@font-face {
  font-family: "Canela Text PDF";
  src: url(data:font/otf;base64,${base64}) format("opentype");
  font-weight: ${weight};
  font-style: normal;
}`;
}

let cachedFontFaceCss: string | null = null;
let loadPromise: Promise<string> | null = null;

/**
 * Embeddable @font-face for expo-print HTML (WKWebView). Cached after first load.
 */
export async function getPdfCanelaFontFaceCss(): Promise<string> {
  if (cachedFontFaceCss) return cachedFontFaceCss;
  if (!loadPromise) {
    loadPromise = (async () => {
      const [regular, bold] = await Promise.all([
        fontFaceRuleFromAsset(CANELA_REGULAR_OTF, 400),
        fontFaceRuleFromAsset(CANELA_BOLD_OTF, 700),
      ]);
      cachedFontFaceCss = `${regular}\n${bold}`;
      return cachedFontFaceCss;
    })();
  }
  return loadPromise;
}
