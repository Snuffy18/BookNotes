export const lightColors = {
  background: "#f8fafc",
  card: "#ffffff",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  primary: "#2563eb",
  primarySoft: "#bfdbfe",
  chipBg: "#e2e8f0",
  dangerBg: "#fee2e2",
  dangerBorder: "#fecaca",
  dangerText: "#991b1b",
  overlay: "rgba(15,23,42,0.35)",
};

export const darkColors = {
  background: "#000000",
  card: "#1c1c1c",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#94a3b8",
  border: "#1c1c1c",
  borderStrong: "#1c1c1c",
  primary: "#60a5fa",
  primarySoft: "#1c1c1c",
  chipBg: "#1c1c1c",
  dangerBg: "#7f1d1d",
  dangerBorder: "#991b1b",
  dangerText: "#fee2e2",
  overlay: "rgba(0,0,0,0.7)",
};

export type AccentTheme =
  | "blue"
  | "purple"
  | "pink"
  | "emerald"
  | "orange"
  | "red"
  | "teal";

/** Same accent hues in light and dark mode (primary + highlight stop). */
export const accentGradients: Record<AccentTheme, [string, string]> = {
  blue: ["#2563eb", "#3b82f6"],
  purple: ["#7c3aed", "#8b5cf6"],
  pink: ["#db2777", "#ec4899"],
  emerald: ["#059669", "#10b981"],
  orange: ["#ea580c", "#f97316"],
  red: ["#dc2626", "#ef4444"],
  teal: ["#0d9488", "#14b8a6"],
};

export const accentColors: Record<AccentTheme, string> = {
  blue: accentGradients.blue[0],
  purple: accentGradients.purple[0],
  pink: accentGradients.pink[0],
  emerald: accentGradients.emerald[0],
  orange: accentGradients.orange[0],
  red: accentGradients.red[0],
  teal: accentGradients.teal[0],
};
