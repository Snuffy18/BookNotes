import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BookItem, ScanItem } from "../types/note";

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
    const books = Array.isArray(p.books) ? p.books.filter(isBookLike) : [];
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
