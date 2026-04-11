import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { appendReadingSession, loadReadingSessions } from "../reading/readingSessionsStorage";
import type { ReadingSession } from "../types/note";
import { useScanContext } from "./ScanContext";

type RunState =
  | {
      phase: "active";
      startedAt: number;
      startPage: string;
      bookId: string | null;
      bookTitle: string | null;
    }
  | {
      phase: "stopped";
      startedAt: number;
      stoppedAt: number;
      startPage: string;
      bookId: string | null;
      bookTitle: string | null;
    };

type ReadingSessionContextValue = {
  sessions: ReadingSession[];
  run: RunState | null;
  /** `bookId` null = not tied to a library book. Title is resolved from `books` when present. */
  startReading: (startPage: string, bookId: string | null) => void;
  stopReading: () => void;
  saveReading: (endPage: string) => void;
  cancelReading: () => void;
};

const ReadingSessionContext = createContext<ReadingSessionContextValue | undefined>(undefined);

export function ReadingSessionProvider({ children }: { children: ReactNode }) {
  const { books } = useScanContext();
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [run, setRun] = useState<RunState | null>(null);

  useEffect(() => {
    loadReadingSessions().then(setSessions).catch(() => {});
  }, []);

  const startReading = useCallback((startPage: string, bookId: string | null) => {
    const trimmed = startPage.trim();
    if (!trimmed) return;
    const book = bookId ? books.find((b) => b.id === bookId) : null;
    setRun({
      phase: "active",
      startedAt: Date.now(),
      startPage: trimmed,
      bookId: book?.id ?? null,
      bookTitle: book?.title ?? null,
    });
  }, [books]);

  const stopReading = useCallback(() => {
    setRun((r) =>
      r?.phase === "active"
        ? {
            phase: "stopped",
            startedAt: r.startedAt,
            stoppedAt: Date.now(),
            startPage: r.startPage,
            bookId: r.bookId,
            bookTitle: r.bookTitle,
          }
        : r
    );
  }, []);

  const saveReading = useCallback((endPage: string) => {
    const trimmed = endPage.trim();
    if (!trimmed) return;
    setRun((current) => {
      if (!current || current.phase !== "stopped") return current;
      const durationSeconds = Math.max(
        0,
        Math.round((current.stoppedAt - current.startedAt) / 1000)
      );
      const session: ReadingSession = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bookId: current.bookId,
        bookTitle: current.bookTitle,
        startPage: current.startPage,
        endPage: trimmed,
        startedAt: new Date(current.startedAt).toISOString(),
        endedAt: new Date(current.stoppedAt).toISOString(),
        durationSeconds,
      };
      void appendReadingSession(session).then(() => {
        setSessions((prev) => [session, ...prev]);
      });
      return null;
    });
  }, []);

  const cancelReading = useCallback(() => {
    setRun(null);
  }, []);

  const value = useMemo(
    () => ({
      sessions,
      run,
      startReading,
      stopReading,
      saveReading,
      cancelReading,
    }),
    [sessions, run, startReading, stopReading, saveReading, cancelReading]
  );

  return <ReadingSessionContext.Provider value={value}>{children}</ReadingSessionContext.Provider>;
}

export function useReadingSession() {
  const ctx = useContext(ReadingSessionContext);
  if (!ctx) {
    throw new Error("useReadingSession must be used inside ReadingSessionProvider");
  }
  return ctx;
}
