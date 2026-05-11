import type { ReadingSession } from "../types/note";

function parseArabicPageLabel(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n)) return null;
  if (String(n) !== t) return null;
  return n;
}

/** Pages covered in one session when both ends are Arabic numerals; otherwise 0. */
export function pagesInReadingSession(session: ReadingSession): number {
  const start = parseArabicPageLabel(session.startPage);
  const end = parseArabicPageLabel(session.endPage);
  if (start === null || end === null) return 0;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return Math.max(0, hi - lo + 1);
}

export type ReadingHistoryAggregates = {
  totalDurationSeconds: number;
  totalPagesRead: number;
  sessionCount: number;
};

export function computeReadingHistoryStats(sessions: ReadingSession[]): ReadingHistoryAggregates {
  let totalDurationSeconds = 0;
  let totalPagesRead = 0;
  for (const s of sessions) {
    totalDurationSeconds += s.durationSeconds;
    totalPagesRead += pagesInReadingSession(s);
  }
  return {
    totalDurationSeconds,
    totalPagesRead,
    sessionCount: sessions.length,
  };
}

/** Short label for hero stats (hours + minutes when long). */
export function formatReadingTimeHero(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mTotal = Math.floor(totalSeconds / 60);
  if (mTotal < 60) return `${mTotal} min`;
  const h = Math.floor(mTotal / 60);
  const m = mTotal % 60;
  if (m === 0) return `${h} hr`;
  return `${h}h ${m}m`;
}
