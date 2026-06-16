import type { BookItem, ReadingSession, ScanItem } from "../types/note";
import type { ReadingPlan } from "../types/readingPlan";
import { estimateBookPageTotal, maxScannedPageNumber, parseScanPageNumber } from "./bookReadingProgress";
import { isEligibleReadingLogSession } from "../reading/readingHistoryStats";
import { averageBookPacePerHour } from "../reading/readingTimerRunningStats";

const DAY_MS = 86400000;

/** Min saved sessions and total minutes before we trust a pace-based finish estimate. */
const MIN_SESSIONS_FOR_ESTIMATE = 3;
const MIN_TOTAL_MINUTES_FOR_ESTIMATE = 60;

/**
 * Hours of reading left to finish the book at the reader's average pace.
 * Returns null until there are at least 3 eligible sessions totaling 60+ minutes.
 */
export function estimateHoursToFinish(
  sessions: ReadingSession[],
  bookId: string,
  pagesRemaining: number
): number | null {
  if (pagesRemaining <= 0) return null;
  const eligible = sessions.filter((s) => s.bookId === bookId && isEligibleReadingLogSession(s));
  if (eligible.length < MIN_SESSIONS_FOR_ESTIMATE) return null;
  const totalMinutes = eligible.reduce((a, s) => a + s.durationSeconds, 0) / 60;
  if (totalMinutes < MIN_TOTAL_MINUTES_FOR_ESTIMATE) return null;
  const pace = averageBookPacePerHour(sessions, bookId);
  if (!pace || pace <= 0) return null;
  return pagesRemaining / pace;
}

/** "~4.5 hrs" / "~45 min" label for an hours value. */
export function formatHoursToFinish(hours: number): string {
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `~${mins} min`;
  }
  return `~${hours.toFixed(1)} hrs`;
}

function startOfLocalDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** Highest end page reached across saved reading sessions for this book (0 when none). */
export function maxSessionEndPageForBook(sessions: ReadingSession[], bookId: string): number {
  let max = 0;
  for (const s of sessions) {
    if (s.bookId !== bookId) continue;
    const p = parseScanPageNumber(s.endPage);
    if (p != null) max = Math.max(max, p);
  }
  return max;
}

/** Auto-detected furthest page: max of scans + reading sessions + plan baseline. */
export function detectCurrentPage(
  bookId: string,
  scans: ScanItem[],
  sessions: ReadingSession[],
  baselinePage = 0
): number {
  const bookScans = scans.filter((s) => s.bookId === bookId);
  return Math.max(baselinePage, maxScannedPageNumber(bookScans), maxSessionEndPageForBook(sessions, bookId));
}

export type ReadingPlanStatus = "onTrack" | "behind" | "done" | "overdue";

export type ReadingPlanProgress = {
  totalPages: number | null;
  currentPage: number;
  pagesRemaining: number;
  /** Book completion 0–100. */
  percent: number;
  /** Whole calendar days from today until the target date (0 once the target day is reached). */
  daysRemaining: number;
  /** Pages/day needed from today to finish on time. */
  pagesPerDay: number;
  /** Page the reader "should" be on today to stay on pace. */
  expectedPage: number;
  status: ReadingPlanStatus;
};

export function computeReadingPlanProgress(
  plan: ReadingPlan,
  book: BookItem,
  currentPage: number,
  now: Date = new Date()
): ReadingPlanProgress {
  const totalPages = estimateBookPageTotal(book);
  const current = Math.max(0, currentPage, plan.startPage);

  const today = startOfLocalDay(now);
  const target = startOfLocalDay(new Date(plan.targetFinishDate));
  const createdDay = startOfLocalDay(new Date(plan.createdAt));

  const daysRemaining = Math.max(0, Math.round((target - today) / DAY_MS));
  const daysForDivision = Math.max(1, daysRemaining);

  if (totalPages == null || totalPages <= 0) {
    return {
      totalPages: null,
      currentPage: current,
      pagesRemaining: 0,
      percent: 0,
      daysRemaining,
      pagesPerDay: 0,
      expectedPage: current,
      status: now.getTime() > target + DAY_MS ? "overdue" : "onTrack",
    };
  }

  const cappedCurrent = Math.min(current, totalPages);
  const pagesRemaining = Math.max(0, totalPages - cappedCurrent);
  const percent = Math.min(100, Math.round((cappedCurrent / totalPages) * 100));
  const pagesPerDay = pagesRemaining > 0 ? Math.ceil(pagesRemaining / daysForDivision) : 0;

  const totalPlanDays = Math.max(1, Math.round((target - createdDay) / DAY_MS));
  const elapsedDays = Math.min(totalPlanDays, Math.max(0, Math.round((today - createdDay) / DAY_MS)));
  const expectedPage = plan.startPage + (totalPages - plan.startPage) * (elapsedDays / totalPlanDays);

  let status: ReadingPlanStatus;
  if (cappedCurrent >= totalPages) {
    status = "done";
  } else if (now.getTime() > target + DAY_MS) {
    status = "overdue";
  } else {
    status = cappedCurrent + 2 >= expectedPage ? "onTrack" : "behind";
  }

  return {
    totalPages,
    currentPage: cappedCurrent,
    pagesRemaining,
    percent,
    daysRemaining,
    pagesPerDay,
    expectedPage: Math.round(expectedPage),
    status,
  };
}

/** "Mon, Jun 23" style label for a target date. */
export function formatPlanTargetDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
