/** Local calendar date `YYYY-MM-DD` (device timezone). */
export function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function yesterdayLocalYMD(from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
  return formatLocalYMD(d);
}

export type StreakState = {
  lastActivityDate: string | null;
  currentStreak: number;
  longestStreak: number;
};

export const EMPTY_STREAK_STATE: StreakState = {
  lastActivityDate: null,
  currentStreak: 0,
  longestStreak: 0,
};

/**
 * Call when the user completes a qualifying activity for the day (e.g. successful scan).
 * One increment per calendar day; consecutive days increase the streak; a gap resets to 1.
 */
export function applyStreakAfterActivity(prev: StreakState, now: Date = new Date()): StreakState {
  const todayStr = formatLocalYMD(now);
  const yesterdayStr = yesterdayLocalYMD(now);

  if (prev.lastActivityDate === todayStr) {
    return prev;
  }

  let nextStreak: number;
  if (prev.lastActivityDate === null) {
    nextStreak = 1;
  } else if (prev.lastActivityDate === yesterdayStr) {
    nextStreak = prev.currentStreak + 1;
  } else {
    nextStreak = 1;
  }

  const longestStreak = Math.max(prev.longestStreak, nextStreak);

  return {
    lastActivityDate: todayStr,
    currentStreak: nextStreak,
    longestStreak,
  };
}
