import { stripMarkdownBoldMarkers } from "./stripMarkdownBoldMarkers";
import type { ScanItem } from "../types/note";

export type ReinforcedIdeaMatch = {
  idea: string;
  matchedScanId: string;
  matchedPage?: string;
};

function normalizeIdea(raw: string): string {
  return stripMarkdownBoldMarkers(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePage(raw?: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * Detects ideas repeated across different scans/pages for the same book.
 */
export function detectReinforcedIdeas(
  currentMainIdeas: string[],
  currentPage: string | undefined,
  previousScans: ScanItem[]
): ReinforcedIdeaMatch[] {
  const currentPageKey = normalizePage(currentPage);
  const seenIdeaKeys = new Set<string>();
  const matches: ReinforcedIdeaMatch[] = [];

  for (const currentIdea of currentMainIdeas) {
    const currentKey = normalizeIdea(currentIdea);
    if (!currentKey || seenIdeaKeys.has(currentKey)) continue;

    for (const prev of previousScans) {
      const prevPageKey = normalizePage(prev.page);
      const sameKnownPage =
        currentPageKey.length > 0 && prevPageKey.length > 0 && currentPageKey === prevPageKey;
      if (sameKnownPage) continue;

      const prevIdeas = Array.isArray(prev.notes.mainIdeas) ? prev.notes.mainIdeas : [];
      const hasMatch = prevIdeas.some((idea) => normalizeIdea(idea) === currentKey);
      if (!hasMatch) continue;

      matches.push({
        idea: stripMarkdownBoldMarkers(currentIdea).trim(),
        matchedScanId: prev.id,
        ...(prev.page?.trim() ? { matchedPage: prev.page.trim() } : {}),
      });
      seenIdeaKeys.add(currentKey);
      break;
    }
  }

  return matches;
}
