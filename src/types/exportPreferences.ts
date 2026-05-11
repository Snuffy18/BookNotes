export type ExportDefaultFormat = "pdf";

/** Reserved for future multi-book export; only one book is exported from Book reports today. */
export type ExportScopeId = "allBooks";

export const EXPORT_SCOPE_LABELS: Record<ExportScopeId, string> = {
  allBooks: "All books",
};

export type ExportPreferencesSnapshot = {
  defaultFormat: ExportDefaultFormat;
  includeQuotes: boolean;
  includeSummary: boolean;
  includePageNumbers: boolean;
  exportScope: ExportScopeId;
  notionConnected: boolean;
  autoExportAfterScan: boolean;
};

export const DEFAULT_EXPORT_PREFERENCES: ExportPreferencesSnapshot = {
  defaultFormat: "pdf",
  includeQuotes: true,
  includeSummary: true,
  includePageNumbers: true,
  exportScope: "allBooks",
  notionConnected: false,
  autoExportAfterScan: false,
};

/** Subset passed into PDF HTML builders. */
export type PdfExportContentOptions = {
  includeQuotes: boolean;
  includeSummary: boolean;
  includePageNumbers: boolean;
};

export const DEFAULT_PDF_EXPORT_CONTENT: PdfExportContentOptions = {
  includeQuotes: true,
  includeSummary: true,
  includePageNumbers: true,
};

export function pdfContentOptionsFromPrefs(
  prefs: Pick<ExportPreferencesSnapshot, "includeQuotes" | "includeSummary" | "includePageNumbers">
): PdfExportContentOptions {
  return {
    includeQuotes: prefs.includeQuotes,
    includeSummary: prefs.includeSummary,
    includePageNumbers: prefs.includePageNumbers,
  };
}
