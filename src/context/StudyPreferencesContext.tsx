import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadStudyPreferences, saveStudyPreferences } from "../study/studyPreferencesStorage";
import type { StudyPreferencesSnapshot } from "../types/studyPreferences";
import { DEFAULT_STUDY_PREFERENCES } from "../types/studyPreferences";

type StudyPreferencesContextValue = StudyPreferencesSnapshot & {
  setStudyPreferences: (next: Partial<StudyPreferencesSnapshot>) => void;
  replaceStudyPreferences: (next: StudyPreferencesSnapshot) => void;
};

const StudyPreferencesContext = createContext<StudyPreferencesContextValue | undefined>(undefined);

export function StudyPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<StudyPreferencesSnapshot>(() => ({ ...DEFAULT_STUDY_PREFERENCES }));

  useEffect(() => {
    loadStudyPreferences()
      .then(setPrefs)
      .catch(() => {});
  }, []);

  const setStudyPreferences = useCallback((partial: Partial<StudyPreferencesSnapshot>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      saveStudyPreferences(next).catch(() => {});
      return next;
    });
  }, []);

  const replaceStudyPreferences = useCallback((next: StudyPreferencesSnapshot) => {
    setPrefs(next);
    saveStudyPreferences(next).catch(() => {});
  }, []);

  const value = useMemo<StudyPreferencesContextValue>(
    () => ({
      ...prefs,
      setStudyPreferences,
      replaceStudyPreferences,
    }),
    [prefs, setStudyPreferences, replaceStudyPreferences]
  );

  return <StudyPreferencesContext.Provider value={value}>{children}</StudyPreferencesContext.Provider>;
}

export function useStudyPreferences() {
  const ctx = useContext(StudyPreferencesContext);
  if (!ctx) {
    throw new Error("useStudyPreferences must be used inside StudyPreferencesProvider");
  }
  return ctx;
}
