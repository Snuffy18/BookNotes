import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettings } from "../context/AppSettingsContext";
import { darkColors, lightColors } from "../theme/colors";
import { sharePdfUri } from "../utils/bookReportsPdf";
import { playSoundEffect } from "../utils/soundEffects";

export type PdfExportToastMode =
  | "loading"
  | {
      type: "ready";
      uri: string;
    };

type Props = {
  mode: PdfExportToastMode | null;
  shareDialogTitle: string;
  onDismissComplete: () => void;
};

/** Tab bar: bottom 24 + height 56; pill sits 16px above that chrome. */
const TAB_BAR_BOTTOM_MARGIN = 24;
const TAB_BAR_HEIGHT = 56;
const PILL_GAP_ABOVE_TAB = 16;

const READY_GREEN = "#16a34a";

export function PdfExportToast({ mode, shareDialogTitle, onDismissComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { darkMode, accentColor } = useAppSettings();

  const readyPillSurface = darkMode
    ? { backgroundColor: darkColors.card, borderColor: "rgba(255,255,255,0.14)" as const }
    : {
        backgroundColor: lightColors.chipBg,
        borderColor: lightColors.borderStrong,
      };
  const readyTitleColor = darkMode ? darkColors.textPrimary : lightColors.textPrimary;
  const readyDividerColor = darkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)";

  const bottomInset = useMemo(
    () => insets.bottom + TAB_BAR_BOTTOM_MARGIN + TAB_BAR_HEIGHT + PILL_GAP_ABOVE_TAB,
    [insets.bottom],
  );

  const [shouldShow, setShouldShow] = useState(false);

  const readyOpacity = useRef(new Animated.Value(0)).current;
  const readyY = useRef(new Animated.Value(56)).current;

  const prevModeRef = useRef<PdfExportToastMode | null>(null);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitingRef = useRef(false);

  const clearAutoDismiss = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  const runExitAnimation = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    clearAutoDismiss();
    Animated.parallel([
      Animated.timing(readyOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(readyY, {
        toValue: 56,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        exitingRef.current = false;
        setShouldShow(false);
        onDismissComplete();
      }
    });
  }, [clearAutoDismiss, onDismissComplete, readyOpacity, readyY]);

  useLayoutEffect(() => {
    const isReady = mode !== null && typeof mode === "object" && mode.type === "ready";
    if (isReady) {
      setShouldShow(true);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === null && shouldShow && !exitingRef.current) {
      runExitAnimation();
    }
  }, [mode, shouldShow, runExitAnimation]);

  useEffect(() => {
    if (mode === null) {
      prevModeRef.current = null;
      return;
    }

    const wasLoading = prevModeRef.current === "loading";
    const isLoading = mode === "loading";
    const isReady = typeof mode === "object" && mode.type === "ready";

    if (isLoading) {
      prevModeRef.current = mode;
      return;
    }

    if (isReady && (wasLoading || prevModeRef.current === null)) {
      if (wasLoading) {
        playSoundEffect("pdfExtracted");
      }
      readyY.setValue(56);
      readyOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(readyY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 118,
          friction: 14,
        }),
        Animated.timing(readyOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    prevModeRef.current = mode;

    if (isReady) {
      clearAutoDismiss();
      autoDismissTimerRef.current = setTimeout(() => {
        autoDismissTimerRef.current = null;
        runExitAnimation();
      }, 5000);
    }

    return () => {
      clearAutoDismiss();
    };
  }, [mode, clearAutoDismiss, readyOpacity, readyY, runExitAnimation]);

  const onPressReady = useCallback(() => {
    if (mode === null || mode === "loading") return;
    const { uri } = mode;
    clearAutoDismiss();
    runExitAnimation();
    void sharePdfUri(uri, shareDialogTitle).catch(() => {});
  }, [clearAutoDismiss, mode, runExitAnimation, shareDialogTitle]);

  if (mode === "loading") {
    return null;
  }

  if (!shouldShow && mode === null) {
    return null;
  }

  const isReady = mode !== null && typeof mode === "object" && mode.type === "ready";

  return (
    <View pointerEvents="box-none" style={styles.overlayRoot}>
      <Animated.View
        pointerEvents={isReady ? "box-none" : "none"}
        style={[
          styles.floatingSlot,
          { bottom: bottomInset, opacity: readyOpacity, transform: [{ translateY: readyY }] },
        ]}
      >
        <Pressable
          onPress={onPressReady}
          style={({ pressed }) => [
            styles.readyPill,
            readyPillSurface,
            pressed && styles.readyPillPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Share PDF"
        >
          <View style={styles.readyRow}>
            <Ionicons name="checkmark" size={16} color={READY_GREEN} />
            <Text style={[styles.readyTitleText, { color: readyTitleColor }]}>PDF ready</Text>
            <View style={[styles.readyDivider, { backgroundColor: readyDividerColor }]} />
            <Ionicons name="share-outline" size={16} color={accentColor} />
            <Text style={[styles.shareActionText, { color: accentColor }]}>Share</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    pointerEvents: "box-none",
  },
  floatingSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  readyPill: {
    borderRadius: 40,
    paddingVertical: 14,
    paddingHorizontal: 20,
    maxWidth: "92%",
    borderWidth: 1,
  },
  readyPillPressed: {
    opacity: 0.92,
  },
  readyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  readyTitleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  readyDivider: {
    width: 1,
    height: 16,
  },
  shareActionText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
