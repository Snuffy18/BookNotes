import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadReadingPlans, saveReadingPlans } from "../storage/readingPlanStorage";
import type { ReadingPlan, ReadingPlansSnapshot } from "../types/readingPlan";

type SetPlanInput = {
  bookId: string;
  startPage: number;
  targetFinishDate: string;
};

type ReadingPlanContextValue = {
  plans: ReadingPlansSnapshot;
  getPlanForBook: (bookId: string | null | undefined) => ReadingPlan | null;
  setPlan: (input: SetPlanInput) => void;
  removePlan: (bookId: string) => void;
};

const ReadingPlanContext = createContext<ReadingPlanContextValue | undefined>(undefined);

export function ReadingPlanProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<ReadingPlansSnapshot>([]);

  useEffect(() => {
    loadReadingPlans()
      .then(setPlans)
      .catch(() => {});
  }, []);

  const getPlanForBook = useCallback(
    (bookId: string | null | undefined) => {
      if (!bookId) return null;
      return plans.find((p) => p.bookId === bookId) ?? null;
    },
    [plans]
  );

  const setPlan = useCallback((input: SetPlanInput) => {
    setPlans((prev) => {
      const existing = prev.find((p) => p.bookId === input.bookId);
      const next: ReadingPlan = {
        bookId: input.bookId,
        startPage: Math.max(0, Math.floor(input.startPage)),
        targetFinishDate: input.targetFinishDate,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      const others = prev.filter((p) => p.bookId !== input.bookId);
      const updated = [next, ...others];
      void saveReadingPlans(updated);
      return updated;
    });
  }, []);

  const removePlan = useCallback((bookId: string) => {
    setPlans((prev) => {
      const updated = prev.filter((p) => p.bookId !== bookId);
      void saveReadingPlans(updated);
      return updated;
    });
  }, []);

  const value = useMemo<ReadingPlanContextValue>(
    () => ({ plans, getPlanForBook, setPlan, removePlan }),
    [plans, getPlanForBook, setPlan, removePlan]
  );

  return <ReadingPlanContext.Provider value={value}>{children}</ReadingPlanContext.Provider>;
}

export function useReadingPlan() {
  const ctx = useContext(ReadingPlanContext);
  if (!ctx) {
    throw new Error("useReadingPlan must be used inside ReadingPlanProvider");
  }
  return ctx;
}
