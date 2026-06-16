import type { ScanItem } from "../types/note";

/**
 * Two scans are considered the same capture when they share the same source
 * image and belong to the same book. This is exactly what the old duplicate-
 * report bug produced (one tap → two `ScanItem`s pointing at the same photo),
 * and it also catches duplicates left behind by older app versions.
 *
 * Distinct captures always have distinct `imageUri`s, so genuine re-scans of the
 * same physical page are never collapsed.
 */
function duplicateKey(scan: ScanItem): string | null {
  const uri = typeof scan.imageUri === "string" ? scan.imageUri.trim() : "";
  if (!uri) return null;
  const bookKey = scan.bookId ?? scan.book ?? "";
  return `${bookKey}::${uri}`;
}

/** Higher score = keep this copy when two scans collide. */
function scoreScan(scan: ScanItem): number {
  let score = 0;
  if (scan.entityGraph) score += 1000;
  if (scan.reinforcedIdeas?.length) score += scan.reinforcedIdeas.length * 10;
  const notes = scan.notes;
  if (notes) {
    if (notes.detailedNotes) score += notes.detailedNotes.length;
    if (notes.mainIdeas?.length) score += notes.mainIdeas.length;
    if (notes.summary) score += notes.summary.length;
  }
  return score;
}

export type DedupeScansResult = {
  scans: ScanItem[];
  removedCount: number;
};

/**
 * Removes duplicate scans, keeping a single copy per capture. The surviving
 * copy stays in the position of its first occurrence (so list order/recency is
 * preserved), but its richest version is retained.
 */
export function dedupeScans(scans: ScanItem[]): DedupeScansResult {
  if (!Array.isArray(scans) || scans.length < 2) {
    return { scans: Array.isArray(scans) ? scans : [], removedCount: 0 };
  }

  const indexByKey = new Map<string, number>();
  const result: ScanItem[] = [];
  let removedCount = 0;

  for (const scan of scans) {
    const key = duplicateKey(scan);
    if (key === null) {
      result.push(scan);
      continue;
    }

    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push(scan);
      continue;
    }

    removedCount += 1;
    if (scoreScan(scan) > scoreScan(result[existingIndex])) {
      result[existingIndex] = scan;
    }
  }

  return { scans: result, removedCount };
}

/** Convenience for callers that just need the cleaned list. */
export function hasDuplicateScans(scans: ScanItem[]): boolean {
  return dedupeScans(scans).removedCount > 0;
}
