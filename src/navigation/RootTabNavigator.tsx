import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LibraryStackNavigator } from "./LibraryStackNavigator";
import { ProfileStackNavigator } from "./ProfileStackNavigator";
import { ScanStackNavigator } from "./ScanStackNavigator";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

const PILL_BG = "#252525";
const PILL_BORDER = "rgba(255,255,255,0.1)";
const HIGHLIGHT_BG = "rgba(255,255,255,0.1)";
const ICON_ACTIVE = "#ffffff";
const ICON_INACTIVE = "rgba(255,255,255,0.6)";
const LABEL_COLOR = "#ffffff";
const ICON_SIZE = 20;

const TAB_GAP = 0;
const PILL_PAD_V = 4;
const PILL_PAD_H = 6;
/** Inner “pill” behind icon + label; large enough to read as a capsule on the cluster height. */
const HIGHLIGHT_RADIUS = 26;
const PILL_RADIUS = 40;
const MOVE_MS = 200;
const LABEL_MS = 150;

const TABS = [
  { routeName: "ScanFlow" as const, label: "Home", icon: "scan-outline" as const },
  { routeName: "Library" as const, label: "Library", icon: "library-outline" as const },
  { routeName: "Profile" as const, label: "Profile", icon: "person-outline" as const },
];

function getDeepestRouteName(route: { state?: unknown; name?: string } | undefined): string | null {
  let current: any = route;
  while (current?.state?.routes && typeof current.state.index === "number") {
    current = current.state.routes[current.state.index];
  }
  return (current?.name as string | undefined) ?? null;
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [tabLayouts, setTabLayouts] = useState<
    { x: number; width: number; height: number }[] | null
  >(null);
  const [trackSize, setTrackSize] = useState<{ width: number; height: number }>({ width: 0, height: 44 });
  /** Measured icon+label cluster for the tab at `index` (only valid when that tab is active). */
  const [activeCluster, setActiveCluster] = useState<{ index: number; width: number; height: number } | null>(
    null
  );

  const activeIndex = state.index;
  const prevActiveIndexRef = useRef(activeIndex);
  const hasCompletedInitialHighlightRef = useRef(false);

  const highlightX = useRef(new Animated.Value(0)).current;
  const highlightY = useRef(new Animated.Value(0)).current;
  const highlightW = useRef(new Animated.Value(0)).current;
  const highlightH = useRef(new Animated.Value(44)).current;

  /** Fade-in for the active tab label only (inactive tabs show icon-only → narrower pill). */
  const activeLabelOpacity = useRef(new Animated.Value(1)).current;
  const skipLabelFadeOnMountRef = useRef(true);

  const activeRootRoute = state.routes[state.index];
  const activeNestedRouteName = getDeepestRouteName(activeRootRoute);

  const hidden =
    activeNestedRouteName === "ReportDetails" ||
    activeNestedRouteName === "CropPhoto" ||
    activeNestedRouteName === "ExtractionOptions" ||
    activeNestedRouteName === "Processing" ||
    activeNestedRouteName === "Results" ||
    activeNestedRouteName === "StreakDetails" ||
    activeNestedRouteName === "ReadingHistory" ||
    activeNestedRouteName === "ExportSettings" ||
    activeNestedRouteName === "StudyPreferences" ||
    activeNestedRouteName === "AppBehavior" ||
    activeNestedRouteName === "Appearance" ||
    activeNestedRouteName === "Themes" ||
    activeNestedRouteName === "OutputLanguage" ||
    activeNestedRouteName === "ReadingReminders";

  const wasHiddenRef = useRef(hidden);

  const applyHighlight = useCallback(
    (index: number, layouts: { x: number; width: number; height: number }[], animated: boolean) => {
      const cell = layouts[index];
      if (!cell) return;
      const inner =
        activeCluster && activeCluster.index === index && activeCluster.width > 0 ? activeCluster : null;
      const innerW = inner ? inner.width : cell.width;
      const innerH = inner ? inner.height : Math.max(cell.height, 40);
      const targetX = cell.x + (cell.width - innerW) / 2;
      const trackH = trackSize.height > 0 ? trackSize.height : Math.max(cell.height, 44);
      const targetY = Math.max(0, (trackH - innerH) / 2);
      if (!animated) {
        highlightX.setValue(targetX);
        highlightY.setValue(targetY);
        highlightW.setValue(innerW);
        highlightH.setValue(innerH);
        return;
      }
      Animated.parallel([
        Animated.timing(highlightX, {
          toValue: targetX,
          duration: MOVE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(highlightY, {
          toValue: targetY,
          duration: MOVE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(highlightW, {
          toValue: innerW,
          duration: MOVE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(highlightH, {
          toValue: innerH,
          duration: MOVE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    },
    [activeCluster, highlightH, highlightW, highlightX, highlightY, trackSize.height]
  );

  useEffect(() => {
    if (wasHiddenRef.current && !hidden) {
      activeLabelOpacity.stopAnimation();
      activeLabelOpacity.setValue(1);
    }
    wasHiddenRef.current = hidden;
  }, [hidden, activeLabelOpacity]);

  useEffect(() => {
    if (hidden) return;
    if (skipLabelFadeOnMountRef.current) {
      skipLabelFadeOnMountRef.current = false;
      return;
    }
    activeLabelOpacity.setValue(0);
    Animated.timing(activeLabelOpacity, {
      toValue: 1,
      duration: LABEL_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, activeLabelOpacity, hidden]);

  useEffect(() => {
    setActiveCluster(null);
  }, [activeIndex]);

  useEffect(() => {
    if (!tabLayouts || tabLayouts.length !== TABS.length) return;
    if (tabLayouts.some((t) => t.width <= 0)) return;

    const indexChanged = prevActiveIndexRef.current !== activeIndex;
    if (!hasCompletedInitialHighlightRef.current) {
      hasCompletedInitialHighlightRef.current = true;
      applyHighlight(activeIndex, tabLayouts, false);
      activeLabelOpacity.setValue(1);
      prevActiveIndexRef.current = activeIndex;
      return;
    }

    if (indexChanged) {
      applyHighlight(activeIndex, tabLayouts, true);
      prevActiveIndexRef.current = activeIndex;
    } else {
      applyHighlight(activeIndex, tabLayouts, false);
    }
  }, [activeIndex, tabLayouts, applyHighlight, activeLabelOpacity, activeCluster, trackSize]);

  const onTabLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    const { x, width, height } = e.nativeEvent.layout;
    setTabLayouts((prev) => {
      const next = prev ? [...prev] : TABS.map(() => ({ x: 0, width: 0, height: 0 }));
      next[index] = { x, width, height };
      return next;
    });
  }, []);

  const triggerNavHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const navigateTo = useCallback(
    (routeName: keyof RootTabParamList) => {
      triggerNavHaptic();
      if (routeName === "Library") {
        navigation.navigate("Library", { screen: "LibraryHome" });
        return;
      }
      navigation.navigate(routeName);
    },
    [navigation, triggerNavHaptic]
  );

  if (hidden) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.screenOverlay, { paddingBottom: 24 + insets.bottom }]}
    >
      <View style={styles.pillOuter}>
        <View style={styles.pill}>
          <View style={styles.pillTrack}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.highlight,
                {
                  left: highlightX,
                  top: highlightY,
                  width: highlightW,
                  height: highlightH,
                },
              ]}
            />
            <View
              style={styles.tabRow}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setTrackSize((prev) =>
                  prev.width === width && prev.height === height ? prev : { width, height }
                );
              }}
            >
              {TABS.map((tab, i) => {
                const isActive = activeIndex === i;
                return (
                  <Pressable
                    key={tab.routeName}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={tab.label}
                    onLayout={(e) => onTabLayout(i, e)}
                    onPress={() => navigateTo(tab.routeName)}
                    style={({ pressed }) => [
                      styles.tabPressable,
                      !isActive && styles.tabPressableInactive,
                      pressed && styles.tabPressed,
                    ]}
                  >
                    {isActive ? (
                      <View
                        style={styles.activeCluster}
                        onLayout={(e) => {
                          const { width, height } = e.nativeEvent.layout;
                          setActiveCluster((prev) => {
                            const next = { index: i, width, height };
                            if (
                              prev &&
                              prev.index === next.index &&
                              prev.width === next.width &&
                              prev.height === next.height
                            ) {
                              return prev;
                            }
                            return next;
                          });
                        }}
                      >
                        <Ionicons
                          name={tab.icon}
                          size={ICON_SIZE}
                          color={ICON_ACTIVE}
                        />
                        <Animated.Text
                          pointerEvents="none"
                          style={[styles.tabLabel, { color: LABEL_COLOR, opacity: activeLabelOpacity }]}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </Animated.Text>
                      </View>
                    ) : (
                      <Ionicons
                        name={tab.icon}
                        size={ICON_SIZE}
                        color={ICON_INACTIVE}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function RootTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="ScanFlow" component={ScanStackNavigator} />
      <Tab.Screen name="Library" component={LibraryStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  screenOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pillOuter: {
    alignItems: "center",
  },
  pill: {
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: PILL_BG,
    borderWidth: 0.5,
    borderColor: PILL_BORDER,
    borderRadius: PILL_RADIUS,
    paddingVertical: PILL_PAD_V,
    paddingHorizontal: PILL_PAD_H,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  pillTrack: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  highlight: {
    position: "absolute",
    top: 0,
    borderRadius: HIGHLIGHT_RADIUS,
    backgroundColor: HIGHLIGHT_BG,
    zIndex: 0,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TAB_GAP,
    zIndex: 1,
  },
  tabPressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabPressableInactive: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabPressed: {
    opacity: 0.85,
  },
  activeCluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabLabel: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
