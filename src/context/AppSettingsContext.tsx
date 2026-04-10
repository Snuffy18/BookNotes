import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { accentColors, accentGradients } from "../theme/colors";
import type { AccentTheme } from "../theme/colors";

type AppSettingsContextValue = {
  themeMode: "light" | "dark";
  setThemeMode: (value: "light" | "dark") => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (value: AccentTheme) => void;
  accentColor: string;
  accentGradient: [string, string];
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("blue");
  const darkMode = themeMode === "dark";
  const setDarkMode = (value: boolean) => setThemeMode(value ? "dark" : "light");
  const accentColor = darkMode
    ? accentColors[accentTheme].dark
    : accentColors[accentTheme].light;
  const accentGradient = darkMode
    ? accentGradients[accentTheme].dark
    : accentGradients[accentTheme].light;

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      darkMode,
      setDarkMode,
      accentTheme,
      setAccentTheme,
      accentColor,
      accentGradient,
    }),
    [themeMode, darkMode, accentTheme, accentColor, accentGradient]
  );
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }
  return context;
}
