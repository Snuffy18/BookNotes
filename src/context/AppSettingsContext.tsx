import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadSoundEffectsEnabled, saveSoundEffectsEnabled } from "../storage/soundEffectsPreferenceStorage";
import { accentColors, accentGradients } from "../theme/colors";
import type { AccentTheme } from "../theme/colors";
import { setSoundEffectsPlaybackEnabled } from "../utils/soundEffects";

type AppSettingsContextValue = {
  themeMode: "light" | "dark";
  setThemeMode: (value: "light" | "dark") => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (value: AccentTheme) => void;
  accentColor: string;
  accentGradient: [string, string];
  soundEffectsEnabled: boolean;
  setSoundEffectsEnabled: (value: boolean) => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("blue");
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true);
  const darkMode = themeMode === "dark";
  const setDarkMode = (value: boolean) => setThemeMode(value ? "dark" : "light");
  const accentColor = accentColors[accentTheme];
  const accentGradient = accentGradients[accentTheme];

  useEffect(() => {
    let cancelled = false;
    loadSoundEffectsEnabled()
      .then((value) => {
        if (!cancelled) setSoundEffectsEnabledState(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSoundEffectsPlaybackEnabled(soundEffectsEnabled);
  }, [soundEffectsEnabled]);

  const setSoundEffectsEnabled = useCallback((value: boolean) => {
    setSoundEffectsEnabledState(value);
    void saveSoundEffectsEnabled(value);
  }, []);

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
      soundEffectsEnabled,
      setSoundEffectsEnabled,
    }),
    [themeMode, darkMode, accentTheme, accentColor, accentGradient, soundEffectsEnabled, setSoundEffectsEnabled]
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
