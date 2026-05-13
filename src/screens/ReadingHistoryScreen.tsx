import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ReadingSessionCompleteView } from "../components/ReadingSessionCompleteView";
import { useAppSettings } from "../context/AppSettingsContext";
import { useReadingSession } from "../context/ReadingSessionContext";
import { useScanContext } from "../context/ScanContext";
import {
  appendReadingHistoryReport,
  loadReadingHistoryReports,
} from "../reading/readingHistoryReportsStorage";
import {
  computeReadingHistoryStats,
  formatReadingTimeHero,
  isEligibleReadingLogSession,
  pagesInReadingSession,
  sessionPacePerHour,
  type ReadingHistoryAggregates,
} from "../reading/readingHistoryStats";
import {
  endedAtWeekdayIndexMon0,
  formatWeekRangeLabel,
  getMondayWeekRange,
  sessionEndedInWeek,
  sumPagesForSessions,
} from "../reading/readingHistoryWeek";
import type { ScanStackParamList } from "../navigation/types";
import { generateReadingHistorySummary } from "../services/ai";
import { FONT_HELVETICA } from "../theme/fonts";
import type { ReadingHistoryAiReport, ReadingSession } from "../types/note";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ScanStackParamList, "ReadingHistory">;

const BLUE_STAT = "#60a5fa";
const GREEN_STAT = "#4ade80";
const AMBER_STAT = "#fbbf24";

const ACCENT_PALETTE = [
  "#60a5fa",
  "#4ade80",
  "#fbbf24",
  "#a855f7",
  "#f472b6",
  "#22d3ee",
  "#fb923c",
  "#94a3b8",
];

function bookAccentColor(bookId: string): string {
  let h = 0;
  for (let i = 0; i < bookId.length; i++) h = ((h * 31) ^ bookId.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[h % ACCENT_PALETTE.length];
}

/** Never raw seconds; minimum "1 min". Hide under 1 minute (return ""). */
function formatLogDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return "";
  const totalMin = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${Math.max(1, totalMin)} min`;
  if (min === 0) return `${h} hr`;
  return `${h} hr ${min} min`;
}

function formatSessionClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLogGroupTitle(dayKey: string, now: Date): string {
  const [ys, ms, ds] = dayKey.split("-");
  const d = new Date(Number(ys), Number(ms) - 1, Number(ds), 12, 0, 0, 0);
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 86400000;
  if (t1 === t0) return "TODAY";
  if (t1 === t0 - dayMs) {
    const sub = d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase();
    return `YESTERDAY · ${sub}`;
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase();
}


type LogSessionCardProps = {
  session: ReadingSession;
  bookTitle: string;
  darkMode: boolean;
  onPress: () => void;
};

function LogSessionCard({ session, bookTitle, darkMode, onPress }: LogSessionCardProps) {
  const accent = session.bookId ? bookAccentColor(session.bookId) : ACCENT_PALETTE[0];
  const pagesRead = pagesInReadingSession(session);
  const pace = sessionPacePerHour(session);
  const dur = formatLogDuration(session.durationSeconds);
  const clock = formatSessionClock(session.endedAt);
  const t = darkMode ? styles : stylesLight;

  return (
    <TouchableOpacity
      style={[styles.logCard, darkMode ? styles.logCardDark : styles.logCardLight]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="View reading session"
    >
      <View style={[styles.logAccentBar, { backgroundColor: accent }]} />
      <View style={styles.logCardMid}>
        <Text style={[styles.logTitle, t.logTitle]} numberOfLines={2}>
          {bookTitle}
        </Text>
        <View style={styles.logMetaRow}>
          <Text style={[styles.logMetaPages, t.logMetaPages]}>
            p. {session.startPage} → {session.endPage}
          </Text>
          <View style={[styles.logMetaDot, t.logMetaDot]} />
          <Text style={[styles.logMetaDur, t.logMetaDur]}>{dur}</Text>
        </View>
      </View>
      <View style={styles.logCardRight}>
        <Text style={[styles.logRightPages, t.logRightPages]}>{pagesRead}</Text>
        {pace != null ? (
          <Text style={[styles.logRightPace, t.logRightPace]}>{pace} p/hr</Text>
        ) : null}
        <Text style={[styles.logRightTime, t.logRightTime]}>{clock}</Text>
      </View>
      <Ionicons name="chevron-forward" size={13} color={darkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)"} />
    </TouchableOpacity>
  );
}

type WeeklyCardProps = {
  weekRangeLabel: string;
  pages: number;
  minutes: number;
  sessions: number;
  pacePhr: number | null;
  dailyPages: number[];
  darkMode: boolean;
};

function WeeklySummaryCard({
  weekRangeLabel,
  pages,
  minutes,
  sessions,
  pacePhr,
  dailyPages,
  darkMode,
}: WeeklyCardProps) {
  const maxDay = Math.max(...dailyPages, 1);
  const t = darkMode ? styles : stylesLight;

  return (
    <View style={[styles.weekCard, darkMode ? styles.weekCardDark : styles.weekCardLight]}>
      <View style={styles.weekHeaderRow}>
        <View style={styles.weekHeaderLeft}>
          <Text style={[styles.weekTitle, t.weekTitle]}>This week</Text>
          <Text style={[styles.weekSubtitle, t.weekSubtitle]}>{weekRangeLabel}</Text>
        </View>
        <Text style={[styles.weekDaysPill, t.weekDaysPill]}>7 days</Text>
      </View>

      <View style={styles.weekStatsRow}>
        <View style={styles.weekStatCol}>
          <Text style={[styles.weekStatVal, t.weekStatValWhite]}>{pages}</Text>
          <Text style={[styles.weekStatLbl, t.weekStatLbl]}>PAGES</Text>
        </View>
        <View style={[styles.weekStatDivider, t.weekStatDivider]} />
        <View style={styles.weekStatCol}>
          <Text style={[styles.weekStatVal, { color: BLUE_STAT }]}>{minutes}</Text>
          <Text style={[styles.weekStatLbl, t.weekStatLbl]}>MINUTES</Text>
        </View>
        <View style={[styles.weekStatDivider, t.weekStatDivider]} />
        <View style={styles.weekStatCol}>
          <Text style={[styles.weekStatVal, { color: GREEN_STAT }]}>{sessions}</Text>
          <Text style={[styles.weekStatLbl, t.weekStatLbl]}>SESSIONS</Text>
        </View>
        <View style={[styles.weekStatDivider, t.weekStatDivider]} />
        <View style={styles.weekStatCol}>
          <Text style={[styles.weekStatVal, { color: AMBER_STAT }]}>
            {pacePhr != null ? pacePhr : "—"}
          </Text>
          <Text style={[styles.weekStatLbl, t.weekStatLbl]}>P/HR</Text>
        </View>
      </View>

      <View style={styles.weekBarsRow}>
        {dailyPages.map((p, i) => {
          const ratio = maxDay > 0 ? p / maxDay : 0;
          const h = p > 0 ? Math.max(3, Math.round(ratio * 28)) : 3;
          const fill = p > 0 ? BLUE_STAT : darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
          return <View key={i} style={[styles.weekBar, { height: h, backgroundColor: fill }]} />;
        })}
      </View>
    </View>
  );
}

export function ReadingHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { darkMode, accentColor } = useAppSettings();
  const { sessions } = useReadingSession();
  const { books } = useScanContext();

  const [, setReports] = useState<ReadingHistoryAiReport[]>([]);
  const [sessionDetail, setSessionDetail] = useState<ReadingSession | null>(null);
  const sessionSheetTranslateY = useRef(new Animated.Value(winH)).current;
  const sessionSheetAnimatingOut = useRef(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<ReadingHistoryAggregates | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [filterBookId, setFilterBookId] = useState<string | null>(null);
  const [weekNow, setWeekNow] = useState(() => new Date());

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const refreshReports = useCallback(() => {
    loadReadingHistoryReports().then(setReports).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      setWeekNow(new Date());
      refreshReports();
    }, [refreshReports])
  );

  const { weekStart, weekEnd } = useMemo(() => getMondayWeekRange(weekNow), [weekNow]);
  const weekRangeLabel = useMemo(() => formatWeekRangeLabel(weekStart, weekEnd), [weekStart, weekEnd]);

  const eligibleSessions = useMemo(
    () => sessions.filter(isEligibleReadingLogSession).sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()),
    [sessions]
  );

  const bookPills = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; title: string }[] = [];
    for (const s of eligibleSessions) {
      if (!s.bookId || seen.has(s.bookId)) continue;
      seen.add(s.bookId);
      const title = books.find((b) => b.id === s.bookId)?.title?.trim() || s.bookTitle?.trim() || "Book";
      out.push({ id: s.bookId, title });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }, [eligibleSessions, books]);

  const weekSessions = useMemo(
    () =>
      eligibleSessions.filter((s) => sessionEndedInWeek(s, weekStart, weekEnd)),
    [eligibleSessions, weekStart, weekEnd]
  );

  const dailyPages = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    for (const s of weekSessions) {
      const idx = endedAtWeekdayIndexMon0(s.endedAt);
      arr[idx] += pagesInReadingSession(s);
    }
    return arr;
  }, [weekSessions]);

  const weekTotals = useMemo(() => {
    const pages = sumPagesForSessions(weekSessions);
    const totalSec = weekSessions.reduce((a, s) => a + s.durationSeconds, 0);
    const minutes = Math.max(0, Math.round(totalSec / 60));
    const cnt = weekSessions.length;
    const totalMin = totalSec / 60;
    const pacePhr = totalMin >= 1 && pages > 0 ? Math.round((pages / totalMin) * 60) : null;
    return { pages, minutes, sessions: cnt, pacePhr };
  }, [weekSessions]);

  const filteredLogSessions = useMemo(() => {
    if (filterBookId == null) return eligibleSessions;
    return eligibleSessions.filter((s) => s.bookId === filterBookId);
  }, [eligibleSessions, filterBookId]);

  const logGroups = useMemo(() => {
    const map = new Map<string, ReadingSession[]>();
    for (const s of filteredLogSessions) {
      const k = localDayKey(s.endedAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return keys.map((key) => ({ key, sessions: map.get(key)! }));
  }, [filteredLogSessions]);

  const resolveBookTitle = useCallback(
    (s: ReadingSession) => {
      const fromLib = s.bookId ? books.find((b) => b.id === s.bookId)?.title?.trim() : "";
      return fromLib || s.bookTitle?.trim() || "Book";
    },
    [books]
  );

  const closeSummary = useCallback(() => {
    setSummaryVisible(false);
  }, []);

  const closeSessionDetail = useCallback(() => {
    if (sessionSheetAnimatingOut.current) return;
    sessionSheetAnimatingOut.current = true;
    Animated.timing(sessionSheetTranslateY, {
      toValue: winH,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      sessionSheetAnimatingOut.current = false;
      if (finished) setSessionDetail(null);
    });
  }, [winH, sessionSheetTranslateY]);

  const openSessionDetail = useCallback(
    (session: ReadingSession) => {
      hapticLight();
      sessionSheetAnimatingOut.current = false;
      sessionSheetTranslateY.stopAnimation();
      setSessionDetail(session);
    },
    [sessionSheetTranslateY]
  );

  useEffect(() => {
    if (!sessionDetail) return;
    sessionSheetAnimatingOut.current = false;
    sessionSheetTranslateY.stopAnimation();
    sessionSheetTranslateY.setValue(winH);
    Animated.spring(sessionSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [sessionDetail, winH, sessionSheetTranslateY]);

  const sessionDetailBook = useMemo(
    () =>
      sessionDetail?.bookId ? books.find((b) => b.id === sessionDetail.bookId) ?? null : null,
    [books, sessionDetail]
  );

  const openSummary = useCallback(async () => {
    if (sessions.length === 0) return;
    hapticLight();
    const stats = computeReadingHistoryStats(sessions);
    setSummaryVisible(true);
    setSummaryStats(stats);
    setSummaryText(null);
    setSummaryError(null);
    setSummaryLoading(true);
    try {
      const text = await generateReadingHistorySummary(sessions);
      setSummaryText(text);
      const report: ReadingHistoryAiReport = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        createdAt: new Date().toISOString(),
        body: text,
        totalDurationSeconds: stats.totalDurationSeconds,
        totalPagesRead: stats.totalPagesRead,
        sessionCount: stats.sessionCount,
      };
      await appendReadingHistoryReport(report);
      setReports((prev) => [report, ...prev]);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Could not generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, [sessions]);

  const summarizeDisabled = sessions.length === 0 || summaryLoading;

  const hasAnyLoggable = eligibleSessions.length > 0;
  const emptyGlobal = sessions.length === 0;

  const t = darkMode ? styles : stylesLight;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.navCircle28, darkMode ? styles.navCircleBackDark : styles.navCircleBackLight]}
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={darkMode ? "#ffffff" : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, t.topBarTitle]} numberOfLines={1}>
          Reading history
        </Text>
        <TouchableOpacity
          style={[
            styles.navCircle28,
            darkMode ? styles.navCircleSparkDark : styles.navCircleSparkLight,
          ]}
          onPress={() => void openSummary()}
          disabled={summarizeDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Reading insights with AI"
        >
          <Ionicons
            name="sparkles"
            size={16}
            color={
              summarizeDisabled
                ? darkMode
                  ? "rgba(255,255,255,0.28)"
                  : "rgba(15,23,42,0.28)"
                : BLUE_STAT
            }
          />
        </TouchableOpacity>
      </View>

      {emptyGlobal ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.empty, darkMode && styles.emptyDark]}>
            No saved sessions yet. Finish a timer on the Scan page and tap Save session to see it here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 28) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WeeklySummaryCard
            weekRangeLabel={weekRangeLabel}
            pages={weekTotals.pages}
            minutes={weekTotals.minutes}
            sessions={weekTotals.sessions}
            pacePhr={weekTotals.pacePhr}
            dailyPages={dailyPages}
            darkMode={darkMode}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
            style={styles.pillsScroll}
            nestedScrollEnabled
          >
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setFilterBookId(null);
              }}
              style={[
                styles.pill,
                darkMode ? styles.pillBaseDark : styles.pillBaseLight,
                filterBookId === null && (darkMode ? styles.pillSelectedDark : styles.pillSelectedLight),
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.pillText,
                  darkMode ? styles.pillTextMutedDark : styles.pillTextMutedLight,
                  filterBookId === null && (darkMode ? styles.pillTextSelectedDark : styles.pillTextSelectedLight),
                ]}
              >
                All books
              </Text>
            </TouchableOpacity>
            {bookPills.map((b) => {
              const sel = filterBookId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => {
                    hapticLight();
                    setFilterBookId(b.id);
                  }}
                  style={[
                    styles.pill,
                    darkMode ? styles.pillBaseDark : styles.pillBaseLight,
                    sel && (darkMode ? styles.pillSelectedDark : styles.pillSelectedLight),
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.pillText,
                      darkMode ? styles.pillTextMutedDark : styles.pillTextMutedLight,
                      sel && (darkMode ? styles.pillTextSelectedDark : styles.pillTextSelectedLight),
                    ]}
                    numberOfLines={1}
                  >
                    {b.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!hasAnyLoggable ? (
            <Text style={[styles.logEmptyNote, t.logEmptyNote]}>
              Sessions need a linked book and at least 1 minute to appear here.
            </Text>
          ) : logGroups.length === 0 ? (
            <Text style={[styles.logEmptyNote, t.logEmptyNote]}>No sessions for this filter.</Text>
          ) : (
            logGroups.map((g, gi) => (
              <View key={g.key} style={[styles.logGroup, gi > 0 && styles.logGroupSpacing]}>
                <Text style={[styles.logGroupLabel, t.logGroupLabel]}>{formatLogGroupTitle(g.key, weekNow)}</Text>
                <View style={styles.logGroupCards}>
                  {g.sessions.map((s) => (
                    <LogSessionCard
                      key={s.id}
                      session={s}
                      bookTitle={resolveBookTitle(s)}
                      darkMode={darkMode}
                      onPress={() => openSessionDetail(s)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={sessionDetail != null}
        transparent
        animationType="none"
        onRequestClose={closeSessionDetail}
        statusBarTranslucent
      >
        {sessionDetail ? (
          <View style={styles.sessionModalRoot}>
            <Pressable
              style={styles.sessionModalBackdrop}
              onPress={closeSessionDetail}
              accessibilityRole="button"
              accessibilityLabel="Close session details"
            />
            <Animated.View
              style={[
                styles.sessionModalSheet,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  transform: [{ translateY: sessionSheetTranslateY }],
                },
              ]}
            >
              <View style={styles.sessionModalGrabRow}>
                <View style={styles.sessionModalHandle} />
                <TouchableOpacity
                  style={styles.sessionModalCloseBtn}
                  onPress={closeSessionDetail}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={26} color="rgba(255,255,255,0.88)" />
                </TouchableOpacity>
              </View>
              <View style={styles.sessionModalBody}>
                <ReadingSessionCompleteView
                  session={sessionDetail}
                  totalPages={sessionDetailBook?.totalPageCount ?? null}
                  author={sessionDetailBook?.author?.trim() ? sessionDetailBook.author : null}
                  onDone={closeSessionDetail}
                  anchorContentToBottom
                />
              </View>
            </Animated.View>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={summaryVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeSummary}
      >
        <View style={[styles.summaryModalRoot, darkMode && styles.summaryModalRootDark]}>
          <View
            style={[
              styles.summaryModalHeader,
              darkMode && styles.summaryModalHeaderDark,
              { paddingTop: Math.max(insets.top, 8) },
            ]}
          >
            <View style={styles.summaryModalHeaderSide} />
            <Text style={[styles.summaryModalTitle, darkMode && styles.summaryModalTitleDark]} numberOfLines={1}>
              Reading insights
            </Text>
            <TouchableOpacity
              style={styles.summaryModalHeaderSide}
              onPress={closeSummary}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close insights"
            >
              <Ionicons
                name="close"
                size={28}
                color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryModalBody}>
            {summaryLoading ? (
              <View style={styles.summaryLoadingWrap}>
                {summaryStats ? (
                  <View style={[styles.summaryHeroRow, styles.summaryHeroRowLoading]}>
                    <View style={[styles.summaryHeroCard, darkMode && styles.summaryHeroCardDark]}>
                      <Text style={[styles.summaryHeroValue, darkMode && styles.summaryHeroValueDark]}>
                        {summaryStats.totalPagesRead}
                      </Text>
                      <Text style={[styles.summaryHeroLabel, darkMode && styles.summaryHeroLabelDark]}>
                        pages read
                      </Text>
                    </View>
                    <View style={[styles.summaryHeroCard, darkMode && styles.summaryHeroCardDark]}>
                      <Text style={[styles.summaryHeroValueAccent, { color: accentColor }]}>
                        {formatReadingTimeHero(summaryStats.totalDurationSeconds)}
                      </Text>
                      <Text style={[styles.summaryHeroLabel, darkMode && styles.summaryHeroLabelDark]}>
                        time reading
                      </Text>
                    </View>
                  </View>
                ) : null}
                <ActivityIndicator size="large" color={accentColor} />
                <Text style={[styles.summaryLoadingLabel, darkMode && styles.summaryLoadingLabelDark]}>
                  Generating your report…
                </Text>
              </View>
            ) : summaryError ? (
              <View style={styles.summaryErrorWrap}>
                {summaryStats ? (
                  <View style={styles.summaryHeroRow}>
                    <View style={[styles.summaryHeroCard, darkMode && styles.summaryHeroCardDark]}>
                      <Text style={[styles.summaryHeroValue, darkMode && styles.summaryHeroValueDark]}>
                        {summaryStats.totalPagesRead}
                      </Text>
                      <Text style={[styles.summaryHeroLabel, darkMode && styles.summaryHeroLabelDark]}>
                        pages read
                      </Text>
                    </View>
                    <View style={[styles.summaryHeroCard, darkMode && styles.summaryHeroCardDark]}>
                      <Text style={[styles.summaryHeroValueAccent, { color: accentColor }]}>
                        {formatReadingTimeHero(summaryStats.totalDurationSeconds)}
                      </Text>
                      <Text style={[styles.summaryHeroLabel, darkMode && styles.summaryHeroLabelDark]}>
                        time reading
                      </Text>
                    </View>
                  </View>
                ) : null}
                <Text style={[styles.summaryError, darkMode && styles.summaryErrorDark]}>{summaryError}</Text>
                <TouchableOpacity
                  style={[styles.summaryRetryBtn, { borderColor: accentColor }]}
                  onPress={() => void openSummary()}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.summaryRetryBtnText, { color: accentColor }]}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : summaryText && summaryStats ? (
              <ScrollView
                contentContainerStyle={[
                  styles.summaryScrollContent,
                  { paddingBottom: Math.max(insets.bottom, 24) },
                ]}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.summaryHeroRow}>
                  <View style={[styles.summaryHeroCard, darkMode && styles.summaryHeroCardDark]}>
                    <Text style={[styles.summaryHeroValue, darkMode && styles.summaryHeroValueDark]}>
                      {summaryStats.totalPagesRead}
                    </Text>
                    <Text style={[styles.summaryHeroLabel, darkMode && styles.summaryHeroLabelDark]}>
                      pages read
                    </Text>
                  </View>
                  <View style={[styles.summaryHeroCard, darkMode && styles.summaryHeroCardDark]}>
                    <Text style={[styles.summaryHeroValueAccent, { color: accentColor }]}>
                      {formatReadingTimeHero(summaryStats.totalDurationSeconds)}
                    </Text>
                    <Text style={[styles.summaryHeroLabel, darkMode && styles.summaryHeroLabelDark]}>
                      time reading
                    </Text>
                  </View>
                </View>
                <Text style={[styles.summaryCaption, darkMode && styles.summaryCaptionDark]}>
                  {`Across ${summaryStats.sessionCount} logged session${summaryStats.sessionCount === 1 ? "" : "s"}`}
                </Text>
                <Text style={[styles.summaryBodyText, darkMode && styles.summaryBodyTextDark]} selectable>
                  {summaryText}
                </Text>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Light-theme tokens for redesigned widgets (parallel to `styles`). */
const stylesLight = StyleSheet.create({
  topBarTitle: { color: lightColors.textPrimary },
  weekTitle: { color: lightColors.textPrimary },
  weekSubtitle: { color: "rgba(15,23,42,0.35)" },
  weekDaysPill: { color: "rgba(15,23,42,0.3)" },
  weekStatValWhite: { color: lightColors.textPrimary },
  weekStatLbl: { color: "rgba(15,23,42,0.3)" },
  weekStatDivider: { backgroundColor: "rgba(15,23,42,0.07)" },
  logTitle: { color: lightColors.textPrimary },
  logMetaPages: { color: "rgba(15,23,42,0.5)" },
  logMetaDot: { backgroundColor: "rgba(15,23,42,0.35)" },
  logMetaDur: { color: "rgba(15,23,42,0.35)" },
  logRightPages: { color: "rgba(15,23,42,0.5)" },
  logRightPace: { color: "rgba(15,23,42,0.35)" },
  logRightTime: { color: "rgba(15,23,42,0.25)" },
  logGroupLabel: { color: "rgba(15,23,42,0.3)" },
  logEmptyNote: { color: "rgba(15,23,42,0.45)" },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  scrollFlex: { flex: 1 },
  scrollContent: {
    paddingTop: 4,
    gap: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    minHeight: 44,
  },
  navCircle28: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navCircleBackDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  navCircleBackLight: {
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  navCircleSparkDark: {
    backgroundColor: "rgba(59,130,246,0.15)",
    borderWidth: 0.5,
    borderColor: "rgba(59,130,246,0.3)",
  },
  navCircleSparkLight: {
    backgroundColor: "rgba(59,130,246,0.12)",
    borderWidth: 0.5,
    borderColor: "rgba(59,130,246,0.28)",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  empty: {
    fontSize: 16,
    lineHeight: 24,
    color: lightColors.textMuted,
    textAlign: "center",
  },
  emptyDark: {
    color: darkColors.textSecondary,
  },
  weekCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
    gap: 12,
  },
  weekCardDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  weekCardLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.08)",
  },
  weekHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  weekHeaderLeft: { gap: 2, flex: 1, minWidth: 0, paddingRight: 8 },
  weekTitle: { fontSize: 12, fontWeight: "500", color: "#ffffff" },
  weekSubtitle: { fontSize: 10, fontWeight: "400", color: "rgba(255,255,255,0.35)" },
  weekDaysPill: { fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.3)", marginTop: 2 },
  weekStatsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  weekStatCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  weekStatVal: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.18,
    fontFamily: FONT_HELVETICA,
  },
  weekStatValWhite: { color: "#ffffff" },
  weekStatLbl: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.06 * 9,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.3)",
  },
  weekStatDivider: {
    width: 0.5,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.07)",
    marginVertical: 2,
  },
  weekBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 28,
    gap: 3,
  },
  weekBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 3,
  },
  pillsScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 20,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 0.5,
    maxWidth: 220,
  },
  pillBaseDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  pillBaseLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.08)",
  },
  pillSelectedDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  pillSelectedLight: {
    backgroundColor: "rgba(15,23,42,0.1)",
    borderColor: "rgba(15,23,42,0.2)",
  },
  pillText: { fontSize: 11, fontWeight: "500" },
  pillTextMutedDark: { color: "rgba(255,255,255,0.35)" },
  pillTextMutedLight: { color: "rgba(15,23,42,0.35)" },
  pillTextSelectedDark: { color: "#ffffff" },
  pillTextSelectedLight: { color: lightColors.textPrimary },
  logGroup: { gap: 6 },
  logGroupSpacing: { marginTop: 18 },
  logGroupLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.07 * 10,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.3)",
    marginBottom: 2,
  },
  logGroupCards: { gap: 6 },
  logEmptyNote: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginTop: 4,
  },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  logCardDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  logCardLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.08)",
  },
  logAccentBar: {
    width: 3,
    height: 36,
    borderRadius: 2,
    flexShrink: 0,
  },
  logCardMid: { flex: 1, minWidth: 0, gap: 4 },
  logTitle: { fontSize: 13, fontWeight: "500", color: "#ffffff" },
  logMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  logMetaPages: { fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.5)" },
  logMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  logMetaDur: { fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.35)" },
  logCardRight: { alignItems: "flex-end", gap: 2, marginRight: 2 },
  logRightPages: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.5)" },
  logRightPace: { fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.35)" },
  logRightTime: { fontSize: 10, fontWeight: "400", color: "rgba(255,255,255,0.25)" },
  sessionModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sessionModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sessionModalSheet: {
    height: "80%",
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
    overflow: "hidden",
  },
  sessionModalGrabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    minHeight: 28,
  },
  sessionModalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  sessionModalCloseBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: 4,
  },
  sessionModalBody: {
    flex: 1,
    minHeight: 0,
  },
  summaryModalRoot: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  summaryModalRootDark: {
    backgroundColor: darkColors.background,
  },
  summaryModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lightColors.borderStrong,
  },
  summaryModalHeaderSide: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryModalTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 21,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  summaryModalTitleDark: {
    color: darkColors.textPrimary,
  },
  summaryModalHeaderDark: {
    borderBottomColor: darkColors.border,
  },
  summaryModalBody: {
    flex: 1,
  },
  summaryHeroRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  summaryHeroRowLoading: {
    alignSelf: "stretch",
    marginBottom: 8,
  },
  summaryHeroCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(15,23,42,0.08)",
  },
  summaryHeroCardDark: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  summaryHeroValue: {
    fontSize: 44,
    fontWeight: "800",
    fontFamily: FONT_HELVETICA,
    color: lightColors.textPrimary,
  },
  summaryHeroValueDark: {
    color: darkColors.textPrimary,
  },
  summaryHeroValueAccent: {
    fontSize: 40,
    fontWeight: "800",
    fontFamily: FONT_HELVETICA,
    textAlign: "center",
  },
  summaryHeroLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: lightColors.textMuted,
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  summaryHeroLabelDark: {
    color: darkColors.textSecondary,
  },
  summaryCaption: {
    fontSize: 14,
    fontWeight: "600",
    color: lightColors.textSecondary,
    marginBottom: 14,
  },
  summaryCaptionDark: {
    color: darkColors.textSecondary,
  },
  summaryLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryErrorWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  summaryLoadingLabel: {
    fontSize: 16,
    color: lightColors.textSecondary,
    textAlign: "center",
  },
  summaryLoadingLabelDark: {
    color: darkColors.textSecondary,
  },
  summaryScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  summaryBodyText: {
    fontSize: 18,
    lineHeight: 26,
    color: lightColors.textPrimary,
  },
  summaryBodyTextDark: {
    color: darkColors.textPrimary,
  },
  summaryError: {
    fontSize: 16,
    lineHeight: 24,
    color: "#b91c1c",
    textAlign: "center",
    marginTop: 12,
  },
  summaryErrorDark: {
    color: "#fca5a5",
  },
  summaryRetryBtn: {
    marginTop: 20,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  summaryRetryBtnText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
