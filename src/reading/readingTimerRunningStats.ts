import type { ReadingSession } from "../types/note";
import { isEligibleReadingLogSession, pagesInReadingSession } from "./readingHistoryStats";

export function getEstimate(
  pagesRemaining: number | null,
  pacePerHour: number | null,
  sessionMinutes: number
): string | null {
  if (!pacePerHour || !pagesRemaining || sessionMinutes < 2) return null;
  const hoursLeft = pagesRemaining / pacePerHour;
  if (hoursLeft < 1) {
    const minsLeft = Math.round(hoursLeft * 60);
    if (minsLeft < 10) return `~${pagesRemaining} pages left`;
    return `At this pace, you'll finish in ~${minsLeft} min`;
  }
  return `At this pace, you'll finish in ~${hoursLeft.toFixed(1)} hrs`;
}

export function pacePerHourFromSession(session: ReadingSession): number | null {
  if (!isEligibleReadingLogSession(session)) return null;
  const pages = pagesInReadingSession(session);
  const mins = session.durationSeconds / 60;
  if (pages <= 0) return null;
  return (pages / mins) * 60;
}

export function averageBookPacePerHour(
  sessions: ReadingSession[],
  bookId: string | null
): number | null {
  if (!bookId) return null;
  const paces = sessions
    .filter((s) => s.bookId === bookId && isEligibleReadingLogSession(s))
    .map(pacePerHourFromSession)
    .filter((p): p is number => p != null && p > 0);
  if (paces.length === 0) return null;
  return Math.round(paces.reduce((a, b) => a + b, 0) / paces.length);
}

export function formatSessionStartClock(startedAtMs: number): string {
  const d = new Date(startedAtMs);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}
