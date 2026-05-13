import { Platform } from "react-native";

export const READING_TIMER_FONT_FAMILY = Platform.OS === "ios" ? "Menlo" : "monospace";

export function formatReadingTimerHMS(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
