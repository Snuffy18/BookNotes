import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReadingRunState } from "../context/ReadingSessionContext";
import { useAppSettings } from "../context/AppSettingsContext";
import {
  averageBookPacePerHour,
  formatSessionStartClock,
  getEstimate,
} from "../reading/readingTimerRunningStats";
import { formatReadingTimerHMS, READING_TIMER_FONT_FAMILY } from "../reading/readingTimerDisplay";
import type { ReadingSession, ScanItem } from "../types/note";
import { hexWithAlpha } from "../theme/colorUtils";
import { parseScanPageNumber } from "../utils/bookReadingProgress";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";

const FINISH_ESTIMATE_HELP =
  "We take pages left in the book (total pages minus the page you started on) and divide by your average reading pace for that book, in pages per hour, from past saved sessions that count (linked to the book and at least one minute long). That gives hours left, which we show as something like “finish in ~45 min” or “~3.2 hrs” once you’ve been reading for at least two minutes and we know the book’s total page count.";

type Props = {
  run: ReadingRunState & { phase: "running" | "paused" };
  elapsedSeconds: number;
  bookTitle: string | null;
  paceBookId: string | null;
  totalPages: number | null;
  sessions: ReadingSession[];
  lastScan: ScanItem | null;
  isPaused: boolean;
  hideHeader?: boolean;
  onPauseResume: () => void;
  onStopSave: () => void;
  onOpenSavedSessions: () => void;
};

function scanIdeaSnippet(scan: ScanItem): string {
  const firstIdea = scan.notes.mainIdeas[0];
  if (firstIdea?.trim()) return stripMarkdownBoldMarkers(firstIdea).trim();
  const summary = stripMarkdownBoldMarkers(scan.notes.summary).trim();
  if (summary) return summary;
  const firstQuote = (scan.notes.quotes ?? [])[0]?.trim();
  if (firstQuote) return stripMarkdownBoldMarkers(firstQuote).trim();
  return "";
}

function scanPageChapterLine(scan: ScanItem): string {
  const raw = (scan.page?.trim() || scan.notes.pageNumber?.trim() || "").trim();
  const page = raw ? `p. ${raw.replace(/^p\.?\s*/i, "")}` : null;
  const chapter = scan.chapter?.trim() || scan.notes.sectionHeadings?.[0]?.trim() || null;
  if (page && chapter) return `${page} · ${chapter}`;
  if (page) return page;
  if (chapter) return chapter;
  return "";
}

export function ReadingTimerRunningView({
  run,
  elapsedSeconds,
  bookTitle,
  paceBookId,
  totalPages,
  sessions,
  lastScan,
  isPaused,
  hideHeader = false,
  onPauseResume,
  onStopSave,
  onOpenSavedSessions,
}: Props) {
  const { accentColor } = useAppSettings();
  const [paceTick, setPaceTick] = useState(0);
  const [finishEstimateHelpOpen, setFinishEstimateHelpOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPaceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sessionMinutes = elapsedSeconds / 60;
  const currentPageNum = parseScanPageNumber(run.startPage);
  const pacePerHour = useMemo(
    () => averageBookPacePerHour(sessions, paceBookId),
    [sessions, paceBookId, paceTick]
  );

  const pagesRemaining = useMemo(() => {
    if (totalPages == null || totalPages <= 0 || currentPageNum == null) return null;
    return Math.max(0, totalPages - currentPageNum);
  }, [totalPages, currentPageNum]);

  const finishEstimate = useMemo(
    () => getEstimate(pagesRemaining, pacePerHour, sessionMinutes),
    [pagesRemaining, pacePerHour, sessionMinutes, paceTick]
  );

  const progressPct = useMemo(() => {
    if (totalPages == null || totalPages <= 0 || currentPageNum == null) return null;
    return Math.min(100, Math.max(0, (currentPageNum / totalPages) * 100));
  }, [totalPages, currentPageNum]);

  const progressPctLabel = progressPct != null ? `${progressPct.toFixed(1)}%` : null;

  const startedLine = `Started p. ${run.startPage} · ${formatSessionStartClock(run.startedAt)}`;

  const showPaceMeta = pacePerHour != null && totalPages != null;
  const showFinishEstimate = finishEstimate != null && totalPages != null && sessionMinutes >= 2;

  useEffect(() => {
    if (!showFinishEstimate) setFinishEstimateHelpOpen(false);
  }, [showFinishEstimate]);

  const lastScanIdea = lastScan ? scanIdeaSnippet(lastScan) : "";
  const lastScanMeta = lastScan ? scanPageChapterLine(lastScan) : "";

  return (
    <View style={styles.sections}>
      {!hideHeader ? (
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Reading timer</Text>
          {bookTitle ? (
            <Text style={styles.headerBookTitle} numberOfLines={2}>
              {bookTitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.timerSection}>
        <Text style={styles.timerDisplay}>{formatReadingTimerHMS(elapsedSeconds)}</Text>

        <View style={styles.timerMetaRow}>
          <Text style={styles.timerMetaText}>{startedLine}</Text>
          {showPaceMeta ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.paceText}>~{pacePerHour} p/hr</Text>
            </>
          ) : null}
        </View>

        {showFinishEstimate ? (
          <View style={styles.finishEstimateBlock}>
            <Pressable
              onPress={() => setFinishEstimateHelpOpen((open) => !open)}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={finishEstimate ?? "Finish estimate"}
              accessibilityHint="Shows how finish time is calculated"
              accessibilityState={{ expanded: finishEstimateHelpOpen }}
            >
              <Text style={styles.finishEstimate}>{finishEstimate}</Text>
            </Pressable>
            {finishEstimateHelpOpen ? (
              <View style={styles.finishEstimateHelpCard}>
                <Text style={styles.finishEstimateHelpText}>{FINISH_ESTIMATE_HELP}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {progressPct != null && currentPageNum != null ? (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressHeaderLeft}>
              Book progress · currently p. {run.startPage}
            </Text>
            {progressPctLabel ? (
              <Text style={[styles.progressHeaderRight, { color: accentColor }]}>
                {progressPctLabel}
              </Text>
            ) : null}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            <View
              style={[
                styles.progressDot,
                {
                  left: `${progressPct}%`,
                  backgroundColor: accentColor,
                  borderColor: hexWithAlpha(accentColor, 0.25),
                  shadowColor: accentColor,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.pauseBtn} onPress={onPauseResume} accessibilityRole="button">
          <Ionicons name={isPaused ? "play" : "pause"} size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.pauseBtnText}>{isPaused ? "Resume" : "Pause"}</Text>
        </Pressable>
        <Pressable style={styles.stopBtn} onPress={onStopSave} accessibilityRole="button">
          <Ionicons name="stop" size={16} color="#111111" />
          <Text style={styles.stopBtnText}>Stop & save</Text>
        </Pressable>
      </View>

      {lastScan && lastScanIdea ? (
        <View style={styles.lastScanCard}>
          <Text style={styles.lastScanLabel}>Last scan from this book</Text>
          <Text style={styles.lastScanIdea} numberOfLines={2}>
            {lastScanIdea}
          </Text>
          {lastScanMeta ? <Text style={styles.lastScanMeta}>{lastScanMeta}</Text> : null}
        </View>
      ) : null}

      <Pressable
        onPress={onOpenSavedSessions}
        style={styles.savedSessionsHit}
        accessibilityRole="button"
        accessibilityLabel="Saved sessions"
      >
        <Text style={styles.savedSessionsText}>Saved sessions →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: 22,
    paddingBottom: 4,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },
  headerBookTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
    textAlign: "center",
  },
  timerSection: {
    alignItems: "center",
    gap: 8,
  },
  timerDisplay: {
    fontFamily: READING_TIMER_FONT_FAMILY,
    fontSize: 52,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -1.56,
    fontVariant: ["tabular-nums"],
  },
  timerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  timerMetaText: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.35)",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  paceText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4ade80",
  },
  finishEstimate: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.28)",
    textAlign: "center",
  },
  finishEstimateBlock: {
    width: "100%",
    gap: 10,
    paddingHorizontal: 4,
  },
  finishEstimateHelpCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  finishEstimateHelpText: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
    color: "rgba(255,255,255,0.5)",
  },
  progressCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  progressHeaderLeft: {
    flex: 1,
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.3)",
  },
  progressHeaderRight: {
    fontSize: 11,
    fontWeight: "500",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    position: "relative",
    overflow: "visible",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
  },
  progressDot: {
    position: "absolute",
    top: -2,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  pauseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 15,
  },
  pauseBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.65)",
  },
  stopBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 15,
  },
  stopBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  lastScanCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 6,
  },
  lastScanLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.25)",
  },
  lastScanIdea: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18.6,
    color: "rgba(255,255,255,0.55)",
  },
  lastScanMeta: {
    fontSize: 10,
    fontWeight: "400",
    color: "rgba(255,255,255,0.25)",
  },
  savedSessionsHit: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  savedSessionsText: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
  },
});
