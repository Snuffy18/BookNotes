import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadExportPreferences, saveExportPreferences } from "../storage/exportPreferencesStorage";
import {
  DEFAULT_EXPORT_PREFERENCES,
  type ExportPreferencesSnapshot,
} from "../types/exportPreferences";

type ExportPreferencesContextValue = ExportPreferencesSnapshot & {
  setExportPreferences: (partial: Partial<ExportPreferencesSnapshot>) => void;
  replaceExportPreferences: (next: ExportPreferencesSnapshot) => void;
};

const ExportPreferencesContext = createContext<ExportPreferencesContextValue | undefined>(undefined);

export function ExportPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ExportPreferencesSnapshot>(() => ({ ...DEFAULT_EXPORT_PREFERENCES }));

  useEffect(() => {
    loadExportPreferences()
      .then(setPrefs)
      .catch(() => {});
  }, []);

  const setExportPreferences = useCallback((partial: Partial<ExportPreferencesSnapshot>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      saveExportPreferences(next).catch(() => {});
      return next;
    });
  }, []);

  const replaceExportPreferences = useCallback((next: ExportPreferencesSnapshot) => {
    setPrefs(next);
    saveExportPreferences(next).catch(() => {});
  }, []);

  const value = useMemo<ExportPreferencesContextValue>(
    () => ({
      ...prefs,
      setExportPreferences,
      replaceExportPreferences,
    }),
    [prefs, setExportPreferences, replaceExportPreferences]
  );

  return (
    <ExportPreferencesContext.Provider value={value}>{children}</ExportPreferencesContext.Provider>
  );
}

export function useExportPreferences() {
  const ctx = useContext(ExportPreferencesContext);
  if (!ctx) {
    throw new Error("useExportPreferences must be used inside ExportPreferencesProvider");
  }
  return ctx;
}
