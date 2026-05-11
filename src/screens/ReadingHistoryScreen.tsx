import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  SectionList,
  SectionListData,
  SectionListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "../context/AppSettingsContext";
import { useReadingSession } from "../context/ReadingSessionContext";
import {
  appendReadingHistoryReport,
  loadReadingHistoryReports,
} from "../reading/readingHistoryReportsStorage";
import {
  computeReadingHistoryStats,
  formatReadingTimeHero,
  type ReadingHistoryAggregates,
} from "../reading/readingHistoryStats";
import type { ScanStackParamList } from "../navigation/types";
import { generateReadingHistorySummary } from "../services/ai";
import { FONT_CANELA_TEXT_REGULAR, FONT_HELVETICA } from "../theme/fonts";
import type { ReadingHistoryAiReport, ReadingSession } from "../types/note";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ScanStackParamList, "ReadingHistory">;

type ReportSection = {
  key: "reports";
  title: string;
  data: ReadingHistoryAiReport[];
};

type SessionSection = {
  key: "sessions";
  title: string;
  data: ReadingSession[];
};

type HistorySection = ReportSection | SessionSection;

function formatDurationLabel(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatSessionEndedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatReportCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function HistorySessionRow({ session, darkMode }: { session: ReadingSession; darkMode: boolean }) {
  const title = session.bookTitle?.trim() || "No book selected";
  const pages = `p. ${session.startPage} → ${session.endPage}`;
  const meta = `${formatDurationLabel(session.durationSeconds)} · ${formatSessionEndedAt(session.endedAt)}`;
  return (
    <View style={[styles.sessionRow, darkMode && styles.sessionRowDark]}>
      <Text style={[styles.sessionRowTitle, darkMode && styles.sessionRowTitleDark]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.sessionRowPages, darkMode && styles.sessionRowPagesDark]}>{pages}</Text>
      <Text style={[styles.sessionRowMeta, darkMode && styles.sessionRowMetaDark]}>{meta}</Text>
    </View>
  );
}

function ReportCardRow({
  report,
  darkMode,
  accentColor,
  onPress,
}: {
  report: ReadingHistoryAiReport;
  darkMode: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.reportCard, darkMode && styles.reportCardDark]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Open saved reading report"
    >
      <View style={styles.reportCardTop}>
        <View style={[styles.reportCardIconWrap, { backgroundColor: accentColor + "22" }]}>
          <Ionicons name="sparkles" size={20} color={accentColor} />
        </View>
        <View style={styles.reportCardTopText}>
          <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>Reading insight</Text>
          <Text style={[styles.reportCardDate, darkMode && styles.reportCardDateDark]}>
            {formatReportCreatedAt(report.createdAt)}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={darkMode ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.35)"}
        />
      </View>
      <View style={styles.reportCardStatsRow}>
        <View style={styles.reportCardStat}>
          <Text style={[styles.reportCardStatValue, darkMode && styles.reportCardStatValueDark]}>
            {report.totalPagesRead}
          </Text>
          <Text style={[styles.reportCardStatLabel, darkMode && styles.reportCardStatLabelDark]}>pages</Text>
        </View>
        <View style={[styles.reportCardStatDivider, darkMode && styles.reportCardStatDividerDark]} />
        <View style={styles.reportCardStat}>
          <Text style={[styles.reportCardStatValue, { color: accentColor }]}>
            {formatReadingTimeHero(report.totalDurationSeconds)}
          </Text>
          <Text style={[styles.reportCardStatLabel, darkMode && styles.reportCardStatLabelDark]}>time</Text>
        </View>
        <View style={[styles.reportCardStatDivider, darkMode && styles.reportCardStatDividerDark]} />
        <View style={styles.reportCardStat}>
          <Text style={[styles.reportCardStatValue, darkMode && styles.reportCardStatValueDark]}>
            {report.sessionCount}
          </Text>
          <Text style={[styles.reportCardStatLabel, darkMode && styles.reportCardStatLabelDark]}>sessions</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ReadingHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { darkMode, accentColor } = useAppSettings();
  const { sessions } = useReadingSession();

  const [reports, setReports] = useState<ReadingHistoryAiReport[]>([]);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<ReadingHistoryAggregates | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const refreshReports = useCallback(() => {
    loadReadingHistoryReports().then(setReports).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshReports();
    }, [refreshReports])
  );

  const sections = useMemo((): HistorySection[] => {
    const out: HistorySection[] = [];
    if (reports.length > 0) {
      out.push({ key: "reports", title: "Insights", data: reports });
    }
    if (sessions.length > 0) {
      out.push({ key: "sessions", title: "Reading log", data: sessions });
    }
    return out;
  }, [reports, sessions]);

  const closeSummary = useCallback(() => {
    setSummaryVisible(false);
  }, []);

  const openSavedReport = useCallback((report: ReadingHistoryAiReport) => {
    hapticLight();
    setSummaryError(null);
    setSummaryLoading(false);
    setSummaryText(report.body);
    setSummaryStats({
      totalDurationSeconds: report.totalDurationSeconds,
      totalPagesRead: report.totalPagesRead,
      sessionCount: report.sessionCount,
    });
    setSummaryVisible(true);
  }, []);

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
  const summarizeIconColor = summarizeDisabled
    ? darkMode
      ? "rgba(255,255,255,0.28)"
      : "rgba(15,23,42,0.28)"
    : accentColor;

  const renderItem = useCallback(
    ({ item, section }: SectionListRenderItemInfo<ReadingHistoryAiReport | ReadingSession, HistorySection>) => {
      if (section.key === "reports") {
        return (
          <ReportCardRow
            report={item as ReadingHistoryAiReport}
            darkMode={darkMode}
            accentColor={accentColor}
            onPress={() => openSavedReport(item as ReadingHistoryAiReport)}
          />
        );
      }
      return <HistorySessionRow session={item as ReadingSession} darkMode={darkMode} />;
    },
    [accentColor, darkMode, openSavedReport]
  );

  const listEmpty = sections.length === 0;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarSide}
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, darkMode && styles.topBarTitleDark]} numberOfLines={1}>
          Reading history
        </Text>
        <TouchableOpacity
          style={styles.topBarSide}
          onPress={() => void openSummary()}
          disabled={summarizeDisabled}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Summarize reading history with AI"
        >
          <Ionicons name="sparkles" size={22} color={summarizeIconColor} />
        </TouchableOpacity>
      </View>

      {listEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.empty, darkMode && styles.emptyDark]}>
            No saved sessions yet. Finish a timer on the Scan page and tap Save session to see it here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections as SectionListData<ReadingHistoryAiReport | ReadingSession, HistorySection>[]}
          keyExtractor={(item, index) =>
            "body" in item ? `report-${item.id}` : `session-${(item as ReadingSession).id}-${index}`
          }
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, darkMode && styles.sectionHeaderDark]}>{section.title}</Text>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}

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
              Reading summary
            </Text>
            <TouchableOpacity
              style={styles.summaryModalHeaderSide}
              onPress={closeSummary}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close summary"
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    minHeight: 44,
  },
  topBarSide: {
    width: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 21,
    fontWeight: "700",
    fontFamily: FONT_CANELA_TEXT_REGULAR,
    color: lightColors.textPrimary,
  },
  topBarTitleDark: {
    color: darkColors.textPrimary,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.72,
    color: "rgba(15,23,42,0.45)",
    marginTop: 8,
    marginBottom: 10,
  },
  sectionHeaderDark: {
    color: "rgba(255,255,255,0.4)",
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
  sessionRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lightColors.borderStrong,
  },
  sessionRowDark: {
    borderBottomColor: darkColors.border,
  },
  sessionRowTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: lightColors.textPrimary,
    marginBottom: 4,
  },
  sessionRowTitleDark: {
    color: darkColors.textPrimary,
  },
  sessionRowPages: {
    fontSize: 16,
    color: lightColors.textSecondary,
    marginBottom: 2,
  },
  sessionRowPagesDark: {
    color: darkColors.textSecondary,
  },
  sessionRowMeta: {
    fontSize: 14,
    color: lightColors.textMuted,
  },
  sessionRowMetaDark: {
    color: darkColors.textSecondary,
  },
  reportCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "rgba(15,23,42,0.12)",
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: 16,
    marginBottom: 12,
  },
  reportCardDark: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  reportCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  reportCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reportCardTopText: {
    flex: 1,
    minWidth: 0,
  },
  reportCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  reportCardTitleDark: {
    color: darkColors.textPrimary,
  },
  reportCardDate: {
    fontSize: 13,
    fontWeight: "500",
    color: lightColors.textMuted,
    marginTop: 2,
  },
  reportCardDateDark: {
    color: darkColors.textSecondary,
  },
  reportCardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportCardStat: {
    flex: 1,
    alignItems: "center",
  },
  reportCardStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(15,23,42,0.12)",
    marginHorizontal: 4,
  },
  reportCardStatDividerDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  reportCardStatValue: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: FONT_HELVETICA,
    color: lightColors.textPrimary,
  },
  reportCardStatValueDark: {
    color: darkColors.textPrimary,
  },
  reportCardStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: lightColors.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reportCardStatLabelDark: {
    color: darkColors.textSecondary,
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
    fontFamily: FONT_CANELA_TEXT_REGULAR,
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
