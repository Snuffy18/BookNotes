import { CommonActions, type NavigationProp } from "@react-navigation/native";
import type { RootTabParamList } from "./types";

/** Switches to Home and clears the Library stack so Book Reports is not left underneath. */
export function navigateToScanHomeResettingLibrary(
  tabNav: NavigationProp<RootTabParamList> | undefined
): void {
  if (!tabNav) return;

  const tabState = tabNav.getState();
  const scanTabIndex = tabState.routes.findIndex((route) => route.name === "ScanFlow");
  const activeIndex = scanTabIndex >= 0 ? scanTabIndex : tabState.index;

  const routes = tabState.routes.map((route) => {
    if (route.name !== "Library") return route;
    return {
      ...route,
      state: {
        routes: [{ name: "LibraryHome" as const }],
        index: 0,
      },
    };
  });

  tabNav.dispatch(
    CommonActions.reset({
      ...tabState,
      index: activeIndex,
      routes,
    })
  );
}
