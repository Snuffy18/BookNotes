import type { BookItem, ScanItem } from "../types/note";

export function parseScanPageNumber(raw?: string | null): number | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function estimateBookPageTotal(book: BookItem): number | null {
  const ranges = book.chapterRanges;
  if (!ranges?.length) return null;
  let max = 0;
  for (const r of ranges) {
    const end = r.endPage ?? r.startPage;
    max = Math.max(max, r.startPage, end);
  }
  return max > 0 ? max : null;
}

export function pagesScannedPercent(book: BookItem, bookScans: ScanItem[]): number {
  if (bookScans.length === 0) return 0;
  const total = estimateBookPageTotal(book);
  const pageNums: number[] = [];
  for (const s of bookScans) {
    const p = parseScanPageNumber(s.page) ?? parseScanPageNumber(s.notes?.pageNumber);
    if (p != null) pageNums.push(p);
  }
  const maxPage = pageNums.length ? Math.max(...pageNums) : 0;
  if (total && total > 0 && maxPage > 0) {
    return Math.min(100, Math.round((maxPage / total) * 100));
  }
  if (total && total > 0) {
    return Math.min(100, Math.round((bookScans.length / total) * 100));
  }
  return Math.min(100, bookScans.length * 12);
}

export function getCoveragePageRange(scans: ScanItem[]): { min: number; max: number } | null {
  const nums: number[] = [];
  for (const s of scans) {
    const p = parseScanPageNumber(s.page) ?? parseScanPageNumber(s.notes?.pageNumber);
    if (p != null) nums.push(p);
  }
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export function countDistinctNumericPages(scans: ScanItem[]): number {
  const set = new Set<number>();
  for (const s of scans) {
    const p = parseScanPageNumber(s.page) ?? parseScanPageNumber(s.notes?.pageNumber);
    if (p != null) set.add(p);
  }
  return set.size;
}

export function countChaptersForBook(book: BookItem, scans: ScanItem[]): number {
  const fromRanges = book.chapterRanges?.length ?? 0;
  if (fromRanges > 0) return fromRanges;
  const ch = new Set<string>();
  for (const s of scans) {
    const c = s.chapter?.trim();
    if (c) ch.add(c);
  }
  return ch.size;
}
