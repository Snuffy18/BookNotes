import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import { loadScanLibrary, saveScanLibrary } from "../storage/scanLibraryStorage";
import type {
  BookInsightsPayload,
  BookInsightsSummary,
  BookItem,
  BookReport,
  ChapterRange,
  ScanItem,
} from "../types/note";
import { playSoundEffect } from "../utils/soundEffects";
import { BookAddedToast } from "../components/BookAddedToast";
import { BookDeletedToast } from "../components/BookDeletedToast";

/**
 * Persists a full replace of book insights (no merge with the previous summary).
 * New structured insights omit legacy `body`; legacy-only payloads omit v2 fields.
 */
function snapshotInsightsForStore(
  payload: BookInsightsPayload & { updatedAt: string },
): BookInsightsSummary {
  const { updatedAt, headline, stats, facts, themesSynthesis, kicker, body } = payload;
  const hasV2 = Boolean(headline?.trim() && facts && facts.length > 0);
  if (hasV2) {
    return {
      updatedAt,
      headline: headline!.trim(),
      ...(stats && stats.length > 0 ? { stats } : {}),
      facts: facts!,
      ...(themesSynthesis?.trim() ? { themesSynthesis: themesSynthesis.trim() } : {}),
      ...(kicker?.trim() ? { kicker: kicker.trim() } : {}),
    };
  }
  if (body?.trim()) {
    return { updatedAt, body: body.trim() };
  }
  return {
    updatedAt,
    ...(headline?.trim() ? { headline: headline.trim() } : {}),
    ...(stats && stats.length > 0 ? { stats } : {}),
    ...(facts && facts.length > 0 ? { facts } : {}),
    ...(themesSynthesis?.trim() ? { themesSynthesis: themesSynthesis.trim() } : {}),
    ...(kicker?.trim() ? { kicker: kicker.trim() } : {}),
  };
}

type ScanContextValue = {
  scans: ScanItem[];
  books: BookItem[];
  activeBookId: string | null;
  activeBook: BookItem | null;
  isCoverProcessing: boolean;
  setIsCoverProcessing: (value: boolean) => void;
  setActiveBookId: (bookId: string) => void;
  addScan: (scan: ScanItem) => void;
  updateScan: (scanId: string, updates: Partial<ScanItem>) => void;
  removeScan: (scanId: string) => void;
  removeBook: (bookId: string) => void;
  toggleBookRead: (bookId: string) => void;
  addOrActivateBook: (book: {
    title: string;
    author: string;
    coverUri: string;
    totalPageCount?: number;
    isbn?: string;
  }) => void;
  updateBookChapterRanges: (bookId: string, chapterRanges: ChapterRange[]) => void;
  updateBookTotalPageCount: (bookId: string, totalPageCount: number) => void;
  updateBookCoverUri: (bookId: string, coverUri: string) => void;
  setBookInsightsSummary: (
    bookId: string,
    summary: BookInsightsPayload & { updatedAt: string },
  ) => void;
  clearBookInsightsSummary: (bookId: string) => void;
  reports: BookReport[];
};

const ScanContext = createContext<ScanContextValue | undefined>(undefined);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [isCoverProcessing, setIsCoverProcessing] = useState(false);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [bookAddedToastCount, setBookAddedToastCount] = useState(0);
  const [bookDeletedToastCount, setBookDeletedToastCount] = useState(0);

  useEffect(() => {
    loadScanLibrary()
      .then(({ scans: s, books: b, activeBookId: a }) => {
        setScans(s);
        setBooks(b);
        setActiveBookId(a);
      })
      .catch(() => {})
      .finally(() => setRestoredFromStorage(true));
  }, []);

  useEffect(() => {
    if (!restoredFromStorage) return;
    saveScanLibrary({ scans, books, activeBookId }).catch(() => {});
  }, [scans, books, activeBookId, restoredFromStorage]);

  /** Completed ("read") books are not scannable; move selection to another book or none. */
  useEffect(() => {
    if (!activeBookId) return;
    const active = books.find((b) => b.id === activeBookId);
    if (!active?.isRead) return;
    const fallback = books.find((b) => !b.isRead);
    setActiveBookId(fallback?.id ?? null);
  }, [books, activeBookId]);

  const addScan = (scan: ScanItem) => {
    setScans((current) => [scan, ...current]);
  };

  const updateScan = (scanId: string, updates: Partial<ScanItem>) => {
    setScans((current) =>
      current.map((s) => (s.id === scanId ? { ...s, ...updates } : s))
    );
  };

  const removeScan = (scanId: string) => {
    setScans((current) => current.filter((s) => s.id !== scanId));
    playSoundEffect("bookDeletedTrash");
    setBookDeletedToastCount((c) => c + 1);
  };

  const removeBook = (bookId: string) => {
    setBooks((current) => current.filter((book) => book.id !== bookId));
    setScans((current) => current.filter((scan) => scan.bookId !== bookId));
    setActiveBookId((current) => (current === bookId ? null : current));
    playSoundEffect("bookDeletedTrash");
    setBookDeletedToastCount((c) => c + 1);
  };

  const toggleBookRead = (bookId: string) => {
    setBooks((current) =>
      current.map((book) => {
        if (book.id !== bookId) return book;
        if (book.isRead) {
          const { isRead, readAt, ...rest } = book;
          return rest;
        }
        return { ...book, isRead: true, readAt: new Date().toISOString() };
      })
    );
  };

  const updateBookChapterRanges = (bookId: string, chapterRanges: ChapterRange[]) => {
    setBooks((current) =>
      current.map((book) => (book.id === bookId ? { ...book, chapterRanges } : book))
    );
  };

  const updateBookTotalPageCount = useCallback((bookId: string, totalPageCount: number) => {
    const n = Math.round(totalPageCount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBooks((current) =>
      current.map((book) => (book.id === bookId ? { ...book, totalPageCount: n } : book))
    );
  }, []);

  const updateBookCoverUri = useCallback((bookId: string, coverUri: string) => {
    const uri = coverUri.trim();
    if (!uri) return;
    setBooks((current) =>
      current.map((book) => (book.id === bookId ? { ...book, coverUri: uri } : book))
    );
  }, []);

  const setBookInsightsSummary = (
    bookId: string,
    summary: BookInsightsPayload & { updatedAt: string },
  ) => {
    const stored = snapshotInsightsForStore(summary);
    setBooks((current) =>
      current.map((book) => (book.id === bookId ? { ...book, insightsSummary: stored } : book))
    );
  };

  const clearBookInsightsSummary = (bookId: string) => {
    setBooks((current) =>
      current.map((book) => {
        if (book.id !== bookId || !book.insightsSummary) return book;
        const { insightsSummary: _removed, ...rest } = book;
        return rest as BookItem;
      })
    );
  };

  const addOrActivateBook = ({
    title,
    author,
    coverUri,
    totalPageCount,
    isbn,
  }: {
    title: string;
    author: string;
    coverUri: string;
    totalPageCount?: number;
    isbn?: string;
  }) => {
    const normalizedTitle = title.trim().toLowerCase();
    const normalizedIsbn = isbn?.trim() ? isbn.replace(/[^0-9X]/gi, "").toUpperCase() : undefined;
    const existing = books.find((book) => book.title.trim().toLowerCase() === normalizedTitle);
    if (existing) {
      if (!existing.isRead) {
        setActiveBookId(existing.id);
      }
      const needsPages = existing.totalPageCount == null && totalPageCount != null && totalPageCount > 0;
      const needsIsbn = !existing.isbn && normalizedIsbn;
      if (needsPages || needsIsbn) {
        setBooks((current) =>
          current.map((book) => {
            if (book.id !== existing.id) return book;
            return {
              ...book,
              ...(needsIsbn ? { isbn: normalizedIsbn } : {}),
              ...(needsPages ? { totalPageCount: Math.round(totalPageCount!) } : {}),
            };
          })
        );
      }
      return;
    }

    const nextBook: BookItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      author: author.trim(),
      coverUri,
      createdAt: new Date().toISOString(),
      ...(totalPageCount != null && totalPageCount > 0 ? { totalPageCount: Math.round(totalPageCount) } : {}),
      ...(normalizedIsbn ? { isbn: normalizedIsbn } : {}),
    };
    setBooks((current) => [nextBook, ...current]);
    setActiveBookId(nextBook.id);
    playSoundEffect("bookAddedSuccessful");
    setBookAddedToastCount((c) => c + 1);
  };

  const activeBook = books.find((book) => book.id === activeBookId) ?? null;

  const reports = books
    .map((book) => ({
      book,
      scans: scans.filter((scan) => scan.bookId === book.id),
    }))
    .filter((report) => report.scans.length > 0);

  const value = useMemo(
    () => ({
      scans,
      books,
      activeBookId,
      activeBook,
      isCoverProcessing,
      setIsCoverProcessing,
      setActiveBookId,
      addScan,
      updateScan,
      removeScan,
      removeBook,
      toggleBookRead,
      addOrActivateBook,
      updateBookChapterRanges,
      updateBookTotalPageCount,
      updateBookCoverUri,
      setBookInsightsSummary,
      clearBookInsightsSummary,
      reports,
    }),
    [scans, books, activeBookId, activeBook, isCoverProcessing, reports, updateBookTotalPageCount, updateBookCoverUri]
  );

  return (
    <ScanContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <BookAddedToast showCount={bookAddedToastCount} />
        <BookDeletedToast showCount={bookDeletedToastCount} />
      </View>
    </ScanContext.Provider>
  );
}

export function useScanContext() {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error("useScanContext must be used inside ScanProvider");
  }
  return context;
}
