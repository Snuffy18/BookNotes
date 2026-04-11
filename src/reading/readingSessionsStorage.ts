import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReadingSession } from "../types/note";

const STORAGE_KEY = "@book_notes_reading_sessions_v1";

export async function loadReadingSessions(): Promise<ReadingSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReadingSession);
  } catch {
    return [];
  }
}

export async function saveReadingSessions(sessions: ReadingSession[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export async function appendReadingSession(session: ReadingSession): Promise<void> {
  const existing = await loadReadingSessions();
  await saveReadingSessions([session, ...existing]);
}

function isReadingSession(x: unknown): x is ReadingSession {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.bookId === null || typeof o.bookId === "string") &&
    (o.bookTitle === null || typeof o.bookTitle === "string") &&
    typeof o.startPage === "string" &&
    typeof o.endPage === "string" &&
    typeof o.startedAt === "string" &&
    typeof o.endedAt === "string" &&
    typeof o.durationSeconds === "number"
  );
}
