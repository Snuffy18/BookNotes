import type { StudyPreferencesSnapshot } from "./studyPreferences";

export type ExtractionMode = "quotes" | "words" | "bulletPoints" | "everything";

export type VocabularyTerm = {
  word: string;
  definition: string;
};

export type ChapterRange = {
  title: string;
  startPage: number;
  endPage?: number;
};

export type GeneratedNotes = {
  summary: string;
  mainIdeas: string[];
  detailedNotes: string;
  keywords: string[];
  /** Harder or less-common vocabulary from the page with concise definitions. */
  vocabularyTerms?: VocabularyTerm[];
  /** Verbatim or near-verbatim quotes from the page; omit or [] when none. */
  quotes?: string[];
  /** Section/chapter/subsection titles visible on the page (top-to-bottom); omit or [] when none. */
  sectionHeadings?: string[];
  /** Printed page number visible in the scan, if detected. */
  pageNumber?: string;
};

export type EntityNode = {
  id: string;
  canonical_name: string;
  type: "person" | "place" | "concept" | "work" | "organization" | "event";
  aliases: string[];
  description: string;
  salience: "high" | "medium" | "low";
  first_seen_page: number;
};

export type EntityRelationship = {
  source_id: string;
  target_id: string;
  type: string;
  evidence: string;
  page: number;
};

export type PageEntityGraph = {
  entities: EntityNode[];
  relationships: EntityRelationship[];
  page_summary: string;
};

export type ReinforcedIdea = {
  idea: string;
  matchedScanId: string;
  matchedPage?: string;
};

export type ScanItem = {
  id: string;
  createdAt: string;
  imageUri: string;
  bookId?: string;
  book?: string;
  /** Page label if the user or flow provided one (e.g. "42" or "xii"). */
  page?: string;
  chapter?: string;
  /** What the user asked to extract from this scan. Older reports default to "everything". */
  extractionMode?: ExtractionMode;
  /** Multiple extraction targets selected for this scan. Defaults to ["everything"]. */
  extractionModes?: ExtractionMode[];
  notes: GeneratedNotes;
  /** Optional per-page graph extraction generated from page text. */
  entityGraph?: PageEntityGraph;
  /** Main ideas that also appeared in earlier scans (different pages/signals of importance). */
  reinforcedIdeas?: ReinforcedIdea[];
  /** Preferences used when this scan was generated (for report UI). */
  studyPreferences?: StudyPreferencesSnapshot;
};

export type BookInsightsStat = {
  label: string;
  value: string;
};

/** AI-generated cross-report insights for a book (Book reports screen). */
export type BookInsightsSummary = {
  updatedAt: string;
  /** Legacy v1: plain prose only */
  body?: string;
  /** v2: scannable headline (one short sentence). */
  headline?: string;
  /** v2: numeric / at-a-glance chips (e.g. reports count, page span). */
  stats?: BookInsightsStat[];
  /** v2: one interesting fact per line (no long paragraphs). */
  facts?: string[];
  /** v2: 2–3 sentences of flowing thematic synthesis (no bullets); optional on older saves. */
  themesSynthesis?: string;
  /** v2: single short closing line. */
  kicker?: string;
};

/** Payload to save (caller adds `updatedAt`). */
export type BookInsightsPayload = Omit<BookInsightsSummary, "updatedAt">;

export type BookItem = {
  id: string;
  title: string;
  author: string;
  coverUri: string;
  createdAt: string;
  /** Physical last page of the book; set from scan nudge or elsewhere. Omitted until known. */
  totalPageCount?: number;
  /** ISBN from barcode lookup; used to fetch metadata such as page count. */
  isbn?: string;
  isRead?: boolean;
  readAt?: string;
  chapterRanges?: ChapterRange[];
  /** Saved "Summarize AI" output; shown as a distinct card on the book’s reports list. */
  insightsSummary?: BookInsightsSummary;
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

/** Saved AI reading summary from the Reading history screen (distinct from per-session log rows). */
export type ReadingHistoryAiReport = {
  id: string;
  createdAt: string;
  body: string;
  totalDurationSeconds: number;
  /** Sum of page spans where start/end parsed as integers; non-numeric pages count as 0. */
  totalPagesRead: number;
  sessionCount: number;
};
