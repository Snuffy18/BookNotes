import { Platform } from "react-native";

/** Must match the key passed to `useFonts` in App.tsx. */
export const FONT_CANELA_TEXT_REGULAR = "CanelaText-Regular";
export const FONT_CANELA_TEXT_BOLD = "CanelaText-Bold";
export const FONT_DM_SERIF_DISPLAY = "DMSerifDisplay-Regular";

/** iOS: system Helvetica. Android: no bundled Helvetica — use default sans. */
export const FONT_HELVETICA = Platform.select({
  ios: "Helvetica",
  android: "sans-serif",
  default: "Helvetica",
}) as string;
