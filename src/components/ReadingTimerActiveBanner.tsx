import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { getActiveElapsedSeconds, useReadingSession } from "../context/ReadingSessionContext";
import { useScanContext } from "../context/ScanContext";
import { formatReadingTimerHMS, READING_TIMER_FONT_FAMILY } from "../reading/readingTimerDisplay";
import { averageBookPacePerHour, getEstimate } from "../reading/readingTimerRunningStats";
import { estimateBookPageTotal, parseScanPageNumber } from "../utils/bookReadingProgress";

const FADE_MS = 220;
const EASE = Easing.out(Easing.cubic);
const TIMER_ACCENT = "#f59e0b";

type Props = {
  darkMode: boolean;
  onPress: () => void;
};

export function ReadingTimerActiveBanner({ darkMode, onPress }: Props) {
  const { run, sessions } = useReadingSession();
  const { books, activeBook } = useScanContext();
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const runSnapshotRef = useRef(run);

  const isLive = run?.phase === "running" || run?.phase === "paused";

  useEffect(() => {
    if (run && (run.phase === "running" || run.phase === "paused")) {
      runSnapshotRef.current = run;
    }
  }, [run]);

  useEffect(() => {
    if (run?.phase !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [run?.phase]);

  useEffect(() => {
    if (isLive) {
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        easing: EASE,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!visible) return;

    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [isLive, visible, opacity]);

  const displayRun = run ?? runSnapshotRef.current;
  const elapsedSeconds = useMemo(() => getActiveElapsedSeconds(displayRun), [displayRun, tick]);

  const resolvedRunBook = useMemo(() => {
    if (!displayRun) return null;
    if (displayRun.bookId) return books.find((b) => b.id === displayRun.bookId) ?? null;
    if (activeBook && !activeBook.isRead) return activeBook;
    return null;
  }, [displayRun, books, activeBook]);

  const totalPages = useMemo(
    () => (resolvedRunBook ? estimateBookPageTotal(resolvedRunBook) : null),
    [resolvedRunBook]
  );

  const sessionMinutes = elapsedSeconds / 60;
  const currentPageNum = displayRun ? parseScanPageNumber(displayRun.startPage) : null;
  const paceBookId = displayRun?.bookId ?? resolvedRunBook?.id ?? null;

  const pacePerHour = useMemo(
    () => averageBookPacePerHour(sessions, paceBookId),
    [sessions, paceBookId]
  );

  const pagesRemaining = useMemo(() => {
    if (totalPages == null || totalPages <= 0 || currentPageNum == null) return null;
    return Math.max(0, totalPages - currentPageNum);
  }, [totalPages, currentPageNum]);

  const finishEstimate = useMemo(
    () => getEstimate(pagesRemaining, pacePerHour, sessionMinutes),
    [pagesRemaining, pacePerHour, sessionMinutes]
  );

  const showMotivation =
    finishEstimate != null && totalPages != null && sessionMinutes >= 2;

  if (!visible || !displayRun) return null;

  const metaLine = displayRun.phase === "paused" ? "Paused" : null;

  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.banner,
          darkMode ? styles.bannerDark : styles.bannerLight,
          pressed && styles.bannerPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Reading timer ${formatReadingTimerHMS(elapsedSeconds)}, page ${displayRun.startPage}${showMotivation && finishEstimate ? `, ${finishEstimate}` : ""}. Tap to open.`}
      >
        <View style={styles.bannerTopRow}>
          <View style={styles.timerCol}>
            <Ionicons
              name={displayRun.phase === "paused" ? "pause" : "timer-outline"}
              size={18}
              color={displayRun.phase === "paused" ? (darkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.45)") : TIMER_ACCENT}
            />
            <Text style={[styles.timerText, darkMode && styles.timerTextDark]} numberOfLines={1}>
              {formatReadingTimerHMS(elapsedSeconds)}
            </Text>
          </View>

          {metaLine ? (
            <Text style={[styles.metaText, darkMode && styles.metaTextDark]} numberOfLines={2}>
              {metaLine}
            </Text>
          ) : (
            <View style={styles.metaSpacer} />
          )}

          <View style={styles.trailingCol}>
            <Text style={[styles.pageText, darkMode && styles.pageTextDark]} numberOfLines={1}>
              p. {displayRun.startPage}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={darkMode ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.28)"}
            />
          </View>
        </View>

        {showMotivation && finishEstimate ? (
          <View style={styles.motivationRow}>
            <View style={styles.motivationDot} />
            <Text
              style={[styles.motivationText, darkMode && styles.motivationTextDark]}
              numberOfLines={2}
            >
              {finishEstimate}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "column",
    gap: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: "100%",
  },
  bannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  bannerDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  bannerLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.08)",
  },
  bannerPressed: {
    opacity: 0.88,
  },
  timerCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  timerText: {
    fontFamily: READING_TIMER_FONT_FAMILY,
    fontSize: 26,
    fontWeight: "600",
    color: "#0f172a",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  timerTextDark: {
    color: "#ffffff",
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    color: "rgba(15,23,42,0.55)",
  },
  metaSpacer: {
    flex: 1,
    minWidth: 0,
  },
  metaTextDark: {
    color: "rgba(255,255,255,0.45)",
  },
  trailingCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  pageText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(15,23,42,0.45)",
  },
  pageTextDark: {
    color: "rgba(255,255,255,0.4)",
  },
  motivationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
    paddingTop: 2,
  },
  motivationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: TIMER_ACCENT,
    marginTop: 4,
    flexShrink: 0,
  },
  motivationText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    color: "rgba(15,23,42,0.5)",
  },
  motivationTextDark: {
    color: "rgba(255,255,255,0.42)",
  },
});
