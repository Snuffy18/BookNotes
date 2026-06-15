import { CommonActions, type NavigationProp } from "@react-navigation/native";
import type { ScanItem } from "../types/note";
import type { LibraryStackParamList, RootTabParamList } from "./types";

/**
 * Opens a report in the Library tab (book list → book reports → report details) so the user
 * gets the same Report details experience as from the library. Requires `item.bookId`.
 */
export function openReportInLibraryTab(
  tabNav: NavigationProp<RootTabParamList> | undefined,
  item: ScanItem,
  options?: { highlightQuery?: string; reportNavOrigin?: "library" | "scan" }
): boolean {
  const bookId = item.bookId?.trim();
  if (!tabNav || !bookId) return false;

  const reportParams: LibraryStackParamList["ReportDetails"] = {
    item,
    reportNavOrigin: options?.reportNavOrigin ?? "library",
    ...(options?.highlightQuery ? { highlightQuery: options.highlightQuery } : {}),
  };

  const tabState = tabNav.getState();
  const libraryTabIndex = tabState.routes.findIndex((route) => route.name === "Library");
  const activeTabIndex = libraryTabIndex >= 0 ? libraryTabIndex : tabState.index;

  const routes = tabState.routes.map((route) => {
    if (route.name !== "Library") return route;
    return {
      ...route,
      state: {
        routes: [
          { name: "LibraryHome" as const },
          { name: "BookReports" as const, params: { bookId } },
          { name: "ReportDetails" as const, params: reportParams },
        ],
        index: 2,
      },
    };
  });

  tabNav.dispatch(
    CommonActions.reset({
      ...tabState,
      index: activeTabIndex,
      routes,
    })
  );

  return true;
}
