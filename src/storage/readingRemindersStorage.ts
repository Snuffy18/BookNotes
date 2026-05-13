import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_READING_REMINDERS,
  type ReadingRemindersSnapshot,
  type ReminderSlotKey,
  type ReminderSlotSnapshot,
} from "../types/readingReminders";

const KEY = "@booknotes_reading_reminders_v1";

const SLOT_KEYS: ReminderSlotKey[] = ["morning", "afternoon", "night", "endOfDay"];

function normalizeSlot(raw: unknown, fallback: ReminderSlotSnapshot): ReminderSlotSnapshot {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const slot = raw as Partial<ReminderSlotSnapshot>;
  const hour =
    typeof slot.hour === "number" && slot.hour >= 0 && slot.hour <= 23
      ? Math.floor(slot.hour)
      : fallback.hour;
  const minute =
    typeof slot.minute === "number" && slot.minute >= 0 && slot.minute <= 59
      ? Math.floor(slot.minute)
      : fallback.minute;
  return {
    enabled: typeof slot.enabled === "boolean" ? slot.enabled : fallback.enabled,
    hour,
    minute,
  };
}

function normalizeSnapshot(raw: unknown): ReadingRemindersSnapshot {
  const base = { ...DEFAULT_READING_REMINDERS };
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as Partial<Record<ReminderSlotKey, unknown>>;
  for (const key of SLOT_KEYS) {
    base[key] = normalizeSlot(parsed[key], DEFAULT_READING_REMINDERS[key]);
  }
  return base;
}

export async function loadReadingReminders(): Promise<ReadingRemindersSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_READING_REMINDERS };
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_READING_REMINDERS };
  }
}

export async function saveReadingReminders(snapshot: ReadingRemindersSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
}
