import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReadingPlan, ReadingPlansSnapshot } from "../types/readingPlan";

const KEY = "@booknotes_reading_plans_v1";

function normalizePlan(raw: unknown): ReadingPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const plan = raw as Partial<ReadingPlan>;
  if (typeof plan.bookId !== "string" || !plan.bookId.trim()) return null;
  if (typeof plan.targetFinishDate !== "string" || !plan.targetFinishDate.trim()) return null;
  if (Number.isNaN(new Date(plan.targetFinishDate).getTime())) return null;
  const startPage =
    typeof plan.startPage === "number" && Number.isFinite(plan.startPage) && plan.startPage >= 0
      ? Math.floor(plan.startPage)
      : 0;
  const createdAt =
    typeof plan.createdAt === "string" && !Number.isNaN(new Date(plan.createdAt).getTime())
      ? plan.createdAt
      : new Date().toISOString();
  return {
    bookId: plan.bookId,
    startPage,
    targetFinishDate: plan.targetFinishDate,
    createdAt,
  };
}

function normalizeSnapshot(raw: unknown): ReadingPlansSnapshot {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ReadingPlan[] = [];
  for (const item of raw) {
    const plan = normalizePlan(item);
    if (plan && !seen.has(plan.bookId)) {
      seen.add(plan.bookId);
      out.push(plan);
    }
  }
  return out;
}

export async function loadReadingPlans(): Promise<ReadingPlansSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveReadingPlans(snapshot: ReadingPlansSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
}
