import { polishBookTitleFromCatalogMetadata } from "./ai";
import { cleanCatalogBookTitle, needsAiTitlePolish } from "../utils/cleanCatalogBookTitle";

export type OpenLibraryBookResult = {
  isbn: string;
  title: string;
  author: string;
  coverUrl: string | null;
  pageCount: number | null;
  publishYear: string | null;
  subject: string | null;
};

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9X]/gi, "").toUpperCase();
}

export function formatIsbnDisplay(raw: string): string {
  const n = normalizeIsbn(raw);
  if (n.length === 13) {
    return `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 7)}-${n.slice(7, 12)}-${n.slice(12)}`;
  }
  if (n.length === 10) {
    return `${n.slice(0, 1)}-${n.slice(1, 4)}-${n.slice(4, 9)}-${n.slice(9)}`;
  }
  return raw.trim();
}

function firstPublishYear(publishDate?: string): string | null {
  if (!publishDate?.trim()) return null;
  const match = publishDate.match(/\d{4}/);
  return match?.[0] ?? null;
}

type OpenLibraryDataEntry = {
  title?: string;
  authors?: Array<{ name?: string }>;
  number_of_pages?: number;
  publish_date?: string;
  subjects?: Array<{ name?: string } | string>;
  cover?: { medium?: string; large?: string; small?: string };
};

type OpenLibraryEditionJson = {
  covers?: number[];
  number_of_pages?: number;
};

type OpenLibrarySearchDoc = {
  number_of_pages_median?: number;
  number_of_pages?: number;
};

async function fetchEditionPageCount(isbn: string, signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(
      `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`,
      { signal }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as OpenLibraryEditionJson;
    if (typeof data.number_of_pages === "number" && data.number_of_pages > 0) {
      return Math.round(data.number_of_pages);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPageCountByTitleAuthor(
  title: string,
  author: string,
  signal?: AbortSignal
): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      title: title.trim(),
      limit: "1",
      fields: "number_of_pages_median,number_of_pages",
    });
    const authorTrim = author.trim();
    if (authorTrim && authorTrim.toLowerCase() !== "unknown author") {
      params.set("author", authorTrim);
    }
    const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
      signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { docs?: OpenLibrarySearchDoc[] };
    const doc = data.docs?.[0];
    if (!doc) return null;
    const pages =
      typeof doc.number_of_pages_median === "number" && doc.number_of_pages_median > 0
        ? doc.number_of_pages_median
        : typeof doc.number_of_pages === "number" && doc.number_of_pages > 0
          ? doc.number_of_pages
          : null;
    return pages != null ? Math.round(pages) : null;
  } catch {
    return null;
  }
}

export async function fetchBookPageCountFromApi(
  book: { isbn?: string | null; title: string; author: string },
  signal?: AbortSignal
): Promise<number | null> {
  const isbn = book.isbn?.trim() ? normalizeIsbn(book.isbn) : "";
  if (isbn.length === 10 || isbn.length === 13) {
    const fromEdition = await fetchEditionPageCount(isbn, signal);
    if (fromEdition != null) return fromEdition;

    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
    const response = await fetch(url, { signal });
    if (response.ok) {
      const data = (await response.json()) as Record<string, OpenLibraryDataEntry | undefined>;
      const entry = data[`ISBN:${isbn}`];
      if (typeof entry?.number_of_pages === "number" && entry.number_of_pages > 0) {
        return Math.round(entry.number_of_pages);
      }
    }
  }

  return fetchPageCountByTitleAuthor(book.title, book.author, signal);
}

async function coverUrlExists(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}default=false`, {
      method: "HEAD",
      signal,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchEditionCoverId(isbn: string, signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(
      `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`,
      { signal }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as OpenLibraryEditionJson;
    const id = data.covers?.[0];
    return typeof id === "number" && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function resolveOpenLibraryCoverUrl(
  isbn: string,
  fromDataApi: string | null,
  signal?: AbortSignal
): Promise<string | null> {
  if (fromDataApi?.trim()) return fromDataApi.trim();

  const coverId = await fetchEditionCoverId(isbn, signal);
  if (coverId != null) {
    const byId = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
    if (await coverUrlExists(byId, signal)) return byId;
    const byIdMedium = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
    if (await coverUrlExists(byIdMedium, signal)) return byIdMedium;
  }

  for (const size of ["L", "M"] as const) {
    const byIsbn = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg`;
    if (await coverUrlExists(byIsbn, signal)) return byIsbn;
  }

  return null;
}

export async function downloadBookCoverToCache(
  remoteUrl: string,
  isbn: string,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) throw new Error("Aborted");

  const FileSystem = await import("expo-file-system/legacy");
  const dir = `${FileSystem.cacheDirectory}book-covers/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const dest = `${dir}${normalizeIsbn(isbn)}.jpg`;

  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) return dest;

  const result = await FileSystem.downloadAsync(remoteUrl, dest);
  if (signal?.aborted) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error("Aborted");
  }

  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || (typeof info.size === "number" && info.size < 512)) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error("Downloaded cover image was empty or invalid");
  }

  return result.uri;
}

export async function lookupBookByIsbn(
  rawIsbn: string,
  signal?: AbortSignal
): Promise<OpenLibraryBookResult | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (isbn.length !== 10 && isbn.length !== 13) return null;

  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = (await response.json()) as Record<string, OpenLibraryDataEntry | undefined>;
  const entry = data[`ISBN:${isbn}`];
  if (!entry?.title?.trim()) return null;

  const author =
    entry.authors?.map((a) => a.name?.trim()).filter(Boolean).join(", ") || "Unknown author";

  const rawTitle = entry.title.trim();
  let title = cleanCatalogBookTitle(rawTitle, author);
  if (needsAiTitlePolish(title, author)) {
    const polished = await polishBookTitleFromCatalogMetadata(title, author, signal);
    if (polished?.trim()) {
      title = polished.trim();
    }
  }

  const dataApiCover =
    entry.cover?.large?.trim() ||
    entry.cover?.medium?.trim() ||
    entry.cover?.small?.trim() ||
    null;

  let coverUrl = await resolveOpenLibraryCoverUrl(isbn, dataApiCover, signal);
  if (coverUrl) {
    const remoteCover = coverUrl;
    try {
      coverUrl = await downloadBookCoverToCache(remoteCover, isbn, signal);
    } catch {
      coverUrl = remoteCover;
    }
  }

  const subjectRaw = entry.subjects?.[0];
  const subject =
    typeof subjectRaw === "string"
      ? subjectRaw.trim() || null
      : subjectRaw?.name?.trim() || null;

  let pageCount =
    typeof entry.number_of_pages === "number" && entry.number_of_pages > 0
      ? Math.round(entry.number_of_pages)
      : null;
  if (pageCount == null) {
    pageCount = await fetchEditionPageCount(isbn, signal);
  }
  if (pageCount == null) {
    pageCount = await fetchPageCountByTitleAuthor(title, author, signal);
  }

  return {
    isbn,
    title,
    author,
    coverUrl,
    pageCount,
    publishYear: firstPublishYear(entry.publish_date),
    subject,
  };
}

export function isValidIsbnInput(raw: string): boolean {
  const n = normalizeIsbn(raw);
  return n.length === 10 || n.length === 13;
}
