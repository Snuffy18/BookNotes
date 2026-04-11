import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StreakState } from "./streakLogic";
import { EMPTY_STREAK_STATE } from "./streakLogic";

const STORAGE_KEY = "@booknotes/streak/v1";

export async function loadStreakState(): Promise<StreakState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STREAK_STATE };
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    return {
      lastActivityDate:
        typeof parsed.lastActivityDate === "string" || parsed.lastActivityDate === null
          ? parsed.lastActivityDate ?? null
          : null,
      currentStreak: typeof parsed.currentStreak === "number" ? parsed.currentStreak : 0,
      longestStreak: typeof parsed.longestStreak === "number" ? parsed.longestStreak : 0,
    };
  } catch {
    return { ...EMPTY_STREAK_STATE };
  }
}

export async function saveStreakState(state: StreakState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
