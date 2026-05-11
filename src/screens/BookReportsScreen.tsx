import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { ScrollView, Swipeable } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { PdfExportToast, type PdfExportToastMode } from "../components/PdfExportToast";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import type { LibraryStackParamList } from "../navigation/types";
import { generateBookReportsInsights } from "../services/ai";
import type { BookInsightsSummary, ScanItem } from "../types/note";
import { createAllBookReportsPdf, sanitizeFileBase } from "../utils/bookReportsPdf";
import { playSoundEffect } from "../utils/soundEffects";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";
import { darkColors, lightColors } from "../theme/colors";
import { hexWithAlpha } from "../theme/colorUtils";
import { FONT_CANELA_TEXT_BOLD, FONT_CANELA_TEXT_REGULAR } from "../theme/fonts";

type Navigation = NativeStackNavigationProp<LibraryStackParamList, "BookReports">;
type Route = RouteProp<LibraryStackParamList, "BookReports">;

type BookReportsFeedItem =
  | { kind: "insights" }
  | { kind: "report"; report: ScanItem; matches: string[] };

/** Two columns per row (even distribution). */
function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

export function BookReportsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { darkMode, accentColor } = useAppSettings();
  const {
    books,
    scans,
    removeBook,
    removeScan,
    toggleBookRead,
    setBookInsightsSummary,
    clearBookInsightsSummary,
  } = useScanContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [insightsModalVisible, setInsightsModalVisible] = useState(false);
  const [insightsGenerating, setInsightsGenerating] = useState(false);
  const [pdfToastMode, setPdfToastMode] = useState<PdfExportToastMode | null>(null);
  const reportSwipeRefs = useRef<Record<string, ComponentRef<typeof Swipeable> | null>>({});
  const insightsSwipeRef = useRef<ComponentRef<typeof Swipeable> | null>(null);

  const bookId = route.params.bookId;
  const book = useMemo(() => books.find((item) => item.id === bookId), [books, bookId]);
  const reports = useMemo(
    () =>
      scans
        .filter((scan) => scan.bookId === bookId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [scans, bookId]
  );

  useLayoutEffect(() => {
    setInsightsModalVisible(false);
    insightsSwipeRef.current?.close();
  }, [bookId]);

  const closeOtherReportSwipes = (exceptId: string) => {
    Object.entries(reportSwipeRefs.current).forEach(([id, ref]) => {
      if (id !== exceptId) ref?.close();
    });
  };

  const closeAllReportSwipes = () => {
    Object.values(reportSwipeRefs.current).forEach((ref) => ref?.close());
  };

  const onConfirmDeleteInsights = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      "Remove AI insights?",
      "The saved summary will be removed. You can generate it again from the menu.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => insightsSwipeRef.current?.close(),
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            clearBookInsightsSummary(bookId);
            insightsSwipeRef.current?.close();
            setInsightsModalVisible(false);
          },
        },
      ],
    );
  };

  const onConfirmDeleteReport = (report: ScanItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert("Delete report?", "This report will be permanently removed.", [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => reportSwipeRefs.current[report.id]?.close(),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeScan(report.id);
          reportSwipeRefs.current[report.id]?.close();
        },
      },
    ]);
  };
  const query = searchQuery.trim().toLowerCase();
  const latestReportDate = reports[0]?.createdAt
    ? formatLastActivity(new Date(reports[0].createdAt))
    : "No scans yet";

  const filteredReports = useMemo(() => {
    if (!query) {
      return reports.map((report) => ({ report, matches: [] as string[] }));
    }

    return reports
      .map((report) => {
        const matches: string[] = [];
        if (
          report.notes.keywords.some((k) =>
            stripMarkdownBoldMarkers(k).toLowerCase().includes(query)
          )
        ) {
          matches.push("Keywords");
        }
        if (
          (report.notes.vocabularyTerms ?? []).some(
            (term) =>
              term.word.toLowerCase().includes(query) ||
              term.definition.toLowerCase().includes(query)
          )
        ) {
          matches.push("Words");
        }
        if (report.notes.summary.toLowerCase().includes(query)) {
          matches.push("Summary");
        }
        if (report.notes.mainIdeas.some((idea) => idea.toLowerCase().includes(query))) {
          matches.push("Main Ideas");
        }
        if ((report.notes.sectionHeadings ?? []).some((h) => h.toLowerCase().includes(query))) {
          matches.push("Section headings");
        }
        if (report.notes.detailedNotes.toLowerCase().includes(query)) {
          matches.push("Detailed Notes");
        }
        if ((report.notes.quotes ?? []).some((q) => q.toLowerCase().includes(query))) {
          matches.push("Quotes");
        }
        if (
          (report.reinforcedIdeas ?? []).some(
            (match) =>
              match.idea.toLowerCase().includes(query) ||
              (match.matchedPage ?? "").toLowerCase().includes(query)
          )
        ) {
          matches.push("Reinforced Ideas");
        }
        return { report, matches };
      })
      .filter((item) => item.matches.length > 0);
  }, [reports, query]);

  /** Insights interleaved with reports by recency (insights use `updatedAt`). Search mode: reports only. */
  const bookReportsFeed = useMemo((): BookReportsFeedItem[] => {
    if (query) {
      return filteredReports.map((fr) => ({
        kind: "report" as const,
        report: fr.report,
        matches: fr.matches,
      }));
    }
    const rows: { item: BookReportsFeedItem; ms: number }[] = [];
    if (book?.insightsSummary) {
      rows.push({
        item: { kind: "insights" },
        ms: new Date(book.insightsSummary.updatedAt).getTime(),
      });
    }
    for (const fr of filteredReports) {
      rows.push({
        item: { kind: "report", report: fr.report, matches: fr.matches },
        ms: new Date(fr.report.createdAt).getTime(),
      });
    }
    rows.sort((a, b) => b.ms - a.ms);
    return rows.map((r) => r.item);
  }, [book?.insightsSummary, filteredReports, query]);

  const reportPillNumber = useCallback(
    (reportId: string) => {
      const idx = reports.findIndex((r) => r.id === reportId);
      if (idx < 0) return reports.length;
      return reports.length - idx;
    },
    [reports]
  );

  const onDeleteBook = () => {
    if (!book) return;
    setOptionsVisible(false);
    Alert.alert(
      "Delete book?",
      "This removes the book and all its reports. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            removeBook(book.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const onToggleBookRead = () => {
    if (!book) return;
    toggleBookRead(book.id);
    setOptionsVisible(false);
  };

  const onSummarizeAi = async () => {
    const targetBook = books.find((item) => item.id === bookId);
    if (!targetBook || reports.length === 0) {
      setOptionsVisible(false);
      Alert.alert("No reports", "Scan at least one page for this book before running Summarize AI.");
      return;
    }
    setOptionsVisible(false);
    setInsightsGenerating(true);
    try {
      const payload = await generateBookReportsInsights(targetBook, reports);
      setBookInsightsSummary(bookId, {
        updatedAt: new Date().toISOString(),
        ...payload,
      });
      playSoundEffect("summarizeAiSuccess");
      setInsightsModalVisible(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Try again.";
      Alert.alert("Summarize AI failed", message);
    } finally {
      setInsightsGenerating(false);
    }
  };

  const pdfShareDialogTitle = useMemo(
    () => (book ? `Export ${sanitizeFileBase(book.title)}` : "Export"),
    [book],
  );

  const onExportAllReportsPdf = async () => {
    if (!book || reports.length === 0) {
      setOptionsVisible(false);
      Alert.alert("No reports", "There are no reports to export yet.");
      return;
    }
    setOptionsVisible(false);
    setPdfToastMode("loading");
    try {
      const uri = await createAllBookReportsPdf(book, reports);
      setPdfToastMode({ type: "ready", uri });
    } catch (e) {
      setPdfToastMode(null);
      const message = e instanceof Error ? e.message : "Could not create the PDF.";
      Alert.alert("Export failed", message);
    }
  };

  const onPdfToastDismissComplete = () => {
    setPdfToastMode(null);
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.headerBlock}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>
            {book ? book.title : "Book Reports"}
          </Text>
          <TouchableOpacity
            style={[styles.headerMenuButton, darkMode && styles.headerMenuButtonDark]}
            onPress={() => setOptionsVisible(true)}
            activeOpacity={0.82}
            hitSlop={8}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerAuthor, darkMode && styles.headerAuthorDark]}>
          {book?.author ?? "Unknown author"}
        </Text>
        <Text style={[styles.headerSubtitle, darkMode && styles.headerSubtitleDark]}>
          All reports and notes captured while reading this book.
        </Text>
        <View style={[styles.statsRow, darkMode && styles.statsRowDark]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: accentColor }]}>{reports.length}</Text>
            <Text style={[styles.statLabel, darkMode && styles.statLabelDark]}>Reports</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, darkMode && styles.headerTitleDark]}>{latestReportDate}</Text>
            <Text style={[styles.statLabel, darkMode && styles.statLabelDark]}>Last activity</Text>
          </View>
        </View>
        <View style={[styles.searchWrap, darkMode && styles.searchWrapDark]}>
          <Ionicons name="search-outline" size={18} color={darkMode ? darkColors.textSecondary : lightColors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search keyword in reports..."
            placeholderTextColor="#94a3b8"
            style={[styles.searchInput, darkMode && styles.searchInputDark]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          bookReportsFeed.length === 0 && styles.scrollContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {bookReportsFeed.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name={query ? "search-outline" : "document-text-outline"}
              size={44}
              color="#94a3b8"
            />
            <Text style={styles.emptyTitle}>
              {query ? "No matching reports" : "No reports yet"}
            </Text>
            <Text style={styles.emptyText}>
              {query
                ? "Try another keyword to find where it appears."
                : "Scan a page from the Scan tab to create one."}
            </Text>
          </View>
        ) : (
          bookReportsFeed.map((entry) =>
            entry.kind === "insights" && book?.insightsSummary ? (
              <Swipeable
                key={`insights-${bookId}`}
                ref={insightsSwipeRef}
                friction={2}
                overshootRight={false}
                onSwipeableWillOpen={() => closeAllReportSwipes()}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.reportSwipeDelete}
                    onPress={onConfirmDeleteInsights}
                    activeOpacity={0.88}
                    accessibilityLabel="Remove AI reading insights"
                  >
                    <Ionicons name="trash-outline" size={22} color="#ffffff" />
                    <Text style={styles.reportSwipeDeleteLabel}>Delete</Text>
                  </TouchableOpacity>
                )}
              >
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => setInsightsModalVisible(true)}
                  style={styles.insightsCardTouchable}
                >
                  <LinearGradient
                    colors={[hexWithAlpha(accentColor, 0.35), hexWithAlpha(accentColor, 0.08)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.insightsCardGradientBorder}
                  >
                    <View style={[styles.insightsCardInner, darkMode && styles.insightsCardInnerDark]}>
                      <View style={styles.insightsCardHeaderRow}>
                        <View style={[styles.insightsIconBubble, { backgroundColor: hexWithAlpha(accentColor, 0.22) }]}>
                          <Ionicons name="sparkles" size={20} color={accentColor} />
                        </View>
                        <View style={styles.insightsCardHeaderText}>
                          <Text style={[styles.insightsCardTitle, darkMode && styles.headerTitleDark]}>
                            AI reading insights
                          </Text>
                          <Text style={[styles.insightsCardMeta, darkMode && styles.reportDateDark]}>
                            Updated{" "}
                            {new Date(book.insightsSummary.updatedAt).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={accentColor} />
                      </View>
                      {insightsIsStructured(book.insightsSummary) ? (
                        <Text
                          style={[styles.insightsCardHeadline, darkMode && styles.reportSnippetDark]}
                          numberOfLines={2}
                        >
                          {book.insightsSummary.headline}
                        </Text>
                      ) : (
                        <Text
                          style={[styles.insightsCardPreview, darkMode && styles.reportSnippetDark]}
                          numberOfLines={2}
                        >
                          {book.insightsSummary.body}
                        </Text>
                      )}
                      <Text style={[styles.insightsCardHint, { color: accentColor }]}>
                        Tap for full insights
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Swipeable>
            ) : entry.kind === "report" ? (
              <Swipeable
                key={entry.report.id}
                ref={(r) => {
                  reportSwipeRefs.current[entry.report.id] = r;
                }}
                friction={2}
                overshootRight={false}
                onSwipeableWillOpen={() => {
                  insightsSwipeRef.current?.close();
                  closeOtherReportSwipes(entry.report.id);
                }}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.reportSwipeDelete}
                    onPress={() => onConfirmDeleteReport(entry.report)}
                    activeOpacity={0.88}
                    accessibilityLabel="Delete report"
                  >
                    <Ionicons name="trash-outline" size={22} color="#ffffff" />
                    <Text style={styles.reportSwipeDeleteLabel}>Delete</Text>
                  </TouchableOpacity>
                )}
              >
                <TouchableOpacity
                  style={[styles.reportCard, darkMode && styles.reportCardDark]}
                  onPress={() =>
                    navigation.navigate("ReportDetails", {
                      item: entry.report,
                      highlightQuery: query || undefined,
                    })
                  }
                  activeOpacity={0.85}
                >
                  <View style={styles.reportHeaderRow}>
                    <Text
                      style={[
                        styles.reportTitle,
                        darkMode && styles.reportTitleDark,
                        entry.report.chapter?.trim() ? styles.reportTitleChapter : null,
                      ]}
                      numberOfLines={2}
                    >
                      {buildReportTitle(entry.report)}
                    </Text>
                    <View style={[styles.reportIndexPill, styles.reportIndexPillFixed, { borderColor: accentColor }]}>
                      <Text style={[styles.reportIndexText, { color: accentColor }]}>
                        #{reportPillNumber(entry.report.id)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.reportDate, darkMode && styles.reportDateDark]}>
                    {new Date(entry.report.createdAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.reportMetaRow}>
                    <View style={[styles.pagePill, { borderColor: accentColor }]}>
                      <Ionicons name="document-text-outline" size={13} color={accentColor} />
                      <Text style={[styles.pagePillText, { color: accentColor }]}>
                        {entry.report.page?.trim() ? `Page ${entry.report.page.trim()}` : "Page not detected"}
                      </Text>
                    </View>
                    {(entry.report.reinforcedIdeas?.length ?? 0) > 0 ? (
                      <View style={[styles.pagePill, { borderColor: accentColor }]}>
                        <Ionicons name="repeat-outline" size={13} color={accentColor} />
                        <Text style={[styles.pagePillText, { color: accentColor }]}>
                          {entry.report.reinforcedIdeas?.length} reinforced idea
                          {(entry.report.reinforcedIdeas?.length ?? 0) === 1 ? "" : "s"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.reportSnippet, darkMode && styles.reportSnippetDark]} numberOfLines={2}>
                    {stripMarkdownBoldMarkers(entry.report.notes.summary)}
                  </Text>
                  {entry.matches.length > 0 ? (
                    <View style={styles.matchWrap}>
                      <Text style={[styles.reportMatchText, { color: accentColor }]}>Found in:</Text>
                      <View style={styles.matchBadgeRow}>
                        {entry.matches.map((match) => (
                          <View key={match} style={[styles.matchBadge, { borderColor: accentColor }]}>
                            <Text style={[styles.matchBadgeText, { color: accentColor }]}>{match}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </Swipeable>
            ) : null
          )
        )}
      </ScrollView>

      <Modal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <Pressable style={styles.optionsBackdrop} onPress={() => setOptionsVisible(false)}>
          <Pressable
            style={[styles.optionsSheet, darkMode && styles.optionsSheetDark]}
            onPress={(event) => event.stopPropagation()}
          >
            <TouchableOpacity
              style={styles.optionRow}
              onPress={onToggleBookRead}
              activeOpacity={0.85}
            >
              <Ionicons
                name={book?.isRead ? "checkmark-done-outline" : "checkmark-circle-outline"}
                size={18}
                color={accentColor}
              />
              <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>
                {book?.isRead ? "Unmark as read" : "Mark book as read"}
              </Text>
            </TouchableOpacity>
            {reports.length > 0 ? (
              <>
                <View style={styles.optionDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => void onSummarizeAi()}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles-outline" size={18} color={accentColor} />
                  <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>Summarize AI</Text>
                </TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => void onExportAllReportsPdf()}
                  activeOpacity={0.85}
                >
                  <Ionicons name="document-text-outline" size={18} color={accentColor} />
                  <Text style={[styles.optionText, darkMode && styles.optionTextDark]}>
                    Export all to PDF
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            <View style={styles.optionDivider} />
            <TouchableOpacity style={styles.optionRow} onPress={onDeleteBook} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.optionTextDanger}>Delete book</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={insightsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInsightsModalVisible(false)}
      >
        <View style={styles.insightsModalRoot}>
          <Pressable style={styles.insightsReaderBackdropFill} onPress={() => setInsightsModalVisible(false)} />
          <View
            style={[
              styles.insightsReaderSheet,
              darkMode && styles.insightsReaderSheetDark,
              { maxHeight: Math.min(windowHeight * 0.92, windowHeight - insets.top - 8) },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              bounces
              nestedScrollEnabled
              contentContainerStyle={[
                styles.insightsReaderScrollContent,
                { paddingBottom: Math.max(insets.bottom, 16) + 12 },
              ]}
            >
              <View style={styles.insightsReaderGrabRow}>
                <Text style={[styles.insightsReaderTitle, darkMode && styles.headerTitleDark]}>
                  AI reading insights
                </Text>
                <TouchableOpacity onPress={() => setInsightsModalVisible(false)} hitSlop={12}>
                  <Ionicons
                    name="close"
                    size={22}
                    color={darkMode ? darkColors.textSecondary : lightColors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {book?.insightsSummary ? (
                <Text style={[styles.insightsReaderMeta, darkMode && styles.reportDateDark]}>
                  {new Date(book.insightsSummary.updatedAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
              ) : null}
              {book?.insightsSummary && insightsIsStructured(book.insightsSummary) ? (
                <>
                  <Text style={[styles.insightsReaderHeadline, darkMode && styles.reportSnippetDark]}>
                    {book.insightsSummary.headline}
                  </Text>
                  <View style={styles.insightsReaderStatsGrid}>
                    {chunkPairs(book.insightsSummary.stats ?? []).map((pair, rowIdx) => (
                      <View key={rowIdx} style={styles.insightsReaderStatsSubRow}>
                        {pair.map((s) => (
                          <View
                            key={`${s.label}-${s.value}`}
                            style={[
                              styles.insightsReaderStatCell,
                              darkMode && styles.insightsReaderStatCellDark,
                              { borderColor: hexWithAlpha(accentColor, 0.4) },
                            ]}
                          >
                            <Text style={[styles.insightsReaderStatValue, { color: accentColor }]}>
                              {s.value}
                            </Text>
                            <Text style={[styles.insightsReaderStatLabel, darkMode && styles.reportDateDark]}>
                              {s.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.insightsSectionLabel, darkMode && styles.reportDateDark]}>
                    Highlights
                  </Text>
                  {(book.insightsSummary.facts ?? []).map((fact, idx) => (
                    <View key={`${idx}-${fact.slice(0, 12)}`} style={styles.insightsFactRow}>
                      <View style={[styles.insightsFactBullet, { backgroundColor: accentColor }]} />
                      <Text style={[styles.insightsFactText, darkMode && styles.reportSnippetDark]}>{fact}</Text>
                    </View>
                  ))}
                  <View
                    style={[
                      styles.insightsKickerWrap,
                      darkMode && styles.insightsKickerWrapDark,
                      { borderLeftColor: accentColor },
                    ]}
                  >
                    <Text style={[styles.insightsKickerText, darkMode && styles.reportSnippetDark]}>
                      {book.insightsSummary.kicker}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.insightsReaderBody, darkMode && styles.reportSnippetDark]}>
                  {book?.insightsSummary?.body ?? ""}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={insightsGenerating} transparent animationType="fade">
        <View style={styles.generatingOverlay}>
          <View style={[styles.generatingCard, darkMode && styles.generatingCardDark]}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={[styles.generatingLabel, darkMode && styles.optionTextDark]}>Generating insights…</Text>
          </View>
        </View>
      </Modal>

      <PdfExportToast
        mode={pdfToastMode}
        shareDialogTitle={pdfShareDialogTitle}
        onDismissComplete={onPdfToastDismissComplete}
      />
    </SafeAreaView>
  );
}

function insightsIsStructured(ins: BookInsightsSummary | undefined): boolean {
  return Boolean(ins?.headline?.trim() && ins.facts && ins.facts.length > 0);
}

function buildReportTitle(report: ScanItem) {
  return (
    report.chapter?.trim() ||
    stripMarkdownBoldMarkers(report.notes.mainIdeas[0]?.trim() ?? "") ||
    stripMarkdownBoldMarkers(report.notes.keywords[0]?.trim() ?? "") ||
    getSummaryTopic(report.notes.summary)
  );
}

function getSummaryTopic(summary: string) {
  const cleanSummary = stripMarkdownBoldMarkers(summary);
  const firstSentence = cleanSummary.split(/[.!?]/)[0]?.trim() || "Reading Notes";
  if (firstSentence.length <= 56) {
    return firstSentence;
  }
  return `${firstSentence.slice(0, 53).trimEnd()}...`;
}

function formatLastActivity(date: Date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeLabel = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (startOfTarget.getTime() === startOfToday.getTime()) {
    return timeLabel;
  }

  if (startOfTarget.getTime() === startOfYesterday.getTime()) {
    return `Yesterday, ${timeLabel}`;
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: "relative",
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  headerBlock: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  headerMenuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  headerMenuButtonDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  headerTitle: {
    color: lightColors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: FONT_CANELA_TEXT_REGULAR,
  },
  headerTitleDark: {
    color: darkColors.textPrimary,
  },
  headerAuthor: {
    color: lightColors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  headerAuthorDark: {
    color: darkColors.textSecondary,
  },
  headerSubtitle: {
    marginTop: 4,
    color: lightColors.textMuted,
    fontSize: 13,
  },
  headerSubtitleDark: {
    color: darkColors.textSecondary,
  },
  statsRow: {
    marginTop: 12,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  statsRowDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  statItem: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: lightColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: lightColors.textMuted,
    marginTop: 2,
  },
  statLabelDark: {
    color: darkColors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: lightColors.border,
    marginHorizontal: 10,
  },
  searchWrap: {
    marginTop: 10,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchWrapDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.borderStrong,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: lightColors.textPrimary,
  },
  searchInputDark: {
    color: darkColors.textPrimary,
  },
  scrollContent: {
    paddingBottom: 110,
    gap: 12,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  insightsCardTouchable: {
    borderRadius: 16,
    overflow: "hidden",
  },
  insightsCardGradientBorder: {
    borderRadius: 16,
    padding: 2,
  },
  insightsCardInner: {
    borderRadius: 14,
    backgroundColor: lightColors.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  insightsCardInnerDark: {
    backgroundColor: darkColors.card,
  },
  insightsCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  insightsIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  insightsCardHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  insightsCardTitle: {
    fontSize: 17,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: lightColors.textPrimary,
  },
  insightsCardMeta: {
    fontSize: 12,
    color: lightColors.textMuted,
  },
  insightsCardPreview: {
    fontSize: 14,
    lineHeight: 21,
    color: lightColors.textSecondary,
  },
  insightsCardHeadline: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  insightsCardHint: {
    fontSize: 12,
    fontWeight: "700",
  },
  insightsModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  insightsReaderBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  insightsReaderSheet: {
    width: "100%",
    alignSelf: "center",
    backgroundColor: lightColors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: lightColors.border,
  },
  insightsReaderSheetDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  insightsReaderGrabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  insightsReaderTitle: {
    fontSize: 18,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: lightColors.textPrimary,
    flex: 1,
  },
  insightsReaderMeta: {
    fontSize: 12,
    color: lightColors.textMuted,
    marginBottom: 12,
  },
  insightsReaderScrollContent: {
    flexGrow: 1,
  },
  insightsReaderHeadline: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: lightColors.textPrimary,
    marginBottom: 14,
  },
  insightsReaderStatsGrid: {
    gap: 10,
    marginBottom: 18,
    width: "100%",
  },
  insightsReaderStatsSubRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  insightsReaderStatCell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: lightColors.background,
  },
  insightsReaderStatCellDark: {
    backgroundColor: darkColors.background,
  },
  insightsReaderStatValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  insightsReaderStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: lightColors.textMuted,
    marginTop: 4,
  },
  insightsSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: lightColors.textMuted,
    marginBottom: 10,
  },
  insightsFactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  insightsFactBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 8,
  },
  insightsFactText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: lightColors.textSecondary,
  },
  insightsKickerWrap: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    backgroundColor: "rgba(15,23,42,0.05)",
    borderRadius: 10,
  },
  insightsKickerWrapDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  insightsKickerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: lightColors.textSecondary,
  },
  insightsReaderBody: {
    fontSize: 15,
    lineHeight: 24,
    color: lightColors.textSecondary,
  },
  generatingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  generatingCard: {
    backgroundColor: lightColors.card,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  generatingCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  generatingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#334155",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
  },
  reportCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 14,
    gap: 4,
  },
  reportCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  reportSwipeDelete: {
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    borderRadius: 14,
    marginLeft: 8,
    gap: 4,
  },
  reportSwipeDeleteLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  reportHeaderRow: {
    position: "relative",
    justifyContent: "center",
    minHeight: 24,
    marginBottom: 2,
  },
  reportTitle: {
    color: lightColors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 21,
    paddingRight: 56,
    flexShrink: 1,
  },
  reportTitleDark: {
    color: darkColors.textPrimary,
  },
  reportTitleChapter: {
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  reportIndexPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reportIndexPillFixed: {
    position: "absolute",
    right: 0,
    top: 0,
    minWidth: 42,
    alignItems: "center",
  },
  reportIndexText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reportDate: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  reportDateDark: {
    color: darkColors.textSecondary,
  },
  reportMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  pagePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  pagePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reportSnippet: {
    color: lightColors.textSecondary,
    marginTop: 4,
  },
  reportSnippetDark: {
    color: darkColors.textSecondary,
  },
  matchWrap: {
    marginTop: 6,
    gap: 6,
  },
  reportMatchText: {
    fontSize: 12,
    fontWeight: "600",
  },
  matchBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  matchBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  optionsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 92,
    paddingRight: 18,
  },
  optionsSheet: {
    width: 230,
    borderRadius: 12,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    overflow: "hidden",
  },
  optionsSheetDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(148,163,184,0.35)",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  optionTextDark: {
    color: darkColors.textPrimary,
  },
  optionTextDanger: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
});
