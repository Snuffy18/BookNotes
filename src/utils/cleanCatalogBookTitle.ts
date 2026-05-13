function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function authorNameVariants(author: string): string[] {
  const trimmed = author.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);

  for (const part of trimmed.split(/[,;&]/).map((segment) => segment.trim()).filter(Boolean)) {
    const commaMatch = part.match(/^([^,]+),\s*(.+)$/);
    if (commaMatch) {
      variants.add(`${commaMatch[2].trim()} ${commaMatch[1].trim()}`);
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    variants.add(`${words[words.length - 1]}, ${words.slice(0, -1).join(" ")}`);
  }

  return [...variants];
}

function stripTrailingAuthor(title: string, author: string): string {
  if (!author.trim() || author.trim().toLowerCase() === "unknown author") {
    return title;
  }

  let result = title;
  for (const variant of authorNameVariants(author)) {
    const escaped = escapeRegExp(variant);
    const patterns = [
      new RegExp(`\\s*/\\s*${escaped}\\s*$`, "i"),
      new RegExp(`\\s*[-–—]\\s*${escaped}\\s*$`, "i"),
      new RegExp(`\\s*,\\s*${escaped}\\s*$`, "i"),
      new RegExp(`\\s+${escaped}\\s*$`, "i"),
    ];
    for (const pattern of patterns) {
      result = result.replace(pattern, "");
    }
  }

  return result.trim();
}

/**
 * Strips catalog noise from API titles (dates in brackets, edition tags, duplicate authors)
 * while keeping real subtitles and numeric titles intact.
 */
export function cleanCatalogBookTitle(rawTitle: string, author?: string): string {
  let title = rawTitle.trim();
  if (!title) return title;

  title = title.replace(/\s*\[[^\]]*\]/g, "");
  title = title.replace(/\s*\([^)]*\b(19|20)\d{2}[^)]*\)/g, "");
  title = title.replace(
    /\s*\((?:revised|updated|expanded|annotated|abridged|unabridged|paperback|hardcover|kindle|ebook)[^)]*\)/gi,
    ""
  );
  title = title.replace(/\s*:\s*/g, ": ");

  if (author) {
    title = stripTrailingAuthor(title, author);
  }

  title = title.replace(/[\s,;/\-–—]+$/, "").trim();
  title = title.replace(/\s{2,}/g, " ");

  return title;
}

export function needsAiTitlePolish(title: string, author?: string): boolean {
  if (/[\[\]]/.test(title)) return true;

  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(title)) {
    return true;
  }

  if (author && author.trim().toLowerCase() !== "unknown author") {
    const titleKey = normalizeNameKey(title);
    for (const variant of authorNameVariants(author)) {
      const variantKey = normalizeNameKey(variant);
      if (variantKey.length >= 4 && titleKey.endsWith(variantKey)) {
        return true;
      }
    }
  }

  const commaCount = (title.match(/,/g) ?? []).length;
  if (commaCount >= 2) return true;

  return false;
}
