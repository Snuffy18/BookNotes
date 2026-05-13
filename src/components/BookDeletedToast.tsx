import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettings } from "../context/AppSettingsContext";
import { darkColors, lightColors } from "../theme/colors";

const TAB_BAR_BOTTOM_MARGIN = 24;
const TAB_BAR_HEIGHT = 56;
const PILL_GAP_ABOVE_TAB = 16;
const DELETE_RED = "#ef4444";
const VISIBLE_MS = 2400;

type Props = {
  showCount: number;
};

export function BookDeletedToast({ showCount }: Props) {
  const insets = useSafeAreaInsets();
  const { darkMode } = useAppSettings();
  const [mounted, setMounted] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(48)).current;
  const prevCountRef = useRef(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissingRef = useRef(false);

  const bottomInset =
    insets.bottom + TAB_BAR_BOTTOM_MARGIN + TAB_BAR_HEIGHT + PILL_GAP_ABOVE_TAB;

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const runExitAnimation = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    clearDismissTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 48,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        dismissingRef.current = false;
        setMounted(false);
      }
    });
  }, [clearDismissTimer, opacity, translateY]);

  useEffect(() => {
    if (showCount <= prevCountRef.current) return;
    prevCountRef.current = showCount;
    dismissingRef.current = false;
    clearDismissTimer();
    setMounted(true);
    translateY.setValue(48);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 118,
        friction: 14,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      runExitAnimation();
    }, VISIBLE_MS);
    return clearDismissTimer;
  }, [showCount, clearDismissTimer, opacity, translateY, runExitAnimation]);

  if (!mounted) return null;

  const pillSurface = darkMode
    ? { backgroundColor: darkColors.card, borderColor: "rgba(255,255,255,0.14)" }
    : { backgroundColor: lightColors.chipBg, borderColor: lightColors.borderStrong };
  const titleColor = darkMode ? darkColors.textPrimary : lightColors.textPrimary;

  return (
    <View pointerEvents="none" style={styles.overlayRoot}>
      <Animated.View
        style={[
          styles.floatingSlot,
          { bottom: bottomInset, opacity, transform: [{ translateY }] },
        ]}
      >
        <View style={[styles.pill, pillSurface]} accessibilityRole="text" accessibilityLabel="Deleted successfully">
          <Ionicons name="trash" size={18} color={DELETE_RED} />
          <Text style={[styles.label, { color: titleColor }]}>Deleted Successfully</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
  },
  floatingSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
