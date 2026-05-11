import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadScanLibrary, saveScanLibrary } from "../storage/scanLibraryStorage";
import type { BookInsightsPayload, BookItem, BookReport, ChapterRange, ScanItem } from "../types/note";
import { playSoundEffect } from "../utils/soundEffects";

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
  addOrActivateBook: (book: { title: string; author: string; coverUri: string }) => void;
  updateBookChapterRanges: (bookId: string, chapterRanges: ChapterRange[]) => void;
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
  };

  const removeBook = (bookId: string) => {
    setBooks((current) => current.filter((book) => book.id !== bookId));
    setScans((current) => current.filter((scan) => scan.bookId !== bookId));
    setActiveBookId((current) => (current === bookId ? null : current));
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

  const setBookInsightsSummary = (
    bookId: string,
    summary: BookInsightsPayload & { updatedAt: string },
  ) => {
    setBooks((current) =>
      current.map((book) => (book.id === bookId ? { ...book, insightsSummary: summary } : book))
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
  }: {
    title: string;
    author: string;
    coverUri: string;
  }) => {
    const normalizedTitle = title.trim().toLowerCase();
    const existing = books.find((book) => book.title.trim().toLowerCase() === normalizedTitle);
    if (existing) {
      if (!existing.isRead) {
        setActiveBookId(existing.id);
      }
      return;
    }

    const nextBook: BookItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      author: author.trim(),
      coverUri,
      createdAt: new Date().toISOString(),
    };
    setBooks((current) => [nextBook, ...current]);
    setActiveBookId(nextBook.id);
    playSoundEffect("bookAddedSuccessful");
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
      setBookInsightsSummary,
      clearBookInsightsSummary,
      reports,
    }),
    [scans, books, activeBookId, activeBook, isCoverProcessing, reports]
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScanContext() {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error("useScanContext must be used inside ScanProvider");
  }
  return context;
}
