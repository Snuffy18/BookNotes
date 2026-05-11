import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReadingHistoryAiReport } from "../types/note";

const STORAGE_KEY = "@book_notes_reading_history_ai_reports_v1";

export async function loadReadingHistoryReports(): Promise<ReadingHistoryAiReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReadingHistoryAiReport);
  } catch {
    return [];
  }
}

export async function saveReadingHistoryReports(reports: ReadingHistoryAiReport[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export async function appendReadingHistoryReport(report: ReadingHistoryAiReport): Promise<void> {
  const existing = await loadReadingHistoryReports();
  await saveReadingHistoryReports([report, ...existing]);
}

function isReadingHistoryAiReport(x: unknown): x is ReadingHistoryAiReport {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.body === "string" &&
    typeof o.totalDurationSeconds === "number" &&
    typeof o.totalPagesRead === "number" &&
    typeof o.sessionCount === "number"
  );
}
