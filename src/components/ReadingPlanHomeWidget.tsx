import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useScanContext } from "../context/ScanContext";
import { useReadingSession } from "../context/ReadingSessionContext";
import { useReadingPlan } from "../context/ReadingPlanContext";
import { hexWithAlpha } from "../theme/colorUtils";
import {
  computeReadingPlanProgress,
  detectCurrentPage,
  formatPlanTargetDate,
  type ReadingPlanStatus,
} from "../utils/readingPlanProgress";

const STATUS_META: Record<ReadingPlanStatus, { label: string; color: string }> = {
  onTrack: { label: "On track", color: "#22c55e" },
  behind: { label: "Behind", color: "#f59e0b" },
  overdue: { label: "Overdue", color: "#ef4444" },
  done: { label: "Finished", color: "#22c55e" },
};

type Props = {
  darkMode: boolean;
  accentColor: string;
  onPress: () => void;
};

export function ReadingPlanHomeWidget({ darkMode, accentColor, onPress }: Props) {
  const { books, activeBookId, scans } = useScanContext();
  const { sessions } = useReadingSession();
  const { getPlanForBook } = useReadingPlan();

  const book = useMemo(() => {
    const active = activeBookId ? books.find((b) => b.id === activeBookId) : null;
    return active ?? books[0] ?? null;
  }, [books, activeBookId]);

  const plan = useMemo(() => getPlanForBook(book?.id), [getPlanForBook, book?.id]);

  const progress = useMemo(() => {
    if (!plan || !book) return null;
    const currentPage = detectCurrentPage(book.id, scans, sessions, plan.startPage);
    return computeReadingPlanProgress(plan, book, currentPage);
  }, [plan, book, scans, sessions]);

  const watermarkColor = hexWithAlpha(accentColor, darkMode ? 0.08 : 0.12);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        !darkMode && styles.tileLight,
        pressed && styles.tilePressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        plan && progress
          ? `Reading goal for ${book?.title}, ${progress.percent} percent done`
          : "Set a reading goal"
      }
    >
      <View style={styles.inner}>
        <Ionicons
          name="flag-outline"
          size={84}
          color={watermarkColor}
          style={styles.watermark}
          pointerEvents="none"
          importantForAccessibility="no"
        />
        {plan && progress && book ? (
          <View style={styles.foreground}>
            <View style={styles.headerRow}>
              <Text style={[styles.kicker, !darkMode && styles.kickerLight]}>READING GOAL</Text>
              <View style={styles.statusChip}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_META[progress.status].color }]} />
                <Text style={[styles.statusText, { color: STATUS_META[progress.status].color }]}>
                  {STATUS_META[progress.status].label}
                </Text>
              </View>
            </View>

            <Text style={[styles.bookTitle, !darkMode && styles.bookTitleLight]} numberOfLines={1}>
              {book.title}
            </Text>

            <View style={[styles.progressTrack, !darkMode && styles.progressTrackLight]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(2, progress.percent)}%`, backgroundColor: accentColor },
                ]}
              />
            </View>

            <View style={styles.metaRow}>
              <Text style={[styles.metaPrimary, !darkMode && styles.metaPrimaryLight]}>
                {progress.totalPages != null
                  ? `Page ${progress.currentPage} of ${progress.totalPages}`
                  : `${progress.percent}% complete`}
              </Text>
              <Text style={[styles.metaSecondary, !darkMode && styles.metaSecondaryLight]} numberOfLines={1}>
                {progress.status === "done"
                  ? `Done · ${formatPlanTargetDate(plan.targetFinishDate)}`
                  : progress.pagesPerDay > 0
                    ? `${progress.pagesPerDay}/day · by ${formatPlanTargetDate(plan.targetFinishDate)}`
                    : `by ${formatPlanTargetDate(plan.targetFinishDate)}`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyForeground}>
            <View style={[styles.emptyIconWrap, { backgroundColor: hexWithAlpha(accentColor, darkMode ? 0.16 : 0.12) }]}>
              <Ionicons name="flag" size={18} color={accentColor} />
            </View>
            <View style={styles.emptyTextCol}>
              <Text style={[styles.emptyTitle, !darkMode && styles.emptyTitleLight]}>Set a reading goal</Text>
              <Text style={[styles.emptySubtitle, !darkMode && styles.emptySubtitleLight]}>
                Plan to finish a book by a date
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginTop: 14,
    width: "100%",
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  tileLight: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(15,23,42,0.06)",
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tilePressed: {
    opacity: 0.92,
  },
  inner: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 18,
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
  },
  watermark: {
    position: "absolute",
    bottom: -10,
    right: -8,
    zIndex: 0,
  },
  foreground: {
    zIndex: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.4)",
  },
  kickerLight: {
    color: "rgba(15,23,42,0.4)",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  bookTitleLight: {
    color: "#0f172a",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressTrackLight: {
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metaPrimary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  metaPrimaryLight: {
    color: "#0f172a",
  },
  metaSecondary: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    textAlign: "right",
  },
  metaSecondaryLight: {
    color: "rgba(15,23,42,0.5)",
  },
  emptyForeground: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  emptyTitleLight: {
    color: "#0f172a",
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
  },
  emptySubtitleLight: {
    color: "rgba(15,23,42,0.5)",
  },
});
