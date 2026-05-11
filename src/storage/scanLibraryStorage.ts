import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  BookInsightsStat,
  BookInsightsSummary,
  BookItem,
  ChapterRange,
  ScanItem,
} from "../types/note";

const KEY = "@booknotes_scan_library_v1";

export type ScanLibrarySnapshot = {
  scans: ScanItem[];
  books: BookItem[];
  activeBookId: string | null;
};

function isScanLike(x: unknown): x is ScanItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const notes = o.notes;
  if (!notes || typeof notes !== "object") return false;
  const n = notes as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.imageUri === "string" &&
    Array.isArray(n.mainIdeas) &&
    Array.isArray(n.keywords) &&
    typeof n.summary === "string" &&
    typeof n.detailedNotes === "string"
  );
}

function isBookLike(x: unknown): x is BookItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.author === "string" &&
    typeof o.coverUri === "string" &&
    typeof o.createdAt === "string"
  );
}

function sanitizeInsightsSummary(raw: unknown): BookInsightsSummary | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!updatedAt) return undefined;
  const body = typeof o.body === "string" ? o.body.trim() : "";
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  const kicker = typeof o.kicker === "string" ? o.kicker.trim() : "";
  const statsRaw = Array.isArray(o.stats) ? o.stats : [];
  const stats: BookInsightsStat[] = statsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const s = item as Record<string, unknown>;
      const label = typeof s.label === "string" ? s.label.trim() : "";
      const value = typeof s.value === "string" ? s.value.trim() : "";
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((x): x is BookInsightsStat => Boolean(x));
  const factsRaw = Array.isArray(o.facts) ? o.facts : [];
  const facts = factsRaw
    .map((f) => (typeof f === "string" ? f.trim() : ""))
    .filter((f) => f.length > 0);
  const themesLegacy = typeof o.themes === "string" ? o.themes.trim() : "";
  const themesSynthesisRaw =
    typeof o.themesSynthesis === "string" ? o.themesSynthesis.trim() : themesLegacy;
  const themesSynthesis = themesSynthesisRaw.length > 0 ? themesSynthesisRaw : undefined;
  const hasV2 = headline.length > 0 && facts.length > 0;
  const hasLegacy = body.length > 0;
  if (!hasV2 && !hasLegacy) return undefined;
  return {
    updatedAt,
    ...(hasLegacy ? { body } : {}),
    ...(headline ? { headline } : {}),
    ...(stats.length > 0 ? { stats } : {}),
    ...(facts.length > 0 ? { facts } : {}),
    ...(themesSynthesis ? { themesSynthesis } : {}),
    ...(kicker ? { kicker } : {}),
  };
}

function sanitizeChapterRanges(value: unknown): ChapterRange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ranges = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const startPage = typeof o.startPage === "number" ? o.startPage : Number(o.startPage);
      const endPage =
        o.endPage === undefined || o.endPage === null
          ? undefined
          : typeof o.endPage === "number"
            ? o.endPage
            : Number(o.endPage);
      if (!title || !Number.isFinite(startPage)) return null;
      return {
        title,
        startPage,
        ...(Number.isFinite(endPage) ? { endPage } : {}),
      };
    })
    .filter((item): item is ChapterRange => Boolean(item));
  return ranges.length > 0 ? ranges : undefined;
}

const EMPTY: ScanLibrarySnapshot = {
  scans: [],
  books: [],
  activeBookId: null,
};

export async function loadScanLibrary(): Promise<ScanLibrarySnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY };
    const p = parsed as Record<string, unknown>;
    const scans = Array.isArray(p.scans) ? p.scans.filter(isScanLike) : [];
    const books = Array.isArray(p.books)
      ? p.books.filter(isBookLike).map((book) => {
          const b = book as Record<string, unknown>;
          const { insightsSummary: rawInsights, ...rest } = b;
          const chapterRanges = sanitizeChapterRanges(b.chapterRanges);
          const readAtRaw = b.readAt;
          const readAt = typeof readAtRaw === "string" ? readAtRaw : undefined;
          const isReadRaw = b.isRead;
          const isRead = typeof isReadRaw === "boolean" ? isReadRaw : Boolean(readAt);
          const insightsSummary = sanitizeInsightsSummary(rawInsights);
          return {
            ...rest,
            ...(isRead ? { isRead: true } : {}),
            ...(readAt ? { readAt } : {}),
            ...(chapterRanges ? { chapterRanges } : {}),
            ...(insightsSummary ? { insightsSummary } : {}),
          } as BookItem;
        })
      : [];
    const activeBookId =
      p.activeBookId === null
        ? null
        : typeof p.activeBookId === "string"
          ? p.activeBookId
          : null;
    return { scans, books, activeBookId };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveScanLibrary(snapshot: ScanLibrarySnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
}
