import type { ReadingSession } from "../types/note";
import { pagesInReadingSession } from "./readingHistoryStats";

export type WeekBounds = { weekStart: Date; weekEnd: Date };

/** Local calendar day start (00:00). */
export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday 00:00 through Sunday 23:59:59.999, local time. */
export function getMondayWeekRange(reference: Date = new Date()): WeekBounds {
  const d = startOfLocalDay(reference);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

export function formatWeekRangeLabel(weekStart: Date, weekEnd: Date): string {
  const sm = weekStart.toLocaleString("en-GB", { month: "short" });
  const em = weekEnd.toLocaleString("en-GB", { month: "short" });
  const y = weekEnd.getFullYear();
  if (
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear()
  ) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${em} ${y}`;
  }
  return `${weekStart.getDate()} ${sm} – ${weekEnd.getDate()} ${em} ${y}`;
}

export function sessionEndedInWeek(s: ReadingSession, weekStart: Date, weekEnd: Date): boolean {
  const t = new Date(s.endedAt).getTime();
  return t >= weekStart.getTime() && t <= weekEnd.getTime();
}

/** Local weekday index 0 = Monday … 6 = Sunday for `endedAt`. */
export function endedAtWeekdayIndexMon0(iso: string): number {
  const d = new Date(iso);
  const sun0 = d.getDay();
  return sun0 === 0 ? 6 : sun0 - 1;
}

export function sumPagesForSessions(list: ReadingSession[]): number {
  let t = 0;
  for (const s of list) t += pagesInReadingSession(s);
  return t;
}
