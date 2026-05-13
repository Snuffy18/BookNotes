import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { getActiveElapsedSeconds, useReadingSession, type ReadingRunState } from "../context/ReadingSessionContext";
import { useScanContext } from "../context/ScanContext";
import type { RootTabParamList } from "../navigation/types";
import { isEligibleReadingLogSession } from "../reading/readingHistoryStats";
import { formatReadingTimerHMS, READING_TIMER_FONT_FAMILY } from "../reading/readingTimerDisplay";
import type { ReadingSession } from "../types/note";
import { FONT_CANELA_TEXT_REGULAR } from "../theme/fonts";
import { estimateBookPageTotal, parseScanPageNumber } from "../utils/bookReadingProgress";
import { ReadingSessionCompleteView } from "./ReadingSessionCompleteView";
import { ReadingTimerRunningView } from "./ReadingTimerRunningView";
import { getPercentage, ReadingTimerPageWheel, READING_TIMER_WHEEL_VISIBLE_HEIGHT } from "./ReadingTimerPageWheel";

const SHEET_BG = "#1a1a1a";
const OVERLAY = "rgba(0,0,0,0.7)";
const BORDER_10 = "rgba(255,255,255,0.1)";
const CARD_BG = "rgba(255,255,255,0.05)";
const PAUSE_BG = "rgba(255,255,255,0.07)";
const MUTED = "rgba(255,255,255,0.45)";
const BLUE_DOT = "#3b82f6";
const PRIMARY_WHITE = "#ffffff";
const PRIMARY_TEXT = "#111111";
const SUBTITLE_BLUE = "#60a5fa";
const PHASE_CROSSFADE_MS = 280;
const PHASE_EASE = Easing.out(Easing.cubic);

type LiveReadingRun = Extract<ReadingRunState, { phase: "running" | "paused" }>;

function normalizeBookTitle(t: string | null | undefined): string {
  return (t ?? "").trim().toLowerCase();
}

/** Most recent saved session end page for the timer book (or untitled sessions when book is "none"). */
function lastFinishedPageForTimerBook(
  sessions: ReadingSession[],
  timerBookId: string | null | undefined,
  /** Library title for `timerBookId`; used to match older sessions that only stored `bookTitle`. */
  currentBookTitle: string | null
): string {
  if (timerBookId === undefined) return "";
  const titleNorm = normalizeBookTitle(currentBookTitle);
  const filtered = sessions.filter((s) => {
    if (timerBookId === null) return s.bookId === null;
    if (s.bookId === timerBookId) return true;
    if (titleNorm && normalizeBookTitle(s.bookTitle) === titleNorm) return true;
    return false;
  });
  if (filtered.length === 0) return "";
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );
  return sorted[0].endPage.trim();
}

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function ReadingTimerBottomSheet({ visible, onDismiss }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { books, activeBookId, activeBook, scans } = useScanContext();
  const {
    sessions,
    run,
    lastCompletedSession,
    clearLastCompletedSession,
    startReading,
    pauseReading,
    resumeReading,
    stopReading,
    saveReading,
    cancelReading,
  } = useReadingSession();

  const [startPageDraft, setStartPageDraft] = useState("");
  const [endPageDraft, setEndPageDraft] = useState("");
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const translateY = useRef(new Animated.Value(winH)).current;
  const animatingOut = useRef(false);
  const prevVisible = useRef(visible);
  const prevTimerBookForStartDraftRef = useRef<string | null | undefined>(undefined);
  const prevHadRunRef = useRef(false);
  /** Re-apply last-session start hint when the timer sheet opens or the chosen book changes while idle. */
  const prevReadingSheetVisibleRef = useRef(false);
  const readingSheetBookAtOpenRef = useRef<string | null | undefined>(undefined);

  /** `undefined` until first sync with library; `null` = explicit “No book”. */
  const [timerBookId, setTimerBookId] = useState<string | null | undefined>(undefined);

  const isIdle = run === null;
  const isRunning = run?.phase === "running";
  const isPaused = run?.phase === "paused";
  const isStopped = run?.phase === "stopped";

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const prevRunPhaseRef = useRef<string | null>(null);
  const liveRunRef = useRef<LiveReadingRun | null>(null);
  const runningPhaseOpacity = useRef(new Animated.Value(1)).current;
  const stoppedPhaseOpacity = useRef(new Animated.Value(0)).current;
  const [runningPhaseMounted, setRunningPhaseMounted] = useState(false);
  const [stoppedPhaseMounted, setStoppedPhaseMounted] = useState(false);
  const [phaseCrossfading, setPhaseCrossfading] = useState(false);

  useEffect(() => {
    const phase = run?.phase ?? null;
    const prevPhase = prevRunPhaseRef.current;

    if (isIdle) {
      setEndPageDraft("");
      prevRunPhaseRef.current = null;
      setRunningPhaseMounted(false);
      setStoppedPhaseMounted(false);
      setPhaseCrossfading(false);
      runningPhaseOpacity.setValue(1);
      stoppedPhaseOpacity.setValue(0);
      return;
    }

    if (run?.phase === "running" || run?.phase === "paused") {
      liveRunRef.current = run;
      setRunningPhaseMounted(true);
      setStoppedPhaseMounted(false);
      setPhaseCrossfading(false);
      runningPhaseOpacity.setValue(1);
      stoppedPhaseOpacity.setValue(0);
    } else if (phase === "stopped") {
      setStoppedPhaseMounted(true);
      const fromLive = prevPhase === "running" || prevPhase === "paused";
      if (fromLive) {
        setRunningPhaseMounted(true);
        setPhaseCrossfading(true);
        stoppedPhaseOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(runningPhaseOpacity, {
            toValue: 0,
            duration: PHASE_CROSSFADE_MS,
            easing: PHASE_EASE,
            useNativeDriver: true,
          }),
          Animated.timing(stoppedPhaseOpacity, {
            toValue: 1,
            duration: PHASE_CROSSFADE_MS,
            easing: PHASE_EASE,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            setRunningPhaseMounted(false);
            setPhaseCrossfading(false);
          }
        });
      } else {
        setRunningPhaseMounted(false);
        setPhaseCrossfading(false);
        runningPhaseOpacity.setValue(0);
        stoppedPhaseOpacity.setValue(1);
      }
    }

    if (phase === "stopped" && prevPhase !== "stopped" && run) {
      const s = parseScanPageNumber(run.startPage);
      setEndPageDraft(s != null ? String(s) : "1");
    }
    prevRunPhaseRef.current = phase;
  }, [isIdle, run, runningPhaseOpacity, stoppedPhaseOpacity]);

  useEffect(() => {
    if (books.length === 0) {
      setTimerBookId(null);
      return;
    }
    setTimerBookId((prev) => {
      if (prev === undefined) {
        return activeBookId && books.some((b) => b.id === activeBookId) ? activeBookId : books[0].id;
      }
      if (prev === null) return null;
      if (books.some((b) => b.id === prev)) return prev;
      return activeBookId && books.some((b) => b.id === activeBookId) ? activeBookId : books[0].id;
    });
  }, [books, activeBookId]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setBookPickerOpen(false);
    }
    prevVisible.current = visible;
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (animatingOut.current) return;
    animatingOut.current = true;
    Animated.timing(translateY, {
      toValue: winH,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      animatingOut.current = false;
      if (finished) {
        clearLastCompletedSession();
        onDismiss();
      }
    });
  }, [winH, translateY, onDismiss, clearLastCompletedSession]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(winH);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    } else {
      translateY.setValue(winH);
    }
  }, [visible, winH, translateY]);

  const elapsedSeconds = useMemo(() => getActiveElapsedSeconds(run), [run, tick]);

  const runningViewRun = useMemo((): LiveReadingRun | null => {
    if (run?.phase === "running" || run?.phase === "paused") return run;
    return liveRunRef.current;
  }, [run, runningPhaseMounted, phaseCrossfading]);

  const stoppedViewRun = run?.phase === "stopped" ? run : null;

  const runningElapsedSeconds =
    run?.phase === "stopped" && phaseCrossfading ? run.durationSeconds : elapsedSeconds;

  const selectedBookTitle = useMemo(() => {
    if (timerBookId === undefined) return "Select a book";
    if (timerBookId === null) return "Not tied to a book";
    return books.find((b) => b.id === timerBookId)?.title ?? "Select a book";
  }, [timerBookId, books]);

  const timerBook = useMemo(
    () => (timerBookId ? books.find((b) => b.id === timerBookId) ?? null : null),
    [books, timerBookId]
  );

  const resolvedRunBook = useMemo(() => {
    if (!run) return null;
    if (run.bookId) return books.find((b) => b.id === run.bookId) ?? null;
    if (activeBook && !activeBook.isRead) return activeBook;
    return null;
  }, [run, books, activeBook]);

  const activeRunBookTitle = useMemo(() => {
    if (!run) return null;
    return (
      run.bookTitle?.trim() ||
      resolvedRunBook?.title?.trim() ||
      activeBook?.title?.trim() ||
      null
    );
  }, [run, resolvedRunBook?.title, activeBook?.title]);

  const activeRunTotalPages = useMemo(
    () => (resolvedRunBook ? estimateBookPageTotal(resolvedRunBook) : null),
    [resolvedRunBook]
  );

  const suggestedStartPage = useMemo(
    () =>
      lastFinishedPageForTimerBook(
        sessions,
        timerBookId,
        timerBookId ? (timerBook?.title ?? null) : null
      ),
    [sessions, timerBookId, timerBook?.title]
  );

  const totalPages = timerBook?.totalPageCount ?? null;
  const estimatedTotal = useMemo(
    () => (timerBook ? estimateBookPageTotal(timerBook) : null),
    [timerBook]
  );

  const draftStartNum = parseScanPageNumber(startPageDraft) ?? 1;
  const suggestedNum = parseScanPageNumber(suggestedStartPage);

  const maxStartPages = useMemo(() => {
    const hi = Math.max(
      1,
      totalPages ?? 0,
      estimatedTotal ?? 0,
      suggestedNum ?? 0,
      draftStartNum,
      200
    );
    return Math.min(5000, hi);
  }, [totalPages, estimatedTotal, suggestedNum, draftStartNum]);

  const startPages = useMemo(
    () => Array.from({ length: maxStartPages }, (_, i) => i + 1),
    [maxStartPages]
  );

  const step1BookSubtitle = useMemo(() => {
    if (timerBookId === undefined) return null;
    if (timerBookId === null) return selectedBookTitle;
    if (typeof totalPages === "number" && totalPages > 0) {
      return `${selectedBookTitle} · ${totalPages} pages`;
    }
    return selectedBookTitle;
  }, [timerBookId, selectedBookTitle, totalPages]);

  const startRunNum = useMemo(() => {
    if (!run || run.phase !== "stopped") return 1;
    return parseScanPageNumber(run.startPage) ?? 1;
  }, [run]);

  const endDraftNum = parseScanPageNumber(endPageDraft) ?? startRunNum;

  const maxEndPage = useMemo(() => {
    if (!run || run.phase !== "stopped") return startRunNum;
    const bookTotal = activeRunTotalPages ?? estimatedTotal;
    const hi = Math.max(
      startRunNum,
      bookTotal ?? 0,
      endDraftNum,
      startRunNum + 100
    );
    return Math.min(5000, hi);
  }, [run, startRunNum, activeRunTotalPages, estimatedTotal, endDraftNum]);

  const endPages = useMemo(() => {
    if (!run || run.phase !== "stopped") return [1];
    const len = maxEndPage - startRunNum + 1;
    if (len <= 0) return [startRunNum];
    return Array.from({ length: len }, (_, i) => startRunNum + i);
  }, [run, startRunNum, maxEndPage]);

  const step2Subtitle = useMemo(() => {
    if (!run || run.phase !== "stopped") return "";
    const elapsed = formatReadingTimerHMS(run.durationSeconds);
    const startNum = parseScanPageNumber(run.startPage);
    const pct = startNum != null ? getPercentage(startNum, activeRunTotalPages) : null;
    const tail = pct != null ? ` (${pct})` : "";
    return `${elapsed} · from p. ${run.startPage}${tail}`;
  }, [run, activeRunTotalPages]);

  useEffect(() => {
    if (!visible) {
      prevTimerBookForStartDraftRef.current = undefined;
      prevHadRunRef.current = run !== null;
      return;
    }
    if (!isIdle) {
      prevHadRunRef.current = run !== null;
      return;
    }
    const endedReadingCycle = prevHadRunRef.current && run === null;
    prevHadRunRef.current = run !== null;

    const bookChanged = prevTimerBookForStartDraftRef.current !== timerBookId;
    prevTimerBookForStartDraftRef.current = timerBookId;

    if (endedReadingCycle) {
      setStartPageDraft(suggestedStartPage);
      return;
    }

    setStartPageDraft((prev) => {
      if (bookChanged) return suggestedStartPage;
      if (!prev.trim() && suggestedStartPage) return suggestedStartPage;
      return prev;
    });
  }, [visible, isIdle, run, timerBookId, suggestedStartPage]);

  useEffect(() => {
    if (!visible) {
      prevReadingSheetVisibleRef.current = false;
      readingSheetBookAtOpenRef.current = undefined;
      return;
    }
    if (!isIdle) return;
    const hint = suggestedStartPage.trim();
    const becameVisible = !prevReadingSheetVisibleRef.current;
    prevReadingSheetVisibleRef.current = true;
    const bookChangedWhileOpen = readingSheetBookAtOpenRef.current !== timerBookId;
    readingSheetBookAtOpenRef.current = timerBookId;
    if (!hint) return;
    if (becameVisible || bookChangedWhileOpen) {
      setStartPageDraft(hint);
    }
  }, [visible, isIdle, suggestedStartPage, timerBookId]);

  const lastScanForActiveRun = useMemo(() => {
    const bookId = run?.bookId ?? resolvedRunBook?.id ?? null;
    if (!bookId) return null;
    const bookScans = scans.filter((s) => s.bookId === bookId);
    if (bookScans.length === 0) return null;
    return [...bookScans].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }, [scans, run?.bookId, resolvedRunBook?.id]);

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const openSavedSessions = useCallback(() => {
    hapticLight();
    clearLastCompletedSession();
    onDismiss();
    const tabNav = navigation.getParent<NavigationProp<RootTabParamList>>();
    requestAnimationFrame(() => {
      tabNav?.navigate("ScanFlow", { screen: "ReadingHistory" });
    });
  }, [navigation, onDismiss, clearLastCompletedSession]);


  const completedBook = useMemo(
    () =>
      lastCompletedSession?.bookId
        ? books.find((b) => b.id === lastCompletedSession.bookId) ?? null
        : null,
    [books, lastCompletedSession]
  );

  const eligibleSavedSessionCount = useMemo(
    () => sessions.filter(isEligibleReadingLogSession).length,
    [sessions]
  );

  const sheetBottomPad = 0;
  const sheetHeightScale = 1.05;
  const completeSheetHeightScale = 1.21;

  /** One shared height for start, active, and finish steps so the sheet does not resize between phases. */
  const standardSheetHeight = useMemo(() => {
    const maxHeight = Math.round(winH * 0.88 * sheetHeightScale);
    const handleChrome = 10 + 4 + 12;
    const titleChrome = 30 + 10;
    const body =
      16 +
      76 +
      28 +
      READING_TIMER_WHEEL_VISIBLE_HEIGHT +
      16 +
      54 +
      12 +
      36 +
      8;
    const total = handleChrome + titleChrome + body + sheetBottomPad;
    return Math.min(maxHeight, Math.max(500, Math.round(total * sheetHeightScale)));
  }, [winH, sheetBottomPad]);

  const maxSheetHeight = Math.round(winH * 0.88 * sheetHeightScale);
  const completeSheetHeight = Math.min(
    maxSheetHeight,
    Math.round(standardSheetHeight * completeSheetHeightScale)
  );
  const sheetHeight = lastCompletedSession ? completeSheetHeight : standardSheetHeight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={[styles.overlay, StyleSheet.absoluteFill]} onPress={handleDismiss} accessibilityRole="button" accessibilityLabel="Dismiss reading timer" />
          <Animated.View
            style={[
              styles.sheet,
              {
                height: sheetHeight,
                paddingBottom: sheetBottomPad,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.handle} />
            {lastCompletedSession ? (
              <View style={styles.sheetBody}>
                <ReadingSessionCompleteView
                  session={lastCompletedSession}
                  totalPages={completedBook?.totalPageCount ?? null}
                  author={completedBook?.author?.trim() ? completedBook.author : null}
                  onDone={handleDismiss}
                />
              </View>
            ) : (
              <>
            <View style={styles.sheetColumn}>
            {!bookPickerOpen ? (
              <>
                <Text style={styles.sheetTitle}>Reading timer</Text>
                {(isRunning || isPaused || isStopped) && activeRunBookTitle ? (
                  <Text style={styles.sheetActiveBookTitle} numberOfLines={2}>
                    {activeRunBookTitle}
                  </Text>
                ) : null}
              </>
            ) : null}

            {bookPickerOpen ? (
            <View style={styles.sheetBody}>
              <ScrollView
                style={styles.sheetBodyScroll}
                contentContainerStyle={styles.pickerScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.pickerSectionLabel}>Choose book</Text>
                <TouchableOpacity
                  style={[styles.pickerRow, timerBookId === null && styles.pickerRowSelected]}
                  onPress={() => {
                    hapticLight();
                    setTimerBookId(null);
                    setBookPickerOpen(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pickerRowText}>Not tied to a book</Text>
                  {timerBookId === null ? <Ionicons name="checkmark" size={18} color={MUTED} /> : null}
                </TouchableOpacity>
                {books.map((book) => {
                  const sel = timerBookId === book.id;
                  return (
                    <TouchableOpacity
                      key={book.id}
                      style={[styles.pickerRow, sel && styles.pickerRowSelected]}
                      onPress={() => {
                        hapticLight();
                        setTimerBookId(book.id);
                        setBookPickerOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.pickerRowText} numberOfLines={2}>
                        {book.title}
                      </Text>
                      {sel ? <Ionicons name="checkmark" size={18} color={MUTED} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            ) : (
            <View style={styles.sheetBody}>
              <ScrollView
                style={styles.sheetBodyScroll}
                contentContainerStyle={styles.sheetBodyScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {isIdle ? (
                  <View style={styles.bodyGap}>
                    <TouchableOpacity
                      style={styles.bookRow}
                      onPress={() => {
                        hapticLight();
                        setBookPickerOpen(true);
                      }}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityLabel="Choose book for reading timer"
                    >
                      <View style={styles.bookRowLeft}>
                        <View style={styles.blueDot} />
                        <View style={styles.bookRowTextCol}>
                          <Text style={styles.labelMuted}>Reading</Text>
                          <Text style={styles.bookTitleText} numberOfLines={1}>
                            {selectedBookTitle}
                          </Text>
                          {step1BookSubtitle != null ? (
                            <Text style={styles.bookSubtitleBlue} numberOfLines={2}>
                              {step1BookSubtitle}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Ionicons name="chevron-down" size={16} color={MUTED} />
                    </TouchableOpacity>

                    <View>
                      <View style={styles.stepRow}>
                        <View style={styles.stepBadge}>
                          <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.fieldLabel}>Page you start on</Text>
                      </View>
                      <ReadingTimerPageWheel
                        pages={startPages}
                        value={draftStartNum}
                        totalPages={estimatedTotal}
                        onValueChange={(p) => setStartPageDraft(String(p))}
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.startBtn}
                      onPress={() => {
                        hapticLight();
                        const startPage = startPageDraft.trim() || String(draftStartNum);
                        startReading(startPage, timerBookId === undefined ? null : timerBookId);
                      }}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="play" size={20} color={PRIMARY_TEXT} />
                      <Text style={styles.startBtnText}>Start timer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.savedSessionsRowCompact}
                      onPress={openSavedSessions}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="View saved reading sessions"
                    >
                      <Text style={styles.savedSessionsLabel}>Saved sessions</Text>
                      {eligibleSavedSessionCount > 0 ? (
                        <View style={styles.savedSessionsBadge}>
                          <Text style={styles.savedSessionsBadgeText}>{eligibleSavedSessionCount}</Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color={MUTED} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {(runningPhaseMounted || stoppedPhaseMounted) && run ? (
                  <View style={styles.phaseCrossfade}>
                    {runningPhaseMounted && runningViewRun ? (
                      <Animated.View
                        style={[
                          styles.phaseLayer,
                          phaseCrossfading && styles.phaseLayerOverlay,
                          { opacity: runningPhaseOpacity },
                        ]}
                        pointerEvents={phaseCrossfading || isStopped ? "none" : "auto"}
                      >
                        <ReadingTimerRunningView
                          run={runningViewRun}
                          elapsedSeconds={runningElapsedSeconds}
                          bookTitle={activeRunBookTitle}
                          paceBookId={runningViewRun.bookId ?? resolvedRunBook?.id ?? null}
                          totalPages={activeRunTotalPages}
                          sessions={sessions}
                          lastScan={lastScanForActiveRun}
                          isPaused={runningViewRun.phase === "paused"}
                          hideHeader
                          onPauseResume={() => {
                            hapticLight();
                            if (isRunning) pauseReading();
                            else resumeReading();
                          }}
                          onStopSave={() => {
                            hapticLight();
                            stopReading();
                          }}
                          onOpenSavedSessions={openSavedSessions}
                        />
                      </Animated.View>
                    ) : null}

                    {stoppedPhaseMounted && stoppedViewRun ? (
                      <Animated.View
                        style={[
                          styles.phaseLayer,
                          phaseCrossfading && styles.phaseLayerOverlay,
                          { opacity: stoppedPhaseOpacity },
                        ]}
                        pointerEvents={phaseCrossfading ? "none" : "auto"}
                      >
                        <View style={styles.bodyGap}>
                          <View style={styles.stoppedTimerSection}>
                            <Text style={[styles.timerHuge, { fontFamily: READING_TIMER_FONT_FAMILY }]}>
                              {formatReadingTimerHMS(stoppedViewRun.durationSeconds)}
                            </Text>
                            {step2Subtitle ? (
                              <Text style={styles.stoppedContextBlue} numberOfLines={2}>
                                {step2Subtitle}
                              </Text>
                            ) : null}
                          </View>

                          <View>
                            <View style={styles.stepRow}>
                              <View style={styles.stepBadge}>
                                <Text style={styles.stepBadgeText}>2</Text>
                              </View>
                              <Text style={styles.fieldLabel}>Page you finished on</Text>
                            </View>
                            <ReadingTimerPageWheel
                              pages={endPages}
                              value={endDraftNum}
                              totalPages={activeRunTotalPages}
                              onValueChange={(p) => setEndPageDraft(String(p))}
                            />
                          </View>

                          <TouchableOpacity
                            style={[styles.startBtn, !endPageDraft.trim() && styles.startBtnDisabled]}
                            onPress={() => {
                              if (!endPageDraft.trim()) return;
                              hapticLight();
                              saveReading(endPageDraft);
                            }}
                            activeOpacity={0.9}
                            disabled={!endPageDraft.trim()}
                          >
                            <Ionicons name="checkmark" size={20} color={PRIMARY_TEXT} />
                            <Text style={styles.startBtnText}>Save session</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              hapticLight();
                              cancelReading();
                            }}
                            hitSlop={{ top: 8, bottom: 8 }}
                            style={styles.discardHit}
                          >
                            <Text style={styles.discardText}>Discard</Text>
                          </TouchableOpacity>
                        </View>
                      </Animated.View>
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>
            </View>
            )}
            </View>
              </>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    backgroundColor: OVERLAY,
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 0.5,
    borderTopColor: BORDER_10,
    paddingHorizontal: 20,
    flexDirection: "column",
  },
  sheetColumn: {
    flex: 1,
    minHeight: 0,
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  sheetBodyScroll: {
    flex: 1,
  },
  sheetBodyScrollContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  stoppedTimerSection: {
    alignItems: "center",
    gap: 8,
  },
  pickerScrollContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: FONT_CANELA_TEXT_REGULAR,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 10,
  },
  sheetActiveBookTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 10,
  },
  bodyGap: {
    gap: 16,
    paddingBottom: 8,
  },
  phaseCrossfade: {
    position: "relative",
    width: "100%",
  },
  phaseLayer: {
    width: "100%",
  },
  phaseLayerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bookRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: CARD_BG,
    borderColor: BORDER_10,
  },
  bookRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLUE_DOT,
  },
  bookRowTextCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  labelMuted: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
  },
  bookTitleText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
  bookSubtitleBlue: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: SUBTITLE_BLUE,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  stoppedContextBlue: {
    fontSize: 11,
    fontWeight: "500",
    color: SUBTITLE_BLUE,
    textAlign: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
    marginBottom: 0,
  },
  startBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: PRIMARY_WHITE,
    borderRadius: 16,
    paddingVertical: 18,
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: PRIMARY_TEXT,
  },
  timerBlock: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  timerHuge: {
    fontSize: 52,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -1.56,
    fontVariant: ["tabular-nums"],
  },
  timerMeta: {
    fontSize: 15,
    fontWeight: "400",
    color: MUTED,
    textAlign: "center",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  pauseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PAUSE_BG,
    borderWidth: 0.5,
    borderColor: BORDER_10,
    borderRadius: 12,
    paddingVertical: 14,
  },
  pauseBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  stopSaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PRIMARY_WHITE,
    borderRadius: 12,
    paddingVertical: 14,
  },
  stopSaveBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: PRIMARY_TEXT,
  },
  pickerSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: BORDER_10,
  },
  pickerRowSelected: {
    borderColor: "rgba(255,255,255,0.22)",
  },
  pickerRowText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
    color: "#ffffff",
    marginRight: 8,
  },
  discardHit: {
    alignSelf: "center",
    paddingVertical: 6,
  },
  discardText: {
    fontSize: 15,
    fontWeight: "500",
    color: MUTED,
  },
  savedSessionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 20,
    paddingBottom: 4,
  },
  savedSessionsRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: -4,
    paddingVertical: 4,
  },
  savedSessionsLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: MUTED,
  },
  savedSessionsBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedSessionsBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
