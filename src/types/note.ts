import type { StudyPreferencesSnapshot } from "./studyPreferences";

export type GeneratedNotes = {
  summary: string;
  mainIdeas: string[];
  detailedNotes: string;
  keywords: string[];
  /** Verbatim or near-verbatim quotes from the page; omit or [] when none. */
  quotes?: string[];
  /** Section/chapter/subsection titles visible on the page (top-to-bottom); omit or [] when none. */
  sectionHeadings?: string[];
};

export type ScanItem = {
  id: string;
  createdAt: string;
  imageUri: string;
  bookId?: string;
  book?: string;
  chapter?: string;
  notes: GeneratedNotes;
  /** Preferences used when this scan was generated (for report UI). */
  studyPreferences?: StudyPreferencesSnapshot;
};

export type BookItem = {
  id: string;
  title: string;
  author: string;
  coverUri: string;
  createdAt: string;
};

export type BookReport = {
  book: BookItem;
  scans: ScanItem[];
};

/** Logged when the user finishes a reading timer session on the Scan page. */
export type ReadingSession = {
  id: string;
  bookId: string | null;
  bookTitle: string | null;
  startPage: string;
  endPage: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};
