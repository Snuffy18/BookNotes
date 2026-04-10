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

export const accentGradients: Record<AccentTheme, { light: [string, string]; dark: [string, string] }> = {
  blue: { light: ["#2563eb", "#3b82f6"], dark: ["#60a5fa", "#93c5fd"] },
  purple: { light: ["#7c3aed", "#8b5cf6"], dark: ["#a78bfa", "#c4b5fd"] },
  pink: { light: ["#db2777", "#ec4899"], dark: ["#f472b6", "#f9a8d4"] },
  emerald: { light: ["#059669", "#10b981"], dark: ["#34d399", "#6ee7b7"] },
  orange: { light: ["#ea580c", "#f97316"], dark: ["#fb923c", "#fdba74"] },
  red: { light: ["#dc2626", "#ef4444"], dark: ["#f87171", "#fca5a5"] },
  teal: { light: ["#0d9488", "#14b8a6"], dark: ["#2dd4bf", "#5eead4"] },
};

export const accentColors: Record<AccentTheme, { light: string; dark: string }> = {
  blue: { light: accentGradients.blue.light[0], dark: accentGradients.blue.dark[0] },
  purple: { light: accentGradients.purple.light[0], dark: accentGradients.purple.dark[0] },
  pink: { light: accentGradients.pink.light[0], dark: accentGradients.pink.dark[0] },
  emerald: { light: accentGradients.emerald.light[0], dark: accentGradients.emerald.dark[0] },
  orange: { light: accentGradients.orange.light[0], dark: accentGradients.orange.dark[0] },
  red: { light: accentGradients.red.light[0], dark: accentGradients.red.dark[0] },
  teal: { light: accentGradients.teal.light[0], dark: accentGradients.teal.dark[0] },
};
