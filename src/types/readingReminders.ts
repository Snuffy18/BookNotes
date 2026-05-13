export type ReminderSlotKey = "morning" | "afternoon" | "night" | "endOfDay";

export type ReminderSlotSnapshot = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export type ReadingRemindersSnapshot = Record<ReminderSlotKey, ReminderSlotSnapshot>;

export const DEFAULT_READING_REMINDERS: ReadingRemindersSnapshot = {
  morning: { enabled: true, hour: 8, minute: 30 },
  afternoon: { enabled: true, hour: 13, minute: 0 },
  night: { enabled: false, hour: 20, minute: 0 },
  endOfDay: { enabled: true, hour: 21, minute: 0 },
};
