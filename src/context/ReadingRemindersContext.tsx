import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadReadingReminders, saveReadingReminders } from "../storage/readingRemindersStorage";
import {
  DEFAULT_READING_REMINDERS,
  type ReadingRemindersSnapshot,
  type ReminderSlotKey,
  type ReminderSlotSnapshot,
} from "../types/readingReminders";

type ReadingRemindersContextValue = {
  slots: ReadingRemindersSnapshot;
  enabledCount: number;
  anyEnabled: boolean;
  setReminderSlot: (key: ReminderSlotKey, patch: Partial<ReminderSlotSnapshot>) => void;
  replaceReminderSlots: (next: ReadingRemindersSnapshot) => void;
};

const ReadingRemindersContext = createContext<ReadingRemindersContextValue | undefined>(undefined);

export function ReadingRemindersProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<ReadingRemindersSnapshot>(() => ({
    ...DEFAULT_READING_REMINDERS,
  }));

  useEffect(() => {
    loadReadingReminders()
      .then(setSlots)
      .catch(() => {});
  }, []);

  const setReminderSlot = useCallback((key: ReminderSlotKey, patch: Partial<ReminderSlotSnapshot>) => {
    setSlots((prev) => {
      const next: ReadingRemindersSnapshot = {
        ...prev,
        [key]: { ...prev[key], ...patch },
      };
      void saveReadingReminders(next);
      return next;
    });
  }, []);

  const replaceReminderSlots = useCallback((next: ReadingRemindersSnapshot) => {
    setSlots(next);
    void saveReadingReminders(next);
  }, []);

  const enabledCount = useMemo(
    () => Object.values(slots).filter((slot) => slot.enabled).length,
    [slots]
  );

  const value = useMemo<ReadingRemindersContextValue>(
    () => ({
      slots,
      enabledCount,
      anyEnabled: enabledCount > 0,
      setReminderSlot,
      replaceReminderSlots,
    }),
    [slots, enabledCount, setReminderSlot, replaceReminderSlots]
  );

  return (
    <ReadingRemindersContext.Provider value={value}>{children}</ReadingRemindersContext.Provider>
  );
}

export function useReadingReminders() {
  const ctx = useContext(ReadingRemindersContext);
  if (!ctx) {
    throw new Error("useReadingReminders must be used inside ReadingRemindersProvider");
  }
  return ctx;
}
