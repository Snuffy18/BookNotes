import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyStreakAfterActivity, type StreakState } from "../streak/streakLogic";
import { loadStreakState, saveStreakState } from "../streak/streakStorage";

type StreakContextValue = {
  streak: StreakState;
  hydrated: boolean;
  /** Call after a successful page scan + notes (one successful activity per local day updates streak). */
  recordSuccessfulScan: () => Promise<void>;
};

const StreakContext = createContext<StreakContextValue | null>(null);

export function StreakProvider({ children }: { children: ReactNode }) {
  const [streak, setStreak] = useState<StreakState>({
    lastActivityDate: null,
    currentStreak: 0,
    longestStreak: 0,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadStreakState();
      if (!cancelled) {
        setStreak(loaded);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordSuccessfulScan = useCallback(async () => {
    setStreak((prev) => {
      const next = applyStreakAfterActivity(prev);
      if (
        next.lastActivityDate === prev.lastActivityDate &&
        next.currentStreak === prev.currentStreak
      ) {
        return prev;
      }
      void saveStreakState(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      streak,
      hydrated,
      recordSuccessfulScan,
    }),
    [streak, hydrated, recordSuccessfulScan]
  );

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) {
    throw new Error("useStreak must be used within StreakProvider");
  }
  return ctx;
}
