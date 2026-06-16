import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
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
import { useNavigation, useRoute, StackActions } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { PdfExportToast, type PdfExportToastMode } from "../components/PdfExportToast";
import { BookReportsEmptyIllustration } from "../components/BookReportsEmptyIllustration";
import { useAppSettings } from "../context/AppSettingsContext";
import { useExportPreferences } from "../context/ExportPreferencesContext";
import { useScanContext } from "../context/ScanContext";
import { ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING } from "../navigation/rootTabLayout";
import type { LibraryStackParamList, RootTabParamList } from "../navigation/types";
import { navigateToScanHomeResettingLibrary } from "../navigation/navigateToScanHomeResettingLibrary";
import { requestOpenPageScanModal } from "../scan/pendingPageScanModal";
import { generateBookReportsInsights, themesFallbackFromFacts } from "../services/ai";
import { fetchBookPageCountFromApi } from "../services/openLibrary";
import type { BookInsightsSummary, ScanItem } from "../types/note";
import { pdfContentOptionsFromPrefs } from "../types/exportPreferences";
import { createAllBookReportsPdf, sanitizeFileBase } from "../utils/bookReportsPdf";
import { playSoundEffect } from "../utils/soundEffects";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";
import { darkColors, lightColors } from "../theme/colors";
import { hexWithAlpha } from "../theme/colorUtils";
import { FONT_CANELA_TEXT_BOLD } from "../theme/fonts";
import {
  countChaptersForBook,
  estimateBookPageTotal,
  maxScannedPageNumber,
  getCoveragePageRange,
  pagesScannedPercent,
} from "../utils/bookReadingProgress";

type Navigation = NativeStackNavigationProp<LibraryStackParamList, "BookReports">;
type Route = RouteProp<LibraryStackParamList, "BookReports">;

type ListFilterId = "all" | "byChapter" | "byDate";

type ReportListItem = { report: ScanItem; matches: string[] };

type ReportSection = { sectionKey: string; sectionLabel: string; items: ReportListItem[] };

type SectionTimelineRow = { kind: "insights" } | { kind: "report"; item: ReportListItem };

const CHIP_PAGES_GREEN = "#4ade80";
const CHIP_CHAPTERS_AMBER = "#fbbf24";

/** Two columns per row (even distribution). */
function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function formatRelativeScanTimeForHeader(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86400_000;
  if (d.getTime() >= startYesterday && d.getTime() < startToday) return "yesterday";
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatReportCardRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (t === t0) return "Today";
  if (t === t0 - 86400000) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function formatInsightsUpdatedLine(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const y = t0 - 86400000;
  let dayWord: string;
  if (t === t0) dayWord = "today";
  else if (t === y) dayWord = "yesterday";
  else dayWord = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `Updated ${dayWord} at ${time}`;
}

function dateSectionKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateSectionLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (t === t0) return "Today";
  if (t === t0 - 86400000) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function chapterStorageKey(report: ScanItem): string {
  return report.chapter?.trim() || "__uncat__";
}

function chapterDisplayLabel(key: string): string {
  return key === "__uncat__" ? "Uncategorized" : key;
}

function buildGroupedSections(
  items: ReportListItem[],
  listFilter: ListFilterId,
  mergeInsightsOnDate?: string | null
): ReportSection[] {
  if (listFilter === "byDate") {
    const bucketMap = new Map<string, { label: string; items: ReportListItem[]; sortMs: number }>();
    for (const it of items) {
      const key = dateSectionKey(it.report.createdAt);
      const ms = new Date(it.report.createdAt).getTime();
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { label: dateSectionLabel(it.report.createdAt), items: [], sortMs: ms });
      }
      const b = bucketMap.get(key)!;
      b.items.push(it);
      b.sortMs = Math.max(b.sortMs, ms);
    }
    if (mergeInsightsOnDate) {
      const ik = dateSectionKey(mergeInsightsOnDate);
      const ims = new Date(mergeInsightsOnDate).getTime();
      if (!bucketMap.has(ik)) {
        bucketMap.set(ik, { label: dateSectionLabel(mergeInsightsOnDate), items: [], sortMs: ims });
      } else {
        const b = bucketMap.get(ik)!;
        b.sortMs = Math.max(b.sortMs, ims);
      }
    }
    for (const b of bucketMap.values()) {
      b.items.sort((a, c) => new Date(c.report.createdAt).getTime() - new Date(a.report.createdAt).getTime());
    }
    return [...bucketMap.entries()]
      .sort((x, y) => y[1].sortMs - x[1].sortMs)
      .map(([sectionKey, b]) => ({ sectionKey, sectionLabel: b.label, items: b.items }));
  }
  const map = new Map<string, ReportListItem[]>();
  for (const it of items) {
    const k = chapterStorageKey(it.report);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => new Date(b.report.createdAt).getTime() - new Date(a.report.createdAt).getTime());
  }
  let keys = [...map.keys()];
  if (listFilter === "byChapter") {
    keys.sort((a, b) => chapterDisplayLabel(a).localeCompare(chapterDisplayLabel(b)));
  } else {
    keys.sort((a, b) => {
      const ta = Math.max(...(map.get(a) ?? []).map((x) => new Date(x.report.createdAt).getTime()), 0);
      const tb = Math.max(...(map.get(b) ?? []).map((x) => new Date(x.report.createdAt).getTime()), 0);
      return tb - ta;
    });
  }
  return keys.map((sectionKey) => ({
    sectionKey,
    sectionLabel: chapterDisplayLabel(sectionKey),
    items: map.get(sectionKey)!,
  }));
}

function buildSectionTimeline(
  sectionKey: string,
  items: ReportListItem[],
  listFilter: ListFilterId,
  insightsUpdatedAt: string | undefined
): SectionTimelineRow[] {
  if (listFilter !== "byDate" || !insightsUpdatedAt || dateSectionKey(insightsUpdatedAt) !== sectionKey) {
    return items.map((item) => ({ kind: "report" as const, item }));
  }
  const decorated: Array<{ row: SectionTimelineRow; at: number }> = [
    ...items.map((item) => ({
      row: { kind: "report" as const, item },
      at: new Date(item.report.createdAt).getTime(),
    })),
    { row: { kind: "insights" as const }, at: new Date(insightsUpdatedAt).getTime() },
  ];
  decorated.sort((a, b) => b.at - a.at);
  return decorated.map((d) => d.row);
}

export function BookReportsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { darkMode, accentColor } = useAppSettings();
  const exportPrefs = useExportPreferences();
  const {
    books,
    scans,
    removeBook,
    removeScan,
    toggleBookRead,
    setBookInsightsSummary,
    clearBookInsightsSummary,
    updateBookTotalPageCount,
    setActiveBookId,
  } = useScanContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<ListFilterId>("all");
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [insightsModalVisible, setInsightsModalVisible] = useState(false);
  const [insightsGenerating, setInsightsGenerating] = useState(false);
  const [pdfToastMode, setPdfToastMode] = useState<PdfExportToastMode | null>(null);
  const reportSwipeRefs = useRef<Record<string, ComponentRef<typeof Swipeable> | null>>({});
  const insightsSwipeRef = useRef<ComponentRef<typeof Swipeable> | null>(null);
  const bookReportsScrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);

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

  useEffect(() => {
    if (!book || book.totalPageCount != null || (book.chapterRanges?.length ?? 0) > 0) return;
    const controller = new AbortController();
    void fetchBookPageCountFromApi(
      { isbn: book.isbn, title: book.title, author: book.author },
      controller.signal
    ).then((pages) => {
      if (controller.signal.aborted || pages == null) return;
      updateBookTotalPageCount(book.id, pages);
    });
    return () => controller.abort();
  }, [
    book?.id,
    book?.isbn,
    book?.title,
    book?.author,
    book?.totalPageCount,
    book?.chapterRanges,
    updateBookTotalPageCount,
  ]);

  const closeOtherReportSwipes = (exceptId: string) => {
    Object.entries(reportSwipeRefs.current).forEach(([id, ref]) => {
      if (id !== exceptId) ref?.close();
    });
  };

  const closeAllReportSwipes = () => {
    Object.values(reportSwipeRefs.current).forEach((ref) => ref?.close());
  };

  const dismissOpenReportSwipes = useCallback(() => {
    closeAllReportSwipes();
    insightsSwipeRef.current?.close();
  }, []);

  const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  const hapticSelect = () => Haptics.selectionAsync().catch(() => {});

  const goToLibraryRoot = useCallback(() => {
    const state = navigation.getState();
    const libraryHomeIndex = state.routes.findIndex((route) => route.name === "LibraryHome");
    if (libraryHomeIndex >= 0 && state.index > libraryHomeIndex) {
      navigation.dispatch(StackActions.popToTop());
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("LibraryHome");
  }, [navigation]);

  const onScanFirstPage = useCallback(() => {
    hapticSelect();
    setActiveBookId(bookId);
    requestOpenPageScanModal(bookId);
    const tabNav = navigation.getParent<NavigationProp<RootTabParamList>>();
    navigateToScanHomeResettingLibrary(tabNav);
  }, [bookId, navigation, setActiveBookId]);

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

  const mergeInsightsDateKey =
    listFilter === "byDate" && !query && book?.insightsSummary ? book.insightsSummary.updatedAt : null;

  const groupedSections = useMemo(
    () => buildGroupedSections(filteredReports, listFilter, mergeInsightsDateKey),
    [filteredReports, listFilter, mergeInsightsDateKey]
  );

  const showListEmpty =
    filteredReports.length === 0 && !(listFilter === "byDate" && !query && Boolean(book?.insightsSummary));

  const coverageRange = useMemo(() => (book ? getCoveragePageRange(reports) : null), [book, reports]);
  const coveragePct = useMemo(() => (book ? pagesScannedPercent(book, reports) : 0), [book, reports]);
  const pagesReadCount = useMemo(() => maxScannedPageNumber(reports), [reports]);
  const chaptersCount = useMemo(() => (book ? countChaptersForBook(book, reports) : 0), [book, reports]);

  const headerMetaLine = useMemo(() => {
    if (reports.length === 0) return "No reports yet";
    const last = formatRelativeScanTimeForHeader(reports[0].createdAt);
    return `${reports.length} ${reports.length === 1 ? "report" : "reports"} · last scanned ${last}`;
  }, [reports]);

  const coverageLabelLeft = useMemo(() => {
    if (coverageRange) {
      return `Coverage · pp. ${coverageRange.min}–${coverageRange.max}`;
    }
    const total = book ? estimateBookPageTotal(book) : null;
    if (total) {
      return `Coverage · ${total} pages total`;
    }
    return "Coverage · add page numbers on scans";
  }, [coverageRange, book]);

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
            goToLibraryRoot();
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
      requestAnimationFrame(() => {
        bookReportsScrollRef.current?.scrollTo({ y: 0, animated: true });
      });
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

  const insightsThemesParagraph = useMemo(() => {
    const ins = book?.insightsSummary;
    if (!ins || !insightsIsStructured(ins)) return "";
    return ins.themesSynthesis?.trim() || themesFallbackFromFacts(ins.facts ?? []);
  }, [book?.insightsSummary]);

  const onExportAllReportsPdf = async () => {
    if (!book || reports.length === 0) {
      setOptionsVisible(false);
      Alert.alert("No reports", "There are no reports to export yet.");
      return;
    }
    setOptionsVisible(false);
    setPdfToastMode("loading");
    try {
      const uri = await createAllBookReportsPdf(book, reports, pdfContentOptionsFromPrefs(exportPrefs));
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

  const bd = useMemo(
    () =>
      darkMode
        ? {
            title: "#ffffff",
            authorBlue: accentColor,
            metaMuted: "rgba(255,255,255,0.35)",
            circleBg: "rgba(255,255,255,0.08)",
            circleBorder: "rgba(255,255,255,0.1)",
            circleIcon: "rgba(255,255,255,0.6)",
            chipBg: "rgba(255,255,255,0.05)",
            chipBorder: "rgba(255,255,255,0.08)",
            progressLabel: "rgba(255,255,255,0.3)",
            progressTrack: "rgba(255,255,255,0.08)",
            searchBg: "rgba(255,255,255,0.06)",
            searchBorder: "rgba(255,255,255,0.1)",
            searchIcon: "rgba(255,255,255,0.3)",
            searchPh: "rgba(255,255,255,0.25)",
            searchText: "#ffffff",
            pillSelBg: "rgba(255,255,255,0.12)",
            pillSelBorder: "rgba(255,255,255,0.2)",
            pillUnBg: "rgba(255,255,255,0.05)",
            pillUnBorder: "rgba(255,255,255,0.08)",
            pillTxtSel: "#ffffff",
            pillTxtUn: "rgba(255,255,255,0.35)",
            sectionLabel: "rgba(255,255,255,0.3)",
            cardBg: "rgba(255,255,255,0.05)",
            cardBorder: "rgba(255,255,255,0.08)",
            reportTitle: "#ffffff",
            pagePillBg: "rgba(255,255,255,0.06)",
            pagePillBorder: "rgba(255,255,255,0.1)",
            pagePillText: "rgba(255,255,255,0.4)",
            dateMuted: "rgba(255,255,255,0.25)",
            snippet: "rgba(255,255,255,0.4)",
            insightsBg: hexWithAlpha(accentColor, 0.08),
            insightsBorder: hexWithAlpha(accentColor, 0.2),
            insightsIconBg: hexWithAlpha(accentColor, 0.15),
            insightsTitle: "#ffffff",
            insightsMeta: "rgba(255,255,255,0.4)",
            insightsSnippet: "rgba(255,255,255,0.55)",
            insightsChevron: "rgba(255,255,255,0.2)",
            emptyIcon: "rgba(255,255,255,0.35)",
            emptyTitle: darkColors.textPrimary,
            emptyText: darkColors.textSecondary,
          }
        : {
            title: lightColors.textPrimary,
            authorBlue: accentColor,
            metaMuted: "rgba(0,0,0,0.35)",
            circleBg: "rgba(0,0,0,0.06)",
            circleBorder: "rgba(0,0,0,0.1)",
            circleIcon: "rgba(0,0,0,0.6)",
            chipBg: "#ffffff",
            chipBorder: "rgba(15,23,42,0.06)",
            progressLabel: "rgba(0,0,0,0.3)",
            progressTrack: "rgba(0,0,0,0.08)",
            searchBg: "#ffffff",
            searchBorder: "rgba(15,23,42,0.06)",
            searchIcon: "rgba(0,0,0,0.3)",
            searchPh: "rgba(0,0,0,0.25)",
            searchText: lightColors.textPrimary,
            pillSelBg: "rgba(0,0,0,0.08)",
            pillSelBorder: "rgba(0,0,0,0.2)",
            pillUnBg: "#ffffff",
            pillUnBorder: "rgba(15,23,42,0.06)",
            pillTxtSel: lightColors.textPrimary,
            pillTxtUn: "rgba(0,0,0,0.35)",
            sectionLabel: "rgba(0,0,0,0.3)",
            cardBg: "rgba(0,0,0,0.03)",
            cardBorder: "rgba(15,23,42,0.06)",
            reportTitle: lightColors.textPrimary,
            pagePillBg: "rgba(0,0,0,0.05)",
            pagePillBorder: "rgba(0,0,0,0.1)",
            pagePillText: "rgba(0,0,0,0.4)",
            dateMuted: "rgba(0,0,0,0.25)",
            snippet: "rgba(0,0,0,0.4)",
            insightsBg: hexWithAlpha(accentColor, 0.08),
            insightsBorder: hexWithAlpha(accentColor, 0.2),
            insightsIconBg: hexWithAlpha(accentColor, 0.15),
            insightsTitle: lightColors.textPrimary,
            insightsMeta: "rgba(0,0,0,0.4)",
            insightsSnippet: "rgba(0,0,0,0.55)",
            insightsChevron: "rgba(0,0,0,0.2)",
            emptyIcon: "rgba(0,0,0,0.35)",
            emptyTitle: lightColors.textPrimary,
            emptyText: lightColors.textSecondary,
          },
    [darkMode, accentColor]
  );

  const renderSwipeDeleteAction = (onPress: () => void, accessibilityLabel: string) => (
    <View style={styles.reportSwipeDeleteWrap}>
      <TouchableOpacity
        style={styles.reportSwipeDelete}
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name="trash-outline" size={22} color="#ffffff" />
        <Text style={styles.reportSwipeDeleteLabel}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReportCard = (entry: ReportListItem) => (
    <Swipeable
      ref={(r) => {
        reportSwipeRefs.current[entry.report.id] = r;
      }}
      friction={2}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        insightsSwipeRef.current?.close();
        closeOtherReportSwipes(entry.report.id);
      }}
      renderRightActions={() =>
        renderSwipeDeleteAction(() => onConfirmDeleteReport(entry.report), "Delete report")
      }
    >
      <TouchableOpacity
        style={[
          styles.newReportCard,
          !darkMode && styles.cardShadowLight,
          {
            backgroundColor: darkMode ? darkColors.card : lightColors.card,
            borderColor: bd.cardBorder,
          },
        ]}
        onPress={() =>
          navigation.navigate("ReportDetails", {
            item: entry.report,
            highlightQuery: query || undefined,
            reportNavOrigin: "library",
          })
        }
        activeOpacity={0.85}
      >
        <View style={styles.newReportTopRow}>
          <Text
            style={[
              styles.newReportTitle,
              { color: bd.reportTitle },
              entry.report.chapter?.trim() ? styles.reportTitleChapter : null,
            ]}
            numberOfLines={2}
          >
            {buildReportTitle(entry.report)}
          </Text>
          <View
            style={[
              styles.newReportBadge,
              { backgroundColor: hexWithAlpha(accentColor, 0.1), borderColor: hexWithAlpha(accentColor, 0.2) },
            ]}
          >
            <Text style={[styles.newReportBadgeText, { color: accentColor }]}>
              #{reportPillNumber(entry.report.id)}
            </Text>
          </View>
        </View>
        <View style={styles.newReportMetaRow}>
          <View style={[styles.newPagePill, { backgroundColor: bd.pagePillBg, borderColor: bd.pagePillBorder }]}>
            <Text style={[styles.newPagePillText, { color: bd.pagePillText }]}>
              {entry.report.page?.trim() ? `Page ${entry.report.page.trim()}` : "Page not set"}
            </Text>
          </View>
          <Text style={[styles.newReportDate, { color: bd.dateMuted }]}>
            {formatReportCardRelativeDate(entry.report.createdAt)}
          </Text>
        </View>
        <Text style={[styles.newReportSnippet, { color: bd.snippet }]} numberOfLines={2}>
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
  );

  const renderAiInsightsSwipeable = () => {
    if (!book?.insightsSummary) return null;
    const ins = book.insightsSummary;
    return (
      <Swipeable
        ref={insightsSwipeRef}
        friction={2}
        overshootRight={false}
        onSwipeableWillOpen={() => closeAllReportSwipes()}
        renderRightActions={() =>
          renderSwipeDeleteAction(onConfirmDeleteInsights, "Remove AI reading insights")
        }
      >
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setInsightsModalVisible(true)}
          style={[
            styles.aiInsightsCard,
            { backgroundColor: bd.insightsBg, borderColor: bd.insightsBorder },
          ]}
        >
          <View style={[styles.aiInsightsIconWrap, { backgroundColor: bd.insightsIconBg }]}>
            <Ionicons name="sparkles" size={15} color={accentColor} />
          </View>
          <View style={styles.aiInsightsTextCol}>
            <Text style={[styles.aiInsightsTitle, { color: bd.insightsTitle }]}>AI reading insights</Text>
            <Text style={[styles.aiInsightsMeta, { color: bd.insightsMeta }]}>
              {formatInsightsUpdatedLine(ins.updatedAt)}
            </Text>
            {insightsIsStructured(ins) ? (
              <Text style={[styles.aiInsightsSnippet, { color: bd.insightsSnippet }]} numberOfLines={1}>
                {ins.headline}
              </Text>
            ) : (
              <Text style={[styles.aiInsightsSnippet, { color: bd.insightsSnippet }]} numberOfLines={1}>
                {ins.body ?? ""}
              </Text>
            )}
            <Text style={[styles.aiInsightsTap, { color: accentColor }]}>Tap for full insights</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={bd.insightsChevron} />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <ScrollView
        ref={bookReportsScrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, styles.scrollContentMain]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={dismissOpenReportSwipes}
        onMomentumScrollBegin={dismissOpenReportSwipes}
      >
        <View style={styles.detailHeaderRow}>
          <TouchableOpacity
            style={[
              styles.detailIconCircle,
              styles.detailBackBtn,
              { backgroundColor: bd.circleBg, borderColor: bd.circleBorder },
            ]}
            onPress={() => {
              hapticLight();
              goToLibraryRoot();
            }}
            activeOpacity={0.82}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Back to library"
          >
            <Ionicons name="chevron-back" size={18} color={bd.circleIcon} />
          </TouchableOpacity>
          <View style={styles.detailHeaderTextCol}>
            <Text style={[styles.detailBookTitle, { color: bd.title }]} numberOfLines={3}>
              {book ? book.title : "Book Reports"}
            </Text>
            <Text style={[styles.detailAuthor, { color: bd.authorBlue }]} numberOfLines={1}>
              {book?.author ?? "Unknown author"}
            </Text>
            <Text style={[styles.detailMetaLine, { color: bd.metaMuted }]}>{headerMetaLine}</Text>
          </View>
          <View style={styles.detailHeaderActions}>
            <TouchableOpacity
              style={[
                styles.detailIconCircle,
                { backgroundColor: bd.circleBg, borderColor: bd.circleBorder },
                reports.length === 0 && styles.detailIconCircleDisabled,
              ]}
              onPress={() => {
                hapticLight();
                void onExportAllReportsPdf();
              }}
              disabled={reports.length === 0}
              activeOpacity={0.82}
              hitSlop={4}
            >
              <Ionicons name="share-outline" size={18} color={bd.circleIcon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.detailIconCircle, { backgroundColor: bd.circleBg, borderColor: bd.circleBorder }]}
              onPress={() => {
                hapticLight();
                setOptionsVisible(true);
              }}
              activeOpacity={0.82}
              hitSlop={4}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={bd.circleIcon} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statChipsRow}>
          <View style={[styles.statChip, !darkMode && styles.cardShadowLight, { backgroundColor: bd.chipBg, borderColor: bd.chipBorder }]}>
            <Text style={[styles.statChipValue, { color: accentColor }]}>{reports.length}</Text>
            <Text style={[styles.statChipLabel, { color: bd.metaMuted }]}>Reports</Text>
          </View>
          <View style={[styles.statChip, !darkMode && styles.cardShadowLight, { backgroundColor: bd.chipBg, borderColor: bd.chipBorder }]}>
            <Text style={[styles.statChipValue, { color: CHIP_PAGES_GREEN }]}>{pagesReadCount}</Text>
            <Text style={[styles.statChipLabel, { color: bd.metaMuted }]}>Pages read</Text>
          </View>
          <View style={[styles.statChip, !darkMode && styles.cardShadowLight, { backgroundColor: bd.chipBg, borderColor: bd.chipBorder }]}>
            <Text style={[styles.statChipValue, { color: CHIP_CHAPTERS_AMBER }]}>{chaptersCount}</Text>
            <Text style={[styles.statChipLabel, { color: bd.metaMuted }]}>Chapters</Text>
          </View>
        </View>

        <View style={styles.coverageBlock}>
          <View style={styles.coverageHeaderRow}>
            <Text style={[styles.coverageHeaderText, { color: bd.progressLabel }]} numberOfLines={1}>
              {coverageLabelLeft}
            </Text>
            <Text style={[styles.coveragePctText, { color: bd.progressLabel }]}>{coveragePct}%</Text>
          </View>
          <View style={[styles.coverageTrack, { backgroundColor: bd.progressTrack }]}>
            <View style={[styles.coverageFill, { width: `${coveragePct}%`, backgroundColor: accentColor }]} />
          </View>
        </View>

        <View style={[styles.detailSearchBar, !darkMode && styles.cardShadowLight, { backgroundColor: bd.searchBg, borderColor: bd.searchBorder }]}>
          <Ionicons name="search-outline" size={16} color={bd.searchIcon} style={styles.detailSearchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search keyword in reports..."
            placeholderTextColor={bd.searchPh}
            style={[styles.detailSearchInput, { color: bd.searchText }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.listFilterPillsRow}>
          {(
            [
              { id: "all" as const, label: "All" },
              { id: "byChapter" as const, label: "By chapter" },
              { id: "byDate" as const, label: "By date" },
            ] as const
          ).map((pill) => {
            const selected = listFilter === pill.id;
            return (
              <Pressable
                key={pill.id}
                onPress={() => {
                  hapticSelect();
                  setListFilter(pill.id);
                }}
                style={[
                  styles.listFilterPill,
                  !darkMode && !selected && styles.cardShadowLight,
                  {
                    backgroundColor: selected ? bd.pillSelBg : bd.pillUnBg,
                    borderColor: selected ? bd.pillSelBorder : bd.pillUnBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.listFilterPillText,
                    { color: selected ? bd.pillTxtSel : bd.pillTxtUn },
                  ]}
                >
                  {pill.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!query && book?.insightsSummary && listFilter !== "byDate" ? renderAiInsightsSwipeable() : null}

        {showListEmpty ? (
          <View style={styles.emptyWrap}>
            {query ? (
              <>
                <Ionicons name="search-outline" size={44} color={bd.emptyIcon} />
                <Text style={[styles.emptyTitle, { color: bd.emptyTitle }]}>No matching reports</Text>
                <Text style={[styles.emptyText, { color: bd.emptyText }]}>
                  Try another keyword to find where it appears.
                </Text>
              </>
            ) : (
              <View style={styles.emptyContent}>
                <BookReportsEmptyIllustration darkMode={darkMode} accentColor={accentColor} />
                <View style={styles.emptyTextBlock}>
                  <Text style={[styles.emptyTitle, { color: bd.emptyTitle }]}>No reports yet</Text>
                  <Text style={[styles.emptySubtitle, darkMode && styles.emptySubtitleDark]}>
                    Scan a page from this book and AI will extract the ideas, quotes and summaries.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.emptyScanBtn}
                  onPress={onScanFirstPage}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Scan your first page"
                >
                  <Ionicons name="camera-outline" size={15} color="#111111" />
                  <Text style={styles.emptyScanBtnText}>Scan your first page</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          groupedSections.map((section, sIdx) => (
            <View
              key={section.sectionKey}
              style={[styles.reportSection, sIdx < groupedSections.length - 1 && styles.reportSectionSpaced]}
            >
              <Text style={[styles.reportSectionLabel, { color: bd.sectionLabel }]}>{section.sectionLabel}</Text>
              <View style={styles.reportSectionCards}>
                {buildSectionTimeline(
                  section.sectionKey,
                  section.items,
                  listFilter,
                  !query ? book?.insightsSummary?.updatedAt : undefined
                ).map((row) =>
                  row.kind === "insights" ? (
                    <Fragment key={`insights-${section.sectionKey}`}>{renderAiInsightsSwipeable()}</Fragment>
                  ) : (
                    <Fragment key={row.item.report.id}>{renderReportCard(row.item)}</Fragment>
                  )
                )}
              </View>
            </View>
          ))
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
              showsVerticalScrollIndicator={false}
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
                  {formatInsightsUpdatedLine(book.insightsSummary.updatedAt)}
                </Text>
              ) : null}
              {book?.insightsSummary && insightsIsStructured(book.insightsSummary) ? (
                <>
                  <Text
                    style={[
                      styles.insightsReaderHeadline,
                      darkMode ? styles.insightsReaderHeadlineDark : styles.insightsReaderHeadlineLight,
                    ]}
                  >
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
                              darkMode ? styles.insightsReaderStatCellDark : styles.insightsReaderStatCellLight,
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
                  {insightsThemesParagraph ? (
                    <>
                      <Text
                        style={[
                          styles.insightsModalSectionLabel,
                          !darkMode && styles.insightsModalSectionLabelLight,
                          styles.insightsModalSectionLabelThemes,
                        ]}
                      >
                        Themes
                      </Text>
                      <View
                        style={[
                          styles.insightsThemesCard,
                          darkMode ? styles.insightsThemesCardDark : styles.insightsThemesCardLight,
                        ]}
                      >
                        <Text
                          style={[
                            styles.insightsThemesBody,
                            darkMode ? styles.insightsThemesBodyDark : styles.insightsThemesBodyLight,
                          ]}
                        >
                          {insightsThemesParagraph}
                        </Text>
                      </View>
                    </>
                  ) : null}
                  <Text
                    style={[
                      styles.insightsModalSectionLabel,
                      !darkMode && styles.insightsModalSectionLabelLight,
                      insightsThemesParagraph
                        ? styles.insightsModalSectionLabelAfterThemes
                        : styles.insightsModalSectionLabelAfterStats,
                    ]}
                  >
                    Highlights
                  </Text>
                  {(book.insightsSummary.facts ?? []).map((fact, idx) => (
                    <View key={`${idx}-${fact.slice(0, 12)}`} style={styles.insightsFactRow}>
                      <View
                        style={[
                          styles.insightsFactBullet,
                          darkMode ? styles.insightsFactBulletDark : styles.insightsFactBulletLight,
                        ]}
                      />
                      <Text style={[styles.insightsFactText, darkMode && styles.reportSnippetDark]}>{fact}</Text>
                    </View>
                  ))}
                  <View style={[styles.insightsKickerWrap, darkMode && styles.insightsKickerWrapDark]}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: "relative",
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  detailBackBtn: {
    marginTop: 2,
    flexShrink: 0,
  },
  detailHeaderTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  detailBookTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  detailAuthor: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
  },
  detailMetaLine: {
    fontSize: 11,
    marginTop: 6,
  },
  detailHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  detailIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  detailIconCircleDisabled: {
    opacity: 0.4,
  },
  statChipsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 0.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  cardShadowLight: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statChipValue: {
    fontSize: 20,
    fontWeight: "600",
  },
  statChipLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  coverageBlock: {
    gap: 0,
  },
  coverageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  coverageHeaderText: {
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
    minWidth: 0,
  },
  coverageTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  coveragePctText: {
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 0,
  },
  coverageFill: {
    height: 3,
    borderRadius: 2,
    minWidth: 0,
  },
  detailSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  detailSearchIcon: {
    marginRight: 8,
  },
  detailSearchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
    margin: 0,
  },
  listFilterPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  listFilterPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 0.5,
  },
  listFilterPillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  aiInsightsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 13,
  },
  aiInsightsIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  aiInsightsTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  aiInsightsTitle: {
    fontSize: 14,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  aiInsightsMeta: {
    fontSize: 11,
  },
  aiInsightsSnippet: {
    fontSize: 11,
    marginTop: 2,
  },
  aiInsightsTap: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  reportSection: {},
  reportSectionSpaced: {
    marginBottom: 14,
  },
  reportSectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  reportSectionCards: {
    gap: 8,
  },
  newReportCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  newReportTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  newReportTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18.2,
    minWidth: 0,
    paddingRight: 6,
  },
  newReportBadge: {
    borderRadius: 10,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 2,
    flexShrink: 0,
  },
  newReportBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  newReportMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  newPagePill: {
    borderRadius: 6,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newPagePillText: {
    fontSize: 11,
    fontWeight: "500",
  },
  newReportDate: {
    fontSize: 11,
    fontWeight: "500",
  },
  newReportSnippet: {
    fontSize: 11,
    lineHeight: 15.4,
  },
  scrollContent: {
    paddingBottom: ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING,
  },
  scrollContentMain: {
    gap: 14,
    flexGrow: 1,
  },
  headerTitleDark: {
    color: darkColors.textPrimary,
  },
  insightsModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  insightsReaderBackdropFill: {
    ...StyleSheet.absoluteFill,
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
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400",
    marginBottom: 14,
  },
  insightsReaderHeadlineLight: {
    color: "rgba(15,23,42,0.7)",
  },
  insightsReaderHeadlineDark: {
    color: "rgba(255,255,255,0.7)",
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
    borderWidth: 0.5,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  insightsReaderStatCellDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  insightsReaderStatCellLight: {
    backgroundColor: "rgba(0,0,0,0.035)",
    borderColor: "rgba(0,0,0,0.08)",
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
  insightsModalSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 11 * 0.07,
    color: "rgba(255,255,255,0.3)",
    marginBottom: 8,
    marginTop: 0,
  },
  insightsModalSectionLabelLight: {
    color: "rgba(0,0,0,0.3)",
  },
  insightsModalSectionLabelThemes: {
    marginTop: 4,
  },
  insightsModalSectionLabelAfterStats: {
    marginTop: 6,
  },
  insightsModalSectionLabelAfterThemes: {
    marginTop: 0,
  },
  insightsThemesCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 16,
  },
  insightsThemesCardDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  insightsThemesCardLight: {
    backgroundColor: "rgba(0,0,0,0.035)",
    borderColor: "rgba(0,0,0,0.08)",
  },
  insightsThemesBody: {
    fontSize: 13,
    lineHeight: 20.8,
    fontStyle: "italic",
    fontWeight: "400",
  },
  insightsThemesBodyDark: {
    color: "rgba(255,255,255,0.65)",
  },
  insightsThemesBodyLight: {
    color: "rgba(15,23,42,0.65)",
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
  insightsFactBulletDark: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  insightsFactBulletLight: {
    backgroundColor: "rgba(0,0,0,0.35)",
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
    borderLeftColor: "#f59e0b",
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
    gap: 8,
    paddingTop: 28,
    paddingBottom: 24,
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyTextBlock: {
    alignItems: "center",
    marginTop: 16,
    gap: 6,
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
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 19.2,
    fontWeight: "400",
    color: "rgba(15,23,42,0.4)",
    textAlign: "center",
    maxWidth: 200,
  },
  emptySubtitleDark: {
    color: "rgba(255,255,255,0.4)",
  },
  emptyScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  emptyScanBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111111",
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
  reportSwipeDeleteWrap: {
    width: 88,
    marginLeft: 8,
    alignSelf: "stretch",
  },
  reportSwipeDelete: {
    flex: 1,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
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
    fontSize: 15,
    lineHeight: 20,
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
