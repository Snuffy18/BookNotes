import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { BookItem } from "../types/note";
import type { ExtractionMode, ScanItem } from "../types/note";
import type { PdfExportContentOptions } from "../types/exportPreferences";
import { DEFAULT_PDF_EXPORT_CONTENT } from "../types/exportPreferences";
import { getPdfCanelaFontFaceCss } from "./pdfCanelaFont";
import { stripMarkdownBoldMarkers } from "./stripMarkdownBoldMarkers";

const EXTRACTION_LABELS: Record<ExtractionMode, string> = {
  quotes: "Quotes",
  words: "Words",
  bulletPoints: "Bullet Points",
  everything: "Everything",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainToHtml(text: string): string {
  return escapeHtml(stripMarkdownBoldMarkers(text)).replace(/\n/g, "<br/>");
}

function getExtractionModes(itemMode?: ExtractionMode, itemModes?: ExtractionMode[]): ExtractionMode[] {
  return itemModes && itemModes.length > 0 ? itemModes : [itemMode ?? "everything"];
}

function formatExtractionLabel(modes: ExtractionMode[]): string {
  if (modes.includes("everything")) return EXTRACTION_LABELS.everything;
  return modes.map((mode) => EXTRACTION_LABELS[mode]).join(" + ");
}

function sortedReportsForPdf(reports: ScanItem[]): ScanItem[] {
  return [...reports].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Report meta line: date, page, chapter (Canela bold via @font-face weight 700), extraction modes. */
function buildReportMetaLineHtml(
  item: ScanItem,
  createdDisplay: string,
  includePageNumbers: boolean
): string {
  const extractionModes = getExtractionModes(item.extractionMode, item.extractionModes);
  const parts: string[] = [`<span>${escapeHtml(createdDisplay)}</span>`];
  if (includePageNumbers && item.page?.trim()) {
    parts.push(`<span>Page ${escapeHtml(item.page.trim())}</span>`);
  }
  if (item.chapter?.trim()) {
    parts.push(`<strong class="meta-chapter">${escapeHtml(item.chapter.trim())}</strong>`);
  }
  parts.push(`<span>${escapeHtml(formatExtractionLabel(extractionModes))}</span>`);
  return parts.join(" · ");
}

const PDF_CANELA_STACK = `"Canela Text PDF", "Times New Roman", Georgia, serif`;

function buildPdfHtmlWrapper(opts: {
  fontFaceCss: string;
  bookTitle: string;
  bookAuthor: string;
  metaHtml: string;
  contentHtml: string;
}): string {
  const title = escapeHtml(opts.bookTitle);
  const author = escapeHtml(opts.bookAuthor);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    ${opts.fontFaceCss}
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
      margin: 0;
      padding: 28px 36px 40px;
    }
    .book-title {
      font-family: ${PDF_CANELA_STACK};
      font-size: 22pt;
      font-weight: 700;
      margin: 0 0 6px;
    }
    .book-author { font-size: 13pt; color: #444; margin: 0 0 8px; }
    .book-meta { font-size: 10pt; color: #666; margin: 0 0 28px; }
    .report {
      margin-top: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .report-break { page-break-before: always; }
    .report h2,
    .report h3 {
      font-family: ${PDF_CANELA_STACK};
    }
    h2 { font-size: 15pt; margin: 0 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
    h3 { font-size: 12pt; margin: 12px 0 5px; }
    .report .meta {
      font-family: ${PDF_CANELA_STACK};
      font-size: 9.5pt;
      color: #555;
      margin: 0 0 10px;
    }
    .report .meta .meta-chapter {
      font-weight: 700;
    }
    .report .body,
    .report li,
    .report .quote,
    .report .muted,
    .report .keywords-wrap {
      font-family: ${PDF_CANELA_STACK};
    }
    .report .keywords-block h3 {
      margin: 8px 0 2px;
      break-after: avoid;
    }
    .report .keywords-wrap {
      font-size: 8pt;
      line-height: 1.18;
      margin: 0 0 4px;
      color: #222;
      column-count: 3;
      column-gap: 10px;
      column-fill: balance;
      orphans: 2;
      widows: 2;
    }
    .report ul.vocab-list {
      margin: 2px 0 6px;
      padding-left: 14px;
    }
    .report ul.vocab-list li {
      margin-bottom: 2px;
      font-size: 9.5pt;
      line-height: 1.28;
    }
    .body { margin: 0 0 7px; }
    ul { margin: 4px 0 8px; padding-left: 18px; }
    li { margin-bottom: 4px; }
    .quote {
      margin: 8px 0 12px;
      padding-left: 12px;
      border-left: 3px solid #333;
      font-style: italic;
      color: #222;
    }
    .muted { color: #777; font-size: 10pt; }
  </style>
</head>
<body>
  <h1 class="book-title">${title}</h1>
  <p class="book-author">${author}</p>
  <p class="book-meta">${opts.metaHtml}</p>
  ${opts.contentHtml}
</body>
</html>`;
}

function buildReportSectionsHtml(
  item: ScanItem,
  content: PdfExportContentOptions = DEFAULT_PDF_EXPORT_CONTENT
): string {
  const extractionModes = getExtractionModes(item.extractionMode, item.extractionModes);
  const showEverything = extractionModes.includes("everything");
  const showSummary = showEverything && content.includeSummary;
  const showMainIdeas = showEverything || extractionModes.includes("bulletPoints");
  const showDetailedNotes = showEverything;
  const showQuotes = (showEverything || extractionModes.includes("quotes")) && content.includeQuotes;
  const showKeywords = showEverything || extractionModes.includes("words");
  const showVocabularyDefinitions = !showEverything && extractionModes.includes("words");

  const parts: string[] = [];

  if (showSummary && item.notes.summary.trim()) {
    parts.push(`<h3>Summary</h3><p class="body">${plainToHtml(item.notes.summary)}</p>`);
  }

  if (showMainIdeas) {
    parts.push("<h3>Bullet points</h3>");
    if (item.notes.mainIdeas.length > 0) {
      parts.push(
        "<ul>" +
          item.notes.mainIdeas
            .map((idea) => `<li class="body">${plainToHtml(idea)}</li>`)
            .join("") +
          "</ul>",
      );
    } else {
      parts.push('<p class="muted">No bullet points for this page.</p>');
    }
  }

  if (showEverything && item.notes.sectionHeadings && item.notes.sectionHeadings.length > 0) {
    parts.push("<h3>Section headings</h3><ul>");
    for (const h of item.notes.sectionHeadings) {
      parts.push(`<li class="body">${plainToHtml(h)}</li>`);
    }
    parts.push("</ul>");
  }

  if (showDetailedNotes && item.notes.detailedNotes.trim()) {
    parts.push(`<h3>Detailed notes</h3><p class="body">${plainToHtml(item.notes.detailedNotes)}</p>`);
  }

  if (showQuotes) {
    parts.push("<h3>Quotes</h3>");
    const quotes = item.notes.quotes ?? [];
    if (quotes.length > 0) {
      for (const q of quotes) {
        parts.push(`<blockquote class="quote">${plainToHtml(q)}</blockquote>`);
      }
    } else {
      parts.push('<p class="muted">No quotes extracted.</p>');
    }
  }

  if (showKeywords) {
    const sectionLabel = showEverything ? "Keywords" : "Words";
    parts.push(`<div class="keywords-block"><h3>${escapeHtml(sectionLabel)}</h3>`);
    if (showVocabularyDefinitions && item.notes.vocabularyTerms && item.notes.vocabularyTerms.length > 0) {
      parts.push('<ul class="vocab-list">');
      for (const term of item.notes.vocabularyTerms) {
        parts.push(
          `<li class="body"><strong>${escapeHtml(stripMarkdownBoldMarkers(term.word))}</strong> — ${plainToHtml(term.definition)}</li>`,
        );
      }
      parts.push("</ul>");
    } else if (item.notes.keywords.length > 0) {
      const maxKeywordsInPdf = 96;
      const kws = item.notes.keywords;
      const shown = kws.slice(0, maxKeywordsInPdf);
      const extra = kws.length - shown.length;
      const body = shown.map((k) => plainToHtml(k)).join(", ");
      const suffix =
        extra > 0 ? ` <span class="muted">(+${extra} more)</span>` : "";
      parts.push(`<div class="keywords-wrap">${body}${suffix}</div>`);
    } else {
      parts.push(`<p class="muted">No ${sectionLabel.toLowerCase()} extracted.</p>`);
    }
    parts.push("</div>");
  }

  if (item.reinforcedIdeas && item.reinforcedIdeas.length > 0) {
    parts.push("<h3>Reinforced ideas</h3><ul>");
    for (const m of item.reinforcedIdeas) {
      const line = m.matchedPage
        ? `${stripMarkdownBoldMarkers(m.idea)} (also seen on page ${m.matchedPage})`
        : stripMarkdownBoldMarkers(m.idea);
      parts.push(`<li class="body">${plainToHtml(line)}</li>`);
    }
    parts.push("</ul>");
  }

  return parts.join("\n");
}

export async function buildBookReportsPdfHtml(
  book: BookItem,
  reports: ScanItem[],
  content: PdfExportContentOptions = DEFAULT_PDF_EXPORT_CONTENT
): Promise<string> {
  const fontFaceCss = await getPdfCanelaFontFaceCss();
  const ordered = sortedReportsForPdf(reports);
  const generated = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  const reportBlocks = ordered.map((item, index) => {
    const created = new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const pageBreak = index > 0 ? " report-break" : "";

    return `
      <section class="report${pageBreak}">
        <h2>Report ${index + 1}</h2>
        <p class="meta">${buildReportMetaLineHtml(item, created, content.includePageNumbers)}</p>
        ${buildReportSectionsHtml(item, content)}
      </section>
    `;
  });

  return buildPdfHtmlWrapper({
    fontFaceCss,
    bookTitle: book.title,
    bookAuthor: book.author || "Unknown author",
    metaHtml: `Exported ${escapeHtml(generated)} · ${ordered.length} report${ordered.length === 1 ? "" : "s"}`,
    contentHtml: reportBlocks.join("\n"),
  });
}

export async function buildSingleReportPdfHtml(
  item: ScanItem,
  book?: Pick<BookItem, "title" | "author"> | null,
  content: PdfExportContentOptions = DEFAULT_PDF_EXPORT_CONTENT
): Promise<string> {
  const fontFaceCss = await getPdfCanelaFontFaceCss();
  const bookTitle = book?.title ?? item.book?.trim() ?? "Reading notes";
  const bookAuthor = book?.author ?? "Unknown author";
  const generated = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const created = new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const section = `
      <section class="report">
        <h2>Report</h2>
        <p class="meta">${buildReportMetaLineHtml(item, created, content.includePageNumbers)}</p>
        ${buildReportSectionsHtml(item, content)}
      </section>
    `;

  return buildPdfHtmlWrapper({
    fontFaceCss,
    bookTitle,
    bookAuthor,
    metaHtml: `Exported ${escapeHtml(generated)} · 1 report`,
    contentHtml: section,
  });
}

export function sanitizeFileBase(title: string): string {
  const trimmed = stripMarkdownBoldMarkers(title).trim().slice(0, 80);
  const safe = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ");
  return safe || "Book-reports";
}

export async function createAllBookReportsPdf(
  book: BookItem,
  reports: ScanItem[],
  content: PdfExportContentOptions = DEFAULT_PDF_EXPORT_CONTENT
): Promise<string> {
  const html = await buildBookReportsPdfHtml(book, reports, content);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function createSingleReportPdf(
  item: ScanItem,
  book?: Pick<BookItem, "title" | "author"> | null,
  content: PdfExportContentOptions = DEFAULT_PDF_EXPORT_CONTENT
): Promise<string> {
  const html = await buildSingleReportPdfHtml(item, book, content);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function sharePdfUri(uri: string, dialogTitle: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle,
    UTI: "com.adobe.pdf",
  });
}

/**
 * Renders all book reports to one PDF and opens the system share sheet (save to Files, AirDrop, etc.).
 */
export async function shareAllBookReportsPdf(
  book: BookItem,
  reports: ScanItem[],
  content: PdfExportContentOptions = DEFAULT_PDF_EXPORT_CONTENT
): Promise<void> {
  const uri = await createAllBookReportsPdf(book, reports, content);
  await sharePdfUri(uri, `Export ${sanitizeFileBase(book.title)}`);
}

export function singleReportShareLabel(item: ScanItem, book?: Pick<BookItem, "title" | "author"> | null): string {
  const base = book?.title ?? item.book?.trim() ?? "Report";
  const page = item.page?.trim();
  return page ? `${base} p${page}` : base;
}

/**
 * Renders one scan report to a PDF and opens the system share sheet.
 */
export async function shareSingleReportPdf(
  item: ScanItem,
  book?: Pick<BookItem, "title" | "author"> | null,
  content: PdfExportContentOptions = DEFAULT_PDF_EXPORT_CONTENT
): Promise<void> {
  const uri = await createSingleReportPdf(item, book, content);
  await sharePdfUri(uri, `Export ${sanitizeFileBase(singleReportShareLabel(item, book))}`);
}

