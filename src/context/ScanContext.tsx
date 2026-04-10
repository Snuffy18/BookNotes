import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { BookItem, BookReport, ScanItem } from "../types/note";

type ScanContextValue = {
  scans: ScanItem[];
  books: BookItem[];
  activeBookId: string | null;
  activeBook: BookItem | null;
  setActiveBookId: (bookId: string) => void;
  addScan: (scan: ScanItem) => void;
  addOrActivateBook: (book: { title: string; author: string; coverUri: string }) => void;
  reports: BookReport[];
};

const ScanContext = createContext<ScanContextValue | undefined>(undefined);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  const addScan = (scan: ScanItem) => {
    setScans((current) => [scan, ...current]);
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
      setActiveBookId(existing.id);
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
      setActiveBookId,
      addScan,
      addOrActivateBook,
      reports,
    }),
    [scans, books, activeBookId, activeBook, reports]
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
