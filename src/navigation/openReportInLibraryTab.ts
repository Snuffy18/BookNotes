import type { NavigationProp } from "@react-navigation/native";
import type { ScanItem } from "../types/note";
import type { RootTabParamList } from "./types";

/**
 * Opens a report in the Library tab (book list, then report) so the user gets the same
 * Report details experience as from the library. Requires `item.bookId`.
 */
export function openReportInLibraryTab(
  tabNav: NavigationProp<RootTabParamList> | undefined,
  item: ScanItem,
  options?: { highlightQuery?: string; reportNavOrigin?: "library" | "scan" }
): boolean {
  const bookId = item.bookId?.trim();
  if (!tabNav || !bookId) return false;

  tabNav.navigate("Library", {
    screen: "BookReports",
    params: { bookId },
  });
  queueMicrotask(() => {
    tabNav.navigate("Library", {
      screen: "ReportDetails",
      params: {
        item,
        reportNavOrigin: options?.reportNavOrigin ?? "library",
        ...(options?.highlightQuery ? { highlightQuery: options.highlightQuery } : {}),
      },
    });
  });
  return true;
}
