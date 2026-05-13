import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { appendReadingSession, loadReadingSessions } from "../reading/readingSessionsStorage";
import type { ReadingSession } from "../types/note";
import { useScanContext } from "./ScanContext";

export type ReadingRunState =
  | {
      phase: "running";
      startedAt: number;
      startPage: string;
      bookId: string | null;
      bookTitle: string | null;
      accumulatedActiveMs: number;
      activeSegmentStart: number;
    }
  | {
      phase: "paused";
      startedAt: number;
      startPage: string;
      bookId: string | null;
      bookTitle: string | null;
      accumulatedActiveMs: number;
    }
  | {
      phase: "stopped";
      startedAt: number;
      stoppedAt: number;
      durationSeconds: number;
      startPage: string;
      bookId: string | null;
      bookTitle: string | null;
    };

export function getActiveElapsedSeconds(run: ReadingRunState | null): number {
  if (!run) return 0;
  if (run.phase === "stopped") return run.durationSeconds;
  if (run.phase === "paused") return Math.max(0, Math.floor(run.accumulatedActiveMs / 1000));
  return Math.max(0, Math.floor((run.accumulatedActiveMs + (Date.now() - run.activeSegmentStart)) / 1000));
}

type ReadingSessionContextValue = {
  sessions: ReadingSession[];
  run: ReadingRunState | null;
  /** Set when the user saves a session; clear with `clearLastCompletedSession` (e.g. Done on summary). */
  lastCompletedSession: ReadingSession | null;
  clearLastCompletedSession: () => void;
  /** `bookId` null = not tied to a library book. Title is resolved from `books` when present. */
  startReading: (startPage: string, bookId: string | null) => void;
  pauseReading: () => void;
  resumeReading: () => void;
  stopReading: () => void;
  saveReading: (endPage: string) => void;
  cancelReading: () => void;
};

const ReadingSessionContext = createContext<ReadingSessionContextValue | undefined>(undefined);

export function ReadingSessionProvider({ children }: { children: ReactNode }) {
  const { books } = useScanContext();
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [run, setRun] = useState<ReadingRunState | null>(null);
  const [lastCompletedSession, setLastCompletedSession] = useState<ReadingSession | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const clearLastCompletedSession = useCallback(() => {
    setLastCompletedSession(null);
  }, []);

  useEffect(() => {
    loadReadingSessions().then(setSessions).catch(() => {});
  }, []);

  const startReading = useCallback((startPage: string, bookId: string | null) => {
    const trimmed = startPage.trim();
    if (!trimmed) return;
    const book = bookId ? books.find((b) => b.id === bookId) : null;
    const now = Date.now();
    setRun({
      phase: "running",
      startedAt: now,
      startPage: trimmed,
      bookId: book?.id ?? null,
      bookTitle: book?.title ?? null,
      accumulatedActiveMs: 0,
      activeSegmentStart: now,
    });
  }, [books]);

  const pauseReading = useCallback(() => {
    setRun((r) => {
      if (r?.phase !== "running") return r;
      const now = Date.now();
      return {
        phase: "paused",
        startedAt: r.startedAt,
        startPage: r.startPage,
        bookId: r.bookId,
        bookTitle: r.bookTitle,
        accumulatedActiveMs: r.accumulatedActiveMs + (now - r.activeSegmentStart),
      };
    });
  }, []);

  const resumeReading = useCallback(() => {
    setRun((r) => {
      if (r?.phase !== "paused") return r;
      const now = Date.now();
      return {
        phase: "running",
        startedAt: r.startedAt,
        startPage: r.startPage,
        bookId: r.bookId,
        bookTitle: r.bookTitle,
        accumulatedActiveMs: r.accumulatedActiveMs,
        activeSegmentStart: now,
      };
    });
  }, []);

  const stopReading = useCallback(() => {
    setRun((r) => {
      if (r?.phase !== "running" && r?.phase !== "paused") return r;
      const now = Date.now();
      const extra = r.phase === "running" ? now - r.activeSegmentStart : 0;
      const totalMs = r.accumulatedActiveMs + extra;
      return {
        phase: "stopped",
        startedAt: r.startedAt,
        stoppedAt: now,
        durationSeconds: Math.max(0, Math.round(totalMs / 1000)),
        startPage: r.startPage,
        bookId: r.bookId,
        bookTitle: r.bookTitle,
      };
    });
  }, []);

  const saveReading = useCallback((endPage: string) => {
    const trimmed = endPage.trim();
    if (!trimmed) return;
    const current = runRef.current;
    if (!current || current.phase !== "stopped") return;
    const session: ReadingSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bookId: current.bookId,
      bookTitle: current.bookTitle,
      startPage: current.startPage,
      endPage: trimmed,
      startedAt: new Date(current.startedAt).toISOString(),
      endedAt: new Date(current.stoppedAt).toISOString(),
      durationSeconds: current.durationSeconds,
    };
    setRun(null);
    setLastCompletedSession(session);
    setSessions((prev) => [session, ...prev]);
    void appendReadingSession(session).catch(() => {
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setLastCompletedSession(null);
    });
  }, []);

  const cancelReading = useCallback(() => {
    setRun(null);
  }, []);

  const value = useMemo(
    () => ({
      sessions,
      run,
      lastCompletedSession,
      clearLastCompletedSession,
      startReading,
      pauseReading,
      resumeReading,
      stopReading,
      saveReading,
      cancelReading,
    }),
    [
      sessions,
      run,
      lastCompletedSession,
      clearLastCompletedSession,
      startReading,
      pauseReading,
      resumeReading,
      stopReading,
      saveReading,
      cancelReading,
    ]
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
