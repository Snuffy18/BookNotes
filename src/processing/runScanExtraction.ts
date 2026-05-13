import type { ScanStackParamList } from "../navigation/types";
import { extractEntitiesFromPageText, generateNotesFromImage } from "../services/ai";
import type { ExistingEntitySeed } from "../study/buildEntityExtractionPrompt";
import type { BookItem, ChapterRange, ScanItem } from "../types/note";
import type { StudyPreferencesSnapshot } from "../types/studyPreferences";
import { detectReinforcedIdeas } from "../utils/detectReinforcedIdeas";
import { toProcessingUserMessage } from "../utils/processingErrorMessage";

export type RunScanExtractionParams = ScanStackParamList["Processing"];

export type RunScanExtractionDeps = {
  activeBook: BookItem | null;
  books: BookItem[];
  scans: ScanItem[];
  studyPrefs: StudyPreferencesSnapshot;
  addScan: (item: ScanItem) => void;
  updateScan: (id: string, patch: Partial<ScanItem>) => void;
  recordSuccessfulScan: () => void;
};

function parseNumericPage(page?: string) {
  if (!page) return null;
  const match = page.match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function findChapterForPage(page: number | null, ranges?: ChapterRange[]) {
  if (page === null || !ranges || ranges.length === 0) return null;
  const sorted = [...ranges].sort((a, b) => a.startPage - b.startPage);
  return (
    sorted.find((range, index) => {
      const inferredEnd = sorted[index + 1]?.startPage
        ? sorted[index + 1].startPage - 1
        : undefined;
      const endPage = range.endPage ?? inferredEnd;
      return page >= range.startPage && (endPage === undefined || page <= endPage);
    })?.title ?? null
  );
}

export async function runScanExtraction(
  params: RunScanExtractionParams,
  deps: RunScanExtractionDeps
): Promise<ScanItem> {
  const {
    activeBook,
    books,
    scans,
    studyPrefs,
    addScan,
    updateScan,
    recordSuccessfulScan,
  } = deps;

  const rescanId = params.rescanForScanId;
  const studyPreferencesSnapshot =
    params.studyPreferences ?? {
      tone: studyPrefs.tone,
      length: studyPrefs.length,
      highlightKeyElements: studyPrefs.highlightKeyElements,
      highlightKeyTerms: studyPrefs.highlightKeyTerms,
      highlightDefinitions: studyPrefs.highlightDefinitions,
      highlightNumbersDates: studyPrefs.highlightNumbersDates,
    };
  const extractionModes = params.extractionModes ?? [params.extractionMode ?? "everything"];

  const notes = await generateNotesFromImage(params.imageUri, studyPreferencesSnapshot, extractionModes);

  const pageLabel = params.page?.trim() || notes.pageNumber?.trim() || "";
  const existingScan = rescanId ? scans.find((s) => s.id === rescanId) : undefined;
  const bookForScan = existingScan?.bookId
    ? books.find((b) => b.id === existingScan.bookId) ?? activeBook
    : activeBook;
  const mappedChapter = findChapterForPage(parseNumericPage(pageLabel), bookForScan?.chapterRanges);
  const chapterLabel =
    params.chapter?.trim() ||
    mappedChapter ||
    notes.sectionHeadings?.[0]?.trim() ||
    existingScan?.chapter?.trim() ||
    "";
  const previousBookScans = bookForScan?.id
    ? scans.filter((scan) => scan.bookId === bookForScan.id && scan.id !== rescanId)
    : [];
  const reinforcedIdeas = detectReinforcedIdeas(
    notes.mainIdeas,
    pageLabel || undefined,
    previousBookScans
  );

  const pageTextForEntities = [
    notes.summary?.trim() ?? "",
    ...(Array.isArray(notes.mainIdeas) ? notes.mainIdeas : []),
    notes.detailedNotes?.trim() ?? "",
    ...(Array.isArray(notes.quotes) ? notes.quotes : []),
  ]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n");

  const existingEntityMap = new Map<string, ExistingEntitySeed>();
  if (bookForScan?.id) {
    previousBookScans.forEach((scan) => {
      (scan.entityGraph?.entities ?? []).forEach((entity) => {
        const current = existingEntityMap.get(entity.id);
        if (current) {
          const mergedAliases = Array.from(
            new Set([...(current.aliases ?? []), ...(entity.aliases ?? [])])
          );
          existingEntityMap.set(entity.id, {
            ...current,
            aliases: mergedAliases,
          });
          return;
        }
        existingEntityMap.set(entity.id, {
          id: entity.id,
          canonical_name: entity.canonical_name,
          type: entity.type,
          aliases: entity.aliases,
        });
      });
    });
  }

  let entityGraph: ScanItem["entityGraph"] | undefined;

  if (pageTextForEntities.length > 0) {
    try {
      entityGraph = await extractEntitiesFromPageText({
        bookMetadata: {
          title: bookForScan?.title ?? "",
          author: bookForScan?.author ?? "",
          context: bookForScan?.chapterRanges?.length
            ? `Known chapter ranges: ${bookForScan.chapterRanges
                .map((r) => `${r.title} (${r.startPage}${r.endPage ? `-${r.endPage}` : "+"})`)
                .join(", ")}`
            : undefined,
        },
        pageText: pageTextForEntities,
        pageNumber: parseNumericPage(pageLabel) ?? 0,
        existingEntities: Array.from(existingEntityMap.values()),
      });
    } catch {
      // Entity graph is optional.
    }
  }

  if (rescanId) {
    if (!existingScan) {
      throw new Error("That report is no longer available. Open it again from your library.");
    }
    const nextPage = pageLabel || existingScan.page;
    const nextChapter = chapterLabel.trim() ? chapterLabel : existingScan.chapter;
    updateScan(rescanId, {
      ...(nextPage?.trim() ? { page: nextPage.trim() } : {}),
      ...(nextChapter?.trim() ? { chapter: nextChapter.trim() } : {}),
      extractionMode: extractionModes[0] ?? "everything",
      extractionModes,
      notes,
      reinforcedIdeas: reinforcedIdeas.length > 0 ? reinforcedIdeas : undefined,
      ...(entityGraph ? { entityGraph } : {}),
      studyPreferences: studyPreferencesSnapshot,
    });
    return {
      ...existingScan,
      ...(nextPage?.trim() ? { page: nextPage.trim() } : {}),
      ...(nextChapter?.trim() ? { chapter: nextChapter.trim() } : {}),
      extractionMode: extractionModes[0] ?? "everything",
      extractionModes,
      notes,
      ...(reinforcedIdeas.length > 0 ? { reinforcedIdeas } : { reinforcedIdeas: undefined }),
      ...(entityGraph ? { entityGraph } : {}),
      studyPreferences: studyPreferencesSnapshot,
    };
  }

  const item: ScanItem = {
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    imageUri: params.imageUri,
    bookId: activeBook?.id,
    book: activeBook?.title,
    ...(pageLabel ? { page: pageLabel } : {}),
    ...(chapterLabel ? { chapter: chapterLabel } : {}),
    extractionMode: extractionModes[0] ?? "everything",
    extractionModes,
    notes,
    ...(reinforcedIdeas.length > 0 ? { reinforcedIdeas } : {}),
    ...(entityGraph ? { entityGraph } : {}),
    studyPreferences: studyPreferencesSnapshot,
  };
  addScan(item);
  recordSuccessfulScan();
  return item;
}

export function mapScanExtractionError(error: unknown): string {
  return toProcessingUserMessage(error);
}
