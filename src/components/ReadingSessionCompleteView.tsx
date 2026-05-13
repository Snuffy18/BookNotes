import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useStreak } from "../context/StreakContext";
import { pagesInReadingSession, sessionPacePerHour } from "../reading/readingHistoryStats";
import type { ReadingSession } from "../types/note";
import { parseScanPageNumber } from "../utils/bookReadingProgress";

const GREEN = "#4ade80";
const GREEN_BG = "rgba(74,222,128,0.1)";
const GREEN_BORDER = "rgba(74,222,128,0.25)";
const BLUE = "#60a5fa";
const BLUE_BG = "rgba(96,165,250,0.12)";
const BLUE_BORDER = "rgba(96,165,250,0.25)";
const AMBER = "#fbbf24";
const AMBER_BG = "rgba(251,191,36,0.06)";
const AMBER_BORDER = "rgba(251,191,36,0.25)";
const PURPLE = "#a855f7";
const CARD_BG = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const MUTED_30 = "rgba(255,255,255,0.3)";
const MUTED_35 = "rgba(255,255,255,0.35)";
const MUTED_40 = "rgba(255,255,255,0.4)";
const MUTED_60 = "rgba(255,255,255,0.6)";
const BAR_BG = "rgba(255,255,255,0.08)";
const PRIMARY_TEXT = "#111111";

type Props = {
  session: ReadingSession;
  totalPages: number | null;
  author: string | null;
  onDone: () => void;
  /** When true, content sits at the bottom when shorter than the screen (full-screen log view). */
  anchorContentToBottom?: boolean;
};

function formatElapsedHMS(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatEndedSubtitle(iso: string, authorLine: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const timePart = isToday ? `Today at ${timeStr}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${timeStr}`;
  return authorLine ? `${authorLine} · ${timePart}` : timePart;
}

export function ReadingSessionCompleteView({
  session,
  totalPages,
  author,
  onDone,
  anchorContentToBottom = false,
}: Props) {
  const { streak } = useStreak();
  const startNum = parseScanPageNumber(session.startPage);
  const endNum = parseScanPageNumber(session.endPage);
  const pagesRead = pagesInReadingSession(session);
  const pace = sessionPacePerHour(session);
  const timeSpentMinDisplay =
    session.durationSeconds < 60
      ? (session.durationSeconds / 60).toFixed(1)
      : String(Math.max(0, Math.round(session.durationSeconds / 60)));

  const pagesRemaining =
    totalPages != null && endNum != null ? Math.max(0, totalPages - endNum) : null;

  const pctSessionOfBook = useMemo(() => {
    if (totalPages == null || totalPages <= 0 || startNum == null || endNum == null) return null;
    return (((endNum - startNum) / totalPages) * 100).toFixed(1);
  }, [totalPages, startNum, endNum]);

  const pctAtStart = useMemo(() => {
    if (totalPages == null || totalPages <= 0 || startNum == null) return null;
    return ((startNum / totalPages) * 100).toFixed(1);
  }, [totalPages, startNum]);

  const pctAtEnd = useMemo(() => {
    if (totalPages == null || totalPages <= 0 || endNum == null) return null;
    return ((endNum / totalPages) * 100).toFixed(1);
  }, [totalPages, endNum]);

  const barPrevWidthPct =
    totalPages != null && totalPages > 0 && startNum != null
      ? Math.min(100, Math.max(0, (startNum / totalPages) * 100))
      : 0;
  const barSessionWidthPct =
    totalPages != null && totalPages > 0 && startNum != null && endNum != null
      ? Math.min(100, Math.max(0, ((endNum - startNum) / totalPages) * 100))
      : 0;

  const title = session.bookTitle?.trim() || "Reading session";
  const authorLine = (author ?? "").trim();

  const onShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const range = `p. ${session.startPage} → p. ${session.endPage}`;
    const dur = formatElapsedHMS(session.durationSeconds);
    Share.share({
      message: `${title}\n${range}\n${dur} on BookNotes`,
    }).catch(() => {});
  };

  const onDonePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDone();
  };

  return (
    <ScrollView
      style={anchorContentToBottom ? styles.scrollFill : styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        anchorContentToBottom && styles.scrollContentBottomAnchored,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.completeBadge}>
          <Ionicons name="checkmark" size={14} color={GREEN} />
          <Text style={styles.completeBadgeText}>Session complete</Text>
        </View>
        <Text style={styles.elapsedSmall}>{formatElapsedHMS(session.durationSeconds)}</Text>
      </View>

      <View style={styles.sectionGap}>
        <Text style={styles.heroTitle} numberOfLines={3}>
          {title}
        </Text>
        <Text style={styles.heroSubtitle} numberOfLines={2}>
          {formatEndedSubtitle(session.endedAt, authorLine)}
        </Text>
      </View>

      <View style={styles.sectionGap}>
        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.pageRangeText}>
              p. {session.startPage} → p. {session.endPage}
            </Text>
            {pctSessionOfBook != null ? (
              <View style={styles.deltaBadge}>
                <Text style={styles.deltaBadgeText}>+{pctSessionOfBook}%</Text>
              </View>
            ) : (
              <Text style={styles.emDash}>—</Text>
            )}
          </View>
          {totalPages != null && totalPages > 0 && startNum != null && endNum != null ? (
            <>
              <View style={styles.barTrack}>
                <View style={[styles.barPrev, { width: `${barPrevWidthPct}%` }]} />
                <View
                  style={[styles.barSession, { left: `${barPrevWidthPct}%`, width: `${barSessionWidthPct}%` }]}
                />
              </View>
              <View style={styles.barLabelsRow}>
                <Text style={styles.barLabelEdge}>0%</Text>
                <Text style={styles.barLabelCenter}>
                  {pctAtStart}% → {pctAtEnd}%
                </Text>
                <Text style={styles.barLabelEdge}>100%</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.06)" style={styles.statBgIcon} />
            <Text style={[styles.statValue, { color: BLUE }]}>{pagesRead > 0 ? pagesRead : "—"}</Text>
            <Text style={styles.statLabel}>Pages read</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="speedometer-outline" size={48} color="rgba(255,255,255,0.06)" style={styles.statBgIcon} />
            <Text style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: GREEN }]}>{pace != null ? pace : "—"}</Text>
              {pace != null ? <Text style={styles.statUnit}>p/hr</Text> : null}
            </Text>
            <Text style={styles.statLabel}>Reading pace</Text>
          </View>
        </View>
        <View style={styles.gridRow}>
          <View style={styles.statCard}>
            <Ionicons name="timer-outline" size={48} color="rgba(255,255,255,0.06)" style={styles.statBgIcon} />
            <Text style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: AMBER }]}>{timeSpentMinDisplay}</Text>
              <Text style={styles.statUnit}>min</Text>
            </Text>
            <Text style={styles.statLabel}>Time spent</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="library-outline" size={48} color="rgba(255,255,255,0.06)" style={styles.statBgIcon} />
            <Text style={[styles.statValue, { color: PURPLE }]}>
              {pagesRemaining != null ? pagesRemaining : "—"}
            </Text>
            <Text style={styles.statLabel}>Pages remaining</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionGap}>
        <View style={styles.streakCard}>
          <Text style={styles.flameEmoji} accessibilityLabel="Streak">
            🔥
          </Text>
          <View style={styles.streakTextCol}>
            <Text style={styles.streakTitle}>Reading streak</Text>
            <Text style={styles.streakHint}>Keep it up — read again tomorrow</Text>
          </View>
          <Text style={styles.streakNumber}>{streak.currentStreak}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.doneBtn} onPress={onDonePress} accessibilityRole="button">
          <Ionicons name="checkmark" size={18} color={PRIMARY_TEXT} />
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
        <Pressable style={styles.shareBtn} onPress={onShare} accessibilityRole="button">
          <Ionicons name="share-outline" size={18} color={MUTED_60} />
          <Text style={styles.shareBtnText}>Share session</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: "100%" },
  scrollFill: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 32,
    gap: 20,
  },
  scrollContentBottomAnchored: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GREEN_BG,
    borderWidth: 0.5,
    borderColor: GREEN_BORDER,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: GREEN,
  },
  elapsedSmall: {
    fontSize: 12,
    fontWeight: "400",
    color: MUTED_30,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "400",
    color: MUTED_40,
  },
  sectionGap: { gap: 0 },
  progressCard: {
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageRangeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
    marginRight: 10,
  },
  deltaBadge: {
    backgroundColor: BLUE_BG,
    borderWidth: 0.5,
    borderColor: BLUE_BORDER,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  deltaBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: BLUE,
  },
  emDash: {
    fontSize: 15,
    color: MUTED_40,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BAR_BG,
    overflow: "hidden",
    position: "relative",
  },
  barPrev: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
  },
  barSession: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: BLUE,
    borderRadius: 3,
  },
  barLabelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  barLabelEdge: {
    fontSize: 10,
    color: MUTED_30,
  },
  barLabelCenter: {
    fontSize: 10,
    fontWeight: "500",
    color: BLUE,
  },
  grid: {
    gap: 10,
    alignSelf: "stretch",
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 14,
    overflow: "hidden",
    position: "relative",
  },
  statBgIcon: {
    position: "absolute",
    bottom: -8,
    right: -8,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.6)",
    marginLeft: 2,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "400",
    color: MUTED_35,
  },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AMBER_BG,
    borderWidth: 0.5,
    borderColor: AMBER_BORDER,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  flameEmoji: {
    fontSize: 28,
  },
  streakTextCol: {
    flex: 1,
    gap: 2,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
  },
  streakHint: {
    fontSize: 11,
    fontWeight: "400",
    color: MUTED_40,
  },
  streakNumber: {
    fontSize: 22,
    fontWeight: "600",
    color: AMBER,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 15,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY_TEXT,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingVertical: 15,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED_60,
  },
});
