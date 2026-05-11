import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { PdfExportToast, type PdfExportToastMode } from "../components/PdfExportToast";
import { ReportStudySettingsModal } from "../components/ReportStudySettingsModal";
import { RichNoteText } from "../components/RichNoteText";
import { useAppSettings } from "../context/AppSettingsContext";
import { useExportPreferences } from "../context/ExportPreferencesContext";
import { useScanContext } from "../context/ScanContext";
import type { LibraryStackParamList, RootTabParamList, ScanStackParamList } from "../navigation/types";
import type { ExtractionMode, ScanItem } from "../types/note";
import { pdfContentOptionsFromPrefs } from "../types/exportPreferences";
import { DEFAULT_STUDY_PREFERENCES, type StudyPreferencesSnapshot } from "../types/studyPreferences";
import { labelLength, labelTone } from "../study/studyPreferenceLabels";
import {
  createSingleReportPdf,
  sanitizeFileBase,
  singleReportShareLabel,
} from "../utils/bookReportsPdf";
import { playSoundEffect } from "../utils/soundEffects";
import { splitCaseInsensitive } from "../utils/splitCaseInsensitive";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";
import { darkColors, lightColors } from "../theme/colors";
import { FONT_CANELA_TEXT_BOLD } from "../theme/fonts";

const COPIED_TOAST_H = 32;
const COPIED_TOAST_W_START = 32;
const COPIED_TOAST_W_END = 228;
/** Hold at circle before widening; expand duration — keep toast visible long enough for both. */
const COPIED_TOAST_HOLD_MS = 280;
const COPIED_TOAST_EXPAND_MS = 650;
const COPIED_TOAST_VISIBLE_MS =
  COPIED_TOAST_HOLD_MS + COPIED_TOAST_EXPAND_MS + 1800;

type Props = NativeStackScreenProps<LibraryStackParamList, "ReportDetails">;

type CopySectionKey =
  | "summary"
  | "bulletPoints"
  | "detailedNotes"
  | "reinforcedIdeas"
  | "quotes"
  | "keywords";
function pushCopySection(lines: string[], title: string, body: string | string[]) {
  lines.push(title);
  if (Array.isArray(body)) {
    if (body.length === 0) {
      lines.push("-");
    } else {
      body.forEach((entry) => lines.push(`- ${entry}`));
    }
  } else {
    lines.push(body.trim() || "-");
  }
  lines.push("");
}

function buildReportHeaderLines(item: ScanItem, createdLabel: string): string[] {
  const lines: string[] = [];
  lines.push(item.book ?? "Report");
  lines.push(createdLabel);
  if (item.chapter?.trim()) lines.push(`Chapter: ${item.chapter.trim()}`);
  if (item.page?.trim()) lines.push(`Page: ${item.page.trim()}`);
  lines.push("");
  return lines;
}

const EXTRACTION_LABELS: Record<ExtractionMode, string> = {
  quotes: "Quotes",
  words: "Words",
  bulletPoints: "Bullet Points",
  everything: "Everything",
};

function getExtractionModes(itemMode?: ExtractionMode, itemModes?: ExtractionMode[]) {
  return itemModes && itemModes.length > 0 ? itemModes : [itemMode ?? "everything"];
}

function formatExtractionLabel(modes: ExtractionMode[]) {
  if (modes.includes("everything")) return EXTRACTION_LABELS.everything;
  return modes.map((mode) => EXTRACTION_LABELS[mode]).join(" + ");
}

const RPT = {
  blue: "#60a5fa",
  blueBg: "rgba(59,130,246,0.12)",
  blueMutedBg: "rgba(59,130,246,0.08)",
  purple: "#a855f7",
  purpleBg: "rgba(168,85,247,0.12)",
  amber: "#fbbf24",
  amberBg: "rgba(251,191,36,0.12)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.1)",
  slate: "#94a3b8",
  slateBg: "rgba(148,163,184,0.12)",
  primaryBtn: "#2563eb",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.12)",
};

function formatReportMetaTime(d: Date): string {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today, ${timeStr}`;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function keywordSentenceCase(raw: string): string {
  const t = stripMarkdownBoldMarkers(raw).trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function ReportDetailsScreen({ route, navigation }: Props) {
  const { darkMode, accentColor } = useAppSettings();
  const exportPrefs = useExportPreferences();
  const insets = useSafeAreaInsets();
  const { removeScan, books, scans, updateScan } = useScanContext();
  const { item: routeItem, highlightQuery } = route.params;
  const item = useMemo(
    () => scans.find((s) => s.id === routeItem.id) ?? routeItem,
    [scans, routeItem],
  );
  const bookForReport = useMemo(
    () => (item.bookId ? books.find((b) => b.id === item.bookId) : undefined),
    [books, item.bookId],
  );
  const reportBookTitle = bookForReport?.title ?? item.book ?? "Report";
  const chapterHeadline = item.chapter?.trim() || "This page";
  const studyPrefsUsed = item.studyPreferences ?? DEFAULT_STUDY_PREFERENCES;
  const extractionModes = getExtractionModes(item.extractionMode, item.extractionModes);
  const showEverything = extractionModes.includes("everything");
  const showSummary = showEverything;
  const showMainIdeas = showEverything || extractionModes.includes("bulletPoints");
  const showDetailedNotes = showEverything;
  const showQuotes = showEverything || extractionModes.includes("quotes");
  const showKeywords = showEverything || extractionModes.includes("words");
  const showVocabularyDefinitions = !showEverything && extractionModes.includes("words");

  const onDeleteReport = useCallback(() => {
    Alert.alert(
      "Delete report",
      "This report will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            removeScan(item.id);
            navigation.goBack();
          },
        },
      ]
    );
  }, [item.id, navigation, removeScan]);

  const createdAt = new Date(item.createdAt);
  const createdLabel = createdAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const readingMinutes = Math.max(1, Math.round((item.notes.detailedNotes.length || 120) / 900));
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [highlightActive, setHighlightActive] = useState(Boolean(highlightQuery));
  /** Keyword chip tap: highlight this term everywhere until user taps to dismiss. */
  const [keywordTapHighlight, setKeywordTapHighlight] = useState<string | null>(null);
  /** When true, each section header shows a copy control for that section only. */
  const [sectionCopyMode, setSectionCopyMode] = useState(false);
  const [studySettingsModalVisible, setStudySettingsModalVisible] = useState(false);
  const [copiedToastVisible, setCopiedToastVisible] = useState(false);
  const [pdfToastMode, setPdfToastMode] = useState<PdfExportToastMode | null>(null);
  const copiedToastExpand = useRef(new Animated.Value(0)).current;
  const [pageEditorOpen, setPageEditorOpen] = useState(false);
  const [pageDraft, setPageDraft] = useState("");
  const missingPage = !item.page?.trim();

  const studySettingTags = useMemo(
    () => [
      labelTone(studyPrefsUsed.tone),
      labelLength(studyPrefsUsed.length),
      studyPrefsUsed.highlightKeyTerms ? "Key terms" : "No key terms",
    ],
    [studyPrefsUsed]
  );

  const sheet = useMemo(
    () =>
      darkMode
        ? {
            screenBg: darkColors.background,
            navCircle: "rgba(255,255,255,0.08)",
            navIconMuted: "rgba(255,255,255,0.6)",
            breadcrumb: "rgba(255,255,255,0.4)",
            chapter: "#ffffff",
            pillBg: "rgba(255,255,255,0.06)",
            pillBorder: "rgba(255,255,255,0.1)",
            pillText: "rgba(255,255,255,0.4)",
            extractPillBg: "rgba(59,130,246,0.1)",
            extractPillBorder: "rgba(59,130,246,0.35)",
            extractPillText: RPT.blue,
            headerRule: "rgba(255,255,255,0.07)",
            studyRowBg: "rgba(255,255,255,0.04)",
            studyRowBorder: "rgba(255,255,255,0.07)",
            studyIcon: "rgba(255,255,255,0.4)",
            studyLabel: "rgba(255,255,255,0.3)",
            studyTagBg: "rgba(255,255,255,0.06)",
            studyTagText: "rgba(255,255,255,0.35)",
            studyChevron: "rgba(255,255,255,0.2)",
            sectionCardBg: "rgba(255,255,255,0.05)",
            sectionCardBorder: "rgba(255,255,255,0.08)",
            sectionHeaderRule: "rgba(255,255,255,0.06)",
            sectionTitle: "#ffffff",
            bodyMuted: "rgba(255,255,255,0.7)",
            quoteMuted: "rgba(255,255,255,0.6)",
            actionBarBg: darkColors.background,
            actionBarBorder: "rgba(255,255,255,0.07)",
            actionSecondaryBg: "rgba(255,255,255,0.07)",
            actionSecondaryBorder: "rgba(255,255,255,0.1)",
            actionSecondaryLabel: "rgba(255,255,255,0.6)",
          }
        : {
            screenBg: lightColors.background,
            navCircle: "rgba(15,23,42,0.06)",
            navIconMuted: "rgba(15,23,42,0.55)",
            breadcrumb: "rgba(15,23,42,0.45)",
            chapter: lightColors.textPrimary,
            pillBg: "rgba(15,23,42,0.06)",
            pillBorder: "rgba(15,23,42,0.1)",
            pillText: "rgba(15,23,42,0.5)",
            extractPillBg: "rgba(59,130,246,0.08)",
            extractPillBorder: "rgba(37,99,235,0.25)",
            extractPillText: "#2563eb",
            headerRule: "rgba(15,23,42,0.08)",
            studyRowBg: "rgba(15,23,42,0.04)",
            studyRowBorder: "rgba(15,23,42,0.08)",
            studyIcon: "rgba(15,23,42,0.45)",
            studyLabel: "rgba(15,23,42,0.35)",
            studyTagBg: "rgba(15,23,42,0.06)",
            studyTagText: "rgba(15,23,42,0.45)",
            studyChevron: "rgba(15,23,42,0.25)",
            sectionCardBg: lightColors.card,
            sectionCardBorder: "rgba(15,23,42,0.1)",
            sectionHeaderRule: "rgba(15,23,42,0.08)",
            sectionTitle: lightColors.textPrimary,
            bodyMuted: "rgba(15,23,42,0.75)",
            quoteMuted: "rgba(15,23,42,0.65)",
            actionBarBg: lightColors.card,
            actionBarBorder: "rgba(15,23,42,0.1)",
            actionSecondaryBg: "rgba(15,23,42,0.05)",
            actionSecondaryBorder: "rgba(15,23,42,0.12)",
            actionSecondaryLabel: "rgba(15,23,42,0.65)",
          },
    [darkMode]
  );

  const pdfShareDialogTitle = useMemo(
    () => `Export ${sanitizeFileBase(singleReportShareLabel(item, bookForReport ?? null))}`,
    [item, bookForReport],
  );

  const onExportReportPdf = useCallback(async () => {
    setPdfToastMode("loading");
    try {
      const uri = await createSingleReportPdf(
        item,
        bookForReport ?? null,
        pdfContentOptionsFromPrefs(exportPrefs)
      );
      setPdfToastMode({ type: "ready", uri });
    } catch (e) {
      setPdfToastMode(null);
      const message = e instanceof Error ? e.message : "Could not create the PDF.";
      Alert.alert("Export failed", message);
    }
  }, [item, bookForReport, exportPrefs]);

  const onPdfToastDismissComplete = useCallback(() => {
    setPdfToastMode(null);
  }, []);

  const onSaveManualPage = useCallback(() => {
    const trimmed = pageDraft.trim();
    if (!trimmed) return;
    updateScan(item.id, { page: trimmed });
    setPageEditorOpen(false);
    setPageDraft("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [item.id, pageDraft, updateScan]);

  const normalizedQuery = useMemo(
    () => (highlightQuery ?? "").trim().toLowerCase(),
    [highlightQuery]
  );
  const accentRgb = useMemo(() => hexToRgb(accentColor), [accentColor]);

  const matchedSection = useMemo(() => {
    if (!normalizedQuery) return null;
    if (showSummary && item.notes.summary.toLowerCase().includes(normalizedQuery)) return "summary";
    if (showMainIdeas && item.notes.mainIdeas.some((idea) => idea.toLowerCase().includes(normalizedQuery)))
      return "mainIdeas";
    if (showDetailedNotes && item.notes.detailedNotes.toLowerCase().includes(normalizedQuery)) return "detailedNotes";
    const quotes = item.notes.quotes ?? [];
    if (showQuotes && quotes.some((q) => q.toLowerCase().includes(normalizedQuery))) return "quotes";
    const vocabularyTerms = item.notes.vocabularyTerms ?? [];
    if (
      showKeywords &&
      vocabularyTerms.some(
        (term) =>
          term.word.toLowerCase().includes(normalizedQuery) ||
          term.definition.toLowerCase().includes(normalizedQuery)
      )
    )
      return "keywords";
    if (
      showKeywords &&
      item.notes.keywords.some((k) =>
        stripMarkdownBoldMarkers(k).toLowerCase().includes(normalizedQuery)
      )
    )
      return "keywords";
    return null;
  }, [item.notes, normalizedQuery, showDetailedNotes, showKeywords, showMainIdeas, showQuotes, showSummary]);

  useEffect(() => {
    if (!normalizedQuery) return;
    setHighlightActive(true);
    const timer = setTimeout(() => setHighlightActive(false), 3600);
    return () => clearTimeout(timer);
  }, [normalizedQuery]);

  useEffect(() => {
    if (!matchedSection) return;
    const y = sectionY.current[matchedSection];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  }, [matchedSection]);

  useEffect(() => {
    if (!copiedToastVisible) {
      copiedToastExpand.setValue(0);
      return;
    }
    copiedToastExpand.setValue(0);
    Animated.sequence([
      Animated.delay(COPIED_TOAST_HOLD_MS),
      Animated.timing(copiedToastExpand, {
        toValue: 1,
        duration: COPIED_TOAST_EXPAND_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
    const t = setTimeout(() => setCopiedToastVisible(false), COPIED_TOAST_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [copiedToastVisible, copiedToastExpand]);

  const copiedToastWidth = copiedToastExpand.interpolate({
    inputRange: [0, 1],
    outputRange: [COPIED_TOAST_W_START, COPIED_TOAST_W_END],
  });
  const copiedToastRadius = copiedToastExpand.interpolate({
    inputRange: [0, 1],
    outputRange: [COPIED_TOAST_H / 2, 999],
  });
  const copiedToastPadH = copiedToastExpand.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 4, 12],
  });
  const copiedToastTextOpacity = copiedToastExpand.interpolate({
    inputRange: [0, 0.42, 0.72, 1],
    outputRange: [0, 0, 1, 1],
  });
  /** Reveal label with maxWidth so the row stays only as wide as the copy + icon (centers in pill). */
  const copiedToastLabelMaxWidth = copiedToastExpand.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [0, 0, 280],
  });
  const copiedToastLabelSlotMargin = copiedToastExpand.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [0, 0, 6],
  });

  const onCopySucceeded = useCallback(() => {
    setSectionCopyMode(false);
    setCopiedToastVisible(true);
  }, []);

  const runSectionCopy = useCallback(
    async (key: CopySectionKey) => {
      const lines = [...buildReportHeaderLines(item, createdLabel)];

      if (key === "summary") {
        if (!showSummary) return;
        pushCopySection(lines, "Summary", stripMarkdownBoldMarkers(item.notes.summary));
      } else if (key === "bulletPoints") {
        if (!showMainIdeas) return;
        pushCopySection(
          lines,
          "Bullet Points",
          item.notes.mainIdeas.map((idea) => stripMarkdownBoldMarkers(idea))
        );
      } else if (key === "detailedNotes") {
        if (!showDetailedNotes) return;
        pushCopySection(lines, "Detailed Notes", stripMarkdownBoldMarkers(item.notes.detailedNotes));
      } else if (key === "reinforcedIdeas") {
        if (!item.reinforcedIdeas?.length) return;
        pushCopySection(
          lines,
          "Reinforced Ideas",
          item.reinforcedIdeas.map((match) => {
            const idea = stripMarkdownBoldMarkers(match.idea);
            return match.matchedPage ? `${idea} (also seen on page ${match.matchedPage})` : idea;
          })
        );
      } else if (key === "quotes") {
        if (!showQuotes) return;
        const quotes = item.notes.quotes ?? [];
        pushCopySection(
          lines,
          "Quotes",
          quotes.map((quote) => stripMarkdownBoldMarkers(quote))
        );
      } else if (key === "keywords") {
        if (!showKeywords) return;
        const sectionLabel = showEverything ? "Keywords" : "Words";
        if (showVocabularyDefinitions && item.notes.vocabularyTerms && item.notes.vocabularyTerms.length > 0) {
          pushCopySection(
            lines,
            sectionLabel,
            item.notes.vocabularyTerms.map(
              (term) =>
                `${stripMarkdownBoldMarkers(term.word)}: ${stripMarkdownBoldMarkers(term.definition)}`
            )
          );
        } else {
          pushCopySection(
            lines,
            sectionLabel,
            item.notes.keywords.map((keyword) => stripMarkdownBoldMarkers(keyword))
          );
        }
      }

      await Clipboard.setStringAsync(lines.join("\n").trim());
      playSoundEffect("aiExtractionCompleted");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCopySucceeded();
    },
    [
      item,
      createdLabel,
      showSummary,
      showMainIdeas,
      showDetailedNotes,
      showQuotes,
      showKeywords,
      showEverything,
      showVocabularyDefinitions,
      onCopySucceeded,
    ]
  );

  const openOverflowMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const runDelete = () => onDeleteReport();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Delete report", "Cancel"],
          cancelButtonIndex: 1,
          destructiveButtonIndex: 0,
        },
        (idx) => {
          if (idx === 0) runDelete();
        }
      );
    } else {
      Alert.alert("Report", undefined, [
        { text: "Delete report", style: "destructive", onPress: runDelete },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [onDeleteReport]);

  const openStudySettingsModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStudySettingsModalVisible(true);
  }, []);

  const onStudyPrefsContinueToExtract = useCallback(
    (prefs: StudyPreferencesSnapshot) => {
      setStudySettingsModalVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const params: ScanStackParamList["ExtractionOptions"] = {
        imageUri: item.imageUri,
        ...(item.page?.trim() ? { page: item.page.trim() } : {}),
        ...(item.chapter?.trim() ? { chapter: item.chapter.trim() } : {}),
        rescanForScanId: item.id,
        studyPreferences: prefs,
        rescanReturnTab: "library",
      };
      /** Report details only lives on the Library stack; its parent is the root tab. */
      const tabNav = navigation.getParent() as NavigationProp<RootTabParamList> | undefined;
      tabNav?.navigate("ScanFlow", { screen: "ExtractionOptions", params });
    },
    [item.chapter, item.id, item.imageUri, item.page, navigation]
  );

  const showSearchHighlight = Boolean(normalizedQuery) && highlightActive;
  const keywordNeedle = keywordTapHighlight?.trim() ?? "";

  const renderBodyText = (text: string, baseStyle: any) => {
    if (showSearchHighlight) {
      return renderHighlightedText(text, baseStyle);
    }
    if (keywordNeedle.length > 0) {
      return renderKeywordHighlightText(text, baseStyle, keywordNeedle);
    }
    return <RichNoteText text={text} style={baseStyle} />;
  };

  const renderSummaryBody = (text: string) => {
    const baseStyle = [styles.summaryBody, { color: sheet.bodyMuted }];
    const boldStyle = darkMode
      ? { fontWeight: "600" as const, color: "rgba(255,255,255,1)" }
      : { fontWeight: "600" as const, color: lightColors.textPrimary };
    if (showSearchHighlight) {
      return renderHighlightedText(text, baseStyle);
    }
    if (keywordNeedle.length > 0) {
      return renderKeywordHighlightText(text, baseStyle, keywordNeedle);
    }
    return <RichNoteText text={text} style={baseStyle} boldStyle={boldStyle} />;
  };

  /**
   * Keyword matches use accent + bold. Non-matching segments use the same **bold** rules as
   * RichNoteText but as flat sibling <Text> nodes — nesting RichNoteText inside <Text> inverted
   * bold vs regular weight on some platforms.
   */
  const renderKeywordHighlightText = (text: string, baseStyle: any, needle: string) => {
    const parts = splitCaseInsensitive(text, needle);
    return (
      <Text style={baseStyle}>
        {parts.flatMap((part, partIndex) => {
          if (part.hit) {
            return [
              <Text
                key={`kw-hit-${partIndex}`}
                style={[baseStyle, { color: accentColor, fontWeight: "700" }]}
              >
                {part.value}
              </Text>,
            ];
          }
          const md = part.value.split("**");
          return md.map((seg, j) => (
            <Text
              key={`kw-md-${partIndex}-${j}`}
              style={j % 2 === 1 ? [baseStyle, { fontWeight: "700" }] : [baseStyle, { fontWeight: "400" }]}
            >
              {seg}
            </Text>
          ));
        })}
      </Text>
    );
  };

  const renderHighlightedText = (text: string, baseStyle: any) => {
    const cleanText = stripMarkdownBoldMarkers(text);
    if (!normalizedQuery || !highlightActive) {
      return <Text style={baseStyle}>{cleanText}</Text>;
    }
    const lower = cleanText.toLowerCase();
    const parts: Array<{ value: string; hit: boolean }> = [];
    let cursor = 0;
    while (true) {
      const idx = lower.indexOf(normalizedQuery, cursor);
      if (idx === -1) break;
      if (idx > cursor) {
        parts.push({ value: cleanText.slice(cursor, idx), hit: false });
      }
      parts.push({
        value: cleanText.slice(idx, idx + normalizedQuery.length),
        hit: true,
      });
      cursor = idx + normalizedQuery.length;
    }
    if (cursor < cleanText.length) {
      parts.push({ value: cleanText.slice(cursor), hit: false });
    }
    if (parts.length === 0) {
      return <Text style={baseStyle}>{cleanText}</Text>;
    }
    return (
      <Text style={baseStyle}>
        {parts.map((part, index) => (
          <Text
            key={`${part.value}-${index}`}
            style={part.hit ? { color: accentColor, fontWeight: "700" } : undefined}
          >
            {part.value}
          </Text>
        ))}
      </Text>
    );
  };

  const renderSectionCard = (
    layoutKey: string | undefined,
    iconBg: string,
    iconColor: string,
    ionName: React.ComponentProps<typeof Ionicons>["name"],
    title: string,
    children: ReactNode,
    copySectionKey?: CopySectionKey
  ) => (
    <View
      style={[
        styles.rptSectionCard,
        { backgroundColor: sheet.sectionCardBg, borderColor: sheet.sectionCardBorder },
      ]}
      onLayout={
        layoutKey
          ? (e) => {
              sectionY.current[layoutKey] = e.nativeEvent.layout.y;
            }
          : undefined
      }
    >
      <View style={styles.rptSectionHeader}>
        <View style={[styles.rptSectionIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={ionName} size={18} color={iconColor} />
        </View>
        <View style={styles.rptSectionTitleWrap}>
          <Text style={[styles.rptSectionTitle, { color: sheet.sectionTitle }]}>{title}</Text>
        </View>
        {sectionCopyMode && copySectionKey ? (
          <Pressable
            onPress={() => void runSectionCopy(copySectionKey)}
            style={({ pressed }) => [styles.rptSectionCopyHit, pressed && { opacity: 0.7 }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${title}`}
          >
            <Ionicons name="copy-outline" size={18} color={sheet.actionSecondaryLabel} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.rptSectionHeaderDivider, { backgroundColor: sheet.sectionHeaderRule }]} />
      <View style={styles.rptSectionBody}>{children}</View>
    </View>
  );

  const renderReportUpperSections = () => (
    <>
      <View style={styles.rptHeaderBlock}>
        <View style={styles.rptHeaderContent}>
          <Text style={[styles.rptChapterTitle, { color: sheet.chapter }]}>{chapterHeadline}</Text>
          <View style={styles.rptMetaPillRow}>
            {item.page?.trim() ? (
              <View style={[styles.rptMetaPill, { backgroundColor: sheet.pillBg, borderColor: sheet.pillBorder }]}>
                <Text style={[styles.rptMetaPillText, { color: sheet.pillText }]}>p. {item.page.trim()}</Text>
              </View>
            ) : null}
            <View style={[styles.rptMetaPill, { backgroundColor: sheet.pillBg, borderColor: sheet.pillBorder }]}>
              <Text style={[styles.rptMetaPillText, { color: sheet.pillText }]}>
                {formatReportMetaTime(createdAt)}
              </Text>
            </View>
            <View
              style={[
                styles.rptMetaPill,
                { backgroundColor: sheet.extractPillBg, borderColor: sheet.extractPillBorder },
              ]}
            >
              <Text style={[styles.rptMetaPillText, { color: sheet.extractPillText }]}>
                {formatExtractionLabel(extractionModes)}
              </Text>
            </View>
            <View style={[styles.rptMetaPill, { backgroundColor: sheet.pillBg, borderColor: sheet.pillBorder }]}>
              <Text style={[styles.rptMetaPillText, { color: sheet.pillText }]}>~{readingMinutes} min read</Text>
            </View>
          </View>
        </View>
        <View style={[styles.rptHeaderRule, { backgroundColor: sheet.headerRule }]} />
      </View>

      <Pressable
        onPress={openStudySettingsModal}
        style={({ pressed }) => [
          styles.rptStudyRow,
          {
            backgroundColor: sheet.studyRowBg,
            borderColor: sheet.studyRowBorder,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <View style={styles.rptStudyRowLeft}>
          <Ionicons name="options-outline" size={15} color={sheet.studyIcon} />
          <Text style={[styles.rptStudyLabel, { color: sheet.studyLabel }]}>Study settings</Text>
        </View>
        <View style={styles.rptStudyTags}>
          {studySettingTags.map((tag) => (
            <View key={tag} style={[styles.rptStudyTag, { backgroundColor: sheet.studyTagBg }]}>
              <Text style={[styles.rptStudyTagText, { color: sheet.studyTagText }]} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
        <Ionicons name="chevron-forward" size={14} color={sheet.studyChevron} />
      </Pressable>

      {showSummary
        ? renderSectionCard(
            "summary",
            RPT.blueBg,
            RPT.blue,
            "document-text-outline",
            "Summary",
            renderSummaryBody(item.notes.summary),
            "summary"
          )
        : null}

      {showMainIdeas
        ? renderSectionCard(
            "mainIdeas",
            RPT.purpleBg,
            RPT.purple,
            "list-outline",
            "Bullet points",
            <View style={styles.rptBullets}>
              {item.notes.mainIdeas.length > 0 ? (
                item.notes.mainIdeas.map((idea, index) => (
                  <View key={`${idea}-${index}`} style={styles.rptBulletRow}>
                    <View style={styles.rptBulletNum}>
                      <Text style={styles.rptBulletNumText}>{index + 1}</Text>
                    </View>
                    <View style={styles.rptBulletTextWrap}>
                      {renderBodyText(idea, [styles.rptBulletText, { color: sheet.bodyMuted }])}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.rptBulletText, { color: sheet.bodyMuted }]}>
                  No bullet points were extracted from this page.
                </Text>
              )}
            </View>,
            "bulletPoints"
          )
        : null}

      {showDetailedNotes
        ? renderSectionCard(
            "detailedNotes",
            RPT.slateBg,
            RPT.slate,
            "document-text-outline",
            "Detailed notes",
            renderBodyText(item.notes.detailedNotes, [styles.rptBodyParagraph, { color: sheet.bodyMuted }]),
            "detailedNotes"
          )
        : null}

      {item.reinforcedIdeas && item.reinforcedIdeas.length > 0
        ? renderSectionCard(
            undefined,
            RPT.orangeBg,
            RPT.orange,
            "repeat-outline",
            "Reinforced ideas",
            <>
              <Text style={[styles.rptBodyParagraph, { color: sheet.bodyMuted }]}>
                These ideas also appeared in earlier pages, suggesting they matter to your reading focus.
              </Text>
              <View style={styles.rptBullets}>
                {item.reinforcedIdeas.map((match, index) => (
                  <View key={`${match.idea}-${index}`} style={styles.rptBulletRow}>
                    <View style={[styles.rptBulletNum, styles.rptBulletNumMuted]}>
                      <Ionicons name="repeat-outline" size={12} color={RPT.blue} />
                    </View>
                    <View style={[styles.rptReinforcedBody, styles.rptBulletTextWrap]}>
                      {renderBodyText(match.idea, [styles.rptBulletText, { color: sheet.bodyMuted }])}
                      {match.matchedPage ? (
                        <Text style={[styles.rptReinforcedMeta, { color: sheet.pillText }]}>
                          Also seen on page {match.matchedPage}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>,
            "reinforcedIdeas"
          )
        : null}

      {showQuotes
        ? renderSectionCard(
            "quotes",
            RPT.amberBg,
            RPT.amber,
            "chatbubble-ellipses-outline",
            "Quotes",
            item.notes.quotes && item.notes.quotes.length > 0 ? (
              <View style={styles.rptQuotesList}>
                {item.notes.quotes.map((quote, index) => (
                  <View key={`${index}-${quote.slice(0, 24)}`} style={styles.rptQuoteBlock}>
                    {renderBodyText(quote, [styles.rptQuoteText, { color: sheet.quoteMuted }])}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.rptBodyParagraph, { color: sheet.bodyMuted }]}>
                No quotes were found on this page.
              </Text>
            ),
            "quotes"
          )
        : null}

      {showKeywords
        ? renderSectionCard(
            "keywords",
            RPT.greenBg,
            RPT.green,
            "pricetag-outline",
            showEverything ? "Keywords" : "Words",
            showVocabularyDefinitions && item.notes.vocabularyTerms && item.notes.vocabularyTerms.length > 0 ? (
              <View style={styles.vocabularyList}>
                {item.notes.vocabularyTerms.map((term, index) => (
                  <View
                    key={`${index}-${term.word}`}
                    style={[styles.vocabularyCard, darkMode && styles.vocabularyCardDark]}
                  >
                    {renderBodyText(term.word, [styles.vocabularyWord, { color: RPT.blue }])}
                    {renderBodyText(term.definition, [styles.rptBodyParagraph, { color: sheet.bodyMuted }])}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.rptKeywordWrap}>
                {item.notes.keywords.map((keyword) => {
                  const raw = stripMarkdownBoldMarkers(keyword);
                  const label = keywordSentenceCase(raw);
                  const isSearchMatch =
                    Boolean(normalizedQuery) && highlightActive && raw.toLowerCase().includes(normalizedQuery);
                  const isKeywordSelected = keywordNeedle.length > 0 && raw === keywordTapHighlight;
                  return (
                    <Pressable
                      key={raw || keyword}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setKeywordTapHighlight((prev) => (prev === raw ? null : raw));
                      }}
                      style={({ pressed }) => [
                        styles.rptKeywordChip,
                        isSearchMatch && {
                          backgroundColor: `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.14)`,
                        },
                        isKeywordSelected && {
                          backgroundColor: `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.22)`,
                          borderWidth: 1,
                          borderColor: RPT.blue,
                        },
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rptKeywordChipText,
                          isSearchMatch && { fontWeight: "700" },
                          isKeywordSelected && { fontWeight: "700" },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ),
            "keywords"
          )
        : null}
    </>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, { backgroundColor: sheet.screenBg }]}>
      <View style={styles.rptTopNav}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.rptNavIconBtn,
            { backgroundColor: sheet.navCircle },
            pressed && { opacity: 0.85 },
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={17} color={sheet.navIconMuted} />
        </Pressable>
        <Text style={[styles.rptNavBreadcrumb, { color: sheet.breadcrumb }]} numberOfLines={1}>
          {reportBookTitle}
        </Text>
        <Pressable
          onPress={() => void onExportReportPdf()}
          disabled={pdfToastMode !== null}
          style={({ pressed }) => [
            styles.rptNavIconBtn,
            { backgroundColor: sheet.navCircle },
            pressed && { opacity: 0.85 },
            pdfToastMode !== null && { opacity: 0.45 },
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Export report"
        >
          <Ionicons name="share-outline" size={17} color={sheet.navIconMuted} />
        </Pressable>
        <Pressable
          onPress={openOverflowMenu}
          style={({ pressed }) => [
            styles.rptNavIconBtn,
            { backgroundColor: sheet.navCircle },
            pressed && { opacity: 0.85 },
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={17} color={sheet.navIconMuted} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 116 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollInner}>
        {missingPage ? (
          <View style={[styles.addPageCard, darkMode && styles.cardDark]}>
            {!pageEditorOpen ? (
              <TouchableOpacity
                style={[styles.addPageButton, { borderColor: accentColor }]}
                onPress={() => {
                  setPageEditorOpen(true);
                  setPageDraft("");
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.addPageButtonText, { color: accentColor }]}>Add the page</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  value={pageDraft}
                  onChangeText={setPageDraft}
                  placeholder="e.g. 42 or 120–125"
                  placeholderTextColor={darkMode ? darkColors.textMuted : lightColors.textMuted}
                  style={[
                    styles.addPageInput,
                    darkMode && styles.addPageInputDark,
                    darkMode && styles.textPrimaryDark,
                  ]}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={onSaveManualPage}
                />
                <View style={styles.addPageActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setPageEditorOpen(false);
                      setPageDraft("");
                    }}
                    hitSlop={8}
                  >
                    <Text style={[styles.addPageActionSecondary, darkMode && styles.textMutedDark]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onSaveManualPage}
                    disabled={!pageDraft.trim()}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.addPageActionPrimary,
                        { color: accentColor, opacity: pageDraft.trim() ? 1 : 0.45 },
                      ]}
                    >
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : null}
        {keywordNeedle.length > 0 ? (
          <Pressable
            onPress={() => setKeywordTapHighlight(null)}
            style={styles.keywordDismissPressable}
          >
            <View
              style={[
                styles.reportUpper,
                styles.keywordDismissFill,
                { minHeight: Dimensions.get("window").height * 0.55 },
              ]}
            >
              {renderReportUpperSections()}
            </View>
          </Pressable>
        ) : (
          <View style={styles.reportUpper}>{renderReportUpperSections()}</View>
        )}

        <Pressable
          onPress={onDeleteReport}
          style={({ pressed }) => [styles.rptDeleteLink, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="trash-outline" size={15} color="rgba(239,68,68,0.6)" />
          <Text style={styles.rptDeleteLinkText}>Delete report</Text>
        </Pressable>
        </View>
      </ScrollView>

      {copiedToastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.copiedToast,
            darkMode && styles.copiedToastDark,
            {
              bottom: 72 + insets.bottom,
              height: COPIED_TOAST_H,
              width: copiedToastWidth,
              borderRadius: copiedToastRadius,
              paddingHorizontal: copiedToastPadH,
            },
          ]}
        >
          <View style={styles.copiedToastInner}>
            <Ionicons name="checkmark" size={20} color="#ffffff" />
            <Animated.View
              style={[
                styles.copiedToastLabelSlot,
                {
                  maxWidth: copiedToastLabelMaxWidth,
                  marginLeft: copiedToastLabelSlotMargin,
                },
              ]}
            >
              <Animated.Text
                numberOfLines={1}
                style={[styles.copiedToastText, { opacity: copiedToastTextOpacity }]}
              >
                Copied to clipboard
              </Animated.Text>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}

      <View
        style={[
          styles.rptActionBar,
          {
            backgroundColor: sheet.actionBarBg,
            borderTopColor: sheet.actionBarBorder,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.rptActionSecondary,
            {
              backgroundColor: sheet.actionSecondaryBg,
              borderColor: sheet.actionSecondaryBorder,
            },
            sectionCopyMode && {
              borderColor: RPT.blue,
              backgroundColor: "rgba(59,130,246,0.12)",
            },
          ]}
          onPress={() => setSectionCopyMode((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons
            name={sectionCopyMode ? "checkmark-outline" : "copy-outline"}
            size={17}
            color={sectionCopyMode ? RPT.blue : sheet.actionSecondaryLabel}
          />
          <Text
            style={[
              styles.rptActionSecondaryText,
              { color: sectionCopyMode ? RPT.blue : sheet.actionSecondaryLabel },
            ]}
          >
            {sectionCopyMode ? "Done" : "Copy"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.rptActionSecondary,
            {
              backgroundColor: sheet.actionSecondaryBg,
              borderColor: sheet.actionSecondaryBorder,
            },
          ]}
          onPress={() => void onExportReportPdf()}
          activeOpacity={0.85}
          disabled={pdfToastMode !== null}
        >
          <Ionicons name="share-outline" size={17} color={sheet.actionSecondaryLabel} />
          <Text style={[styles.rptActionSecondaryText, { color: sheet.actionSecondaryLabel }]}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rptActionPrimary}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
          activeOpacity={0.9}
        >
          <Ionicons name="sparkles" size={17} color="#ffffff" />
          <Text style={styles.rptActionPrimaryText}>Ask AI</Text>
        </TouchableOpacity>
      </View>

      <ReportStudySettingsModal
        visible={studySettingsModalVisible}
        onClose={() => setStudySettingsModalVisible(false)}
        initialPrefs={studyPrefsUsed}
        darkMode={darkMode}
        onContinueToExtract={onStudyPrefsContinueToExtract}
      />

      <PdfExportToast
        mode={pdfToastMode}
        shareDialogTitle={pdfShareDialogTitle}
        onDismissComplete={onPdfToastDismissComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: "relative",
    paddingTop: 0,
  },
  rptTopNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  rptNavIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rptNavBreadcrumb: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  scrollContent: {},
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  rptHeaderBlock: {
    marginHorizontal: -20,
  },
  rptHeaderContent: {
    paddingHorizontal: 20,
  },
  rptChapterTitle: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 26,
    marginBottom: 6,
  },
  rptMetaPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rptMetaPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  rptMetaPillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  rptHeaderRule: {
    height: 0.5,
    marginTop: 12,
  },
  rptStudyRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    gap: 8,
  },
  rptStudyRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  rptStudyLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  rptStudyTags: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
    minWidth: 0,
  },
  rptStudyTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    maxWidth: "100%",
  },
  rptStudyTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  rptSectionCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  rptSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rptSectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rptSectionTitleWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  rptSectionTitle: {
    fontSize: 17,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  rptSectionCopyHit: {
    padding: 6,
    marginLeft: 4,
  },
  rptSectionHeaderDivider: {
    height: 0.5,
  },
  rptSectionBody: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  summaryBody: {
    fontSize: 13,
    lineHeight: 20.8,
  },
  rptBodyParagraph: {
    fontSize: 13,
    lineHeight: 20.8,
  },
  rptBullets: {
    gap: 10,
  },
  rptBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rptBulletNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(59,130,246,0.15)",
    borderWidth: 0.5,
    borderColor: "rgba(59,130,246,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  rptBulletNumMuted: {
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  rptBulletNumText: {
    fontSize: 11,
    fontWeight: "600",
    color: RPT.blue,
  },
  rptBulletTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rptBulletText: {
    fontSize: 13,
    lineHeight: 19.5,
  },
  rptReinforcedBody: {
    gap: 4,
  },
  rptReinforcedMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  rptQuotesList: {
    gap: 12,
  },
  rptQuoteBlock: {
    borderLeftWidth: 2,
    borderLeftColor: RPT.blue,
    paddingLeft: 10,
  },
  rptQuoteText: {
    fontSize: 13,
    lineHeight: 20.8,
    fontStyle: "italic",
  },
  rptKeywordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rptKeywordChip: {
    backgroundColor: "rgba(59,130,246,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(59,130,246,0.2)",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  rptKeywordChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: RPT.blue,
  },
  rptDeleteLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 20,
  },
  rptDeleteLinkText: {
    fontSize: 13,
    color: "rgba(239,68,68,0.6)",
    fontWeight: "500",
  },
  rptActionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  rptActionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  rptActionSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  rptActionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: RPT.primaryBtn,
  },
  rptActionPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  addPageCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 14,
    gap: 12,
  },
  addPageButton: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  addPageButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  addPageInput: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: lightColors.textPrimary,
  },
  addPageInputDark: {
    borderColor: darkColors.border,
    backgroundColor: darkColors.background,
  },
  addPageActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 20,
  },
  addPageActionSecondary: {
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textMuted,
  },
  addPageActionPrimary: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  textPrimaryDark: {
    color: darkColors.textPrimary,
  },
  textSecondaryDark: {
    color: darkColors.textSecondary,
  },
  textMutedDark: {
    color: darkColors.textMuted,
  },
  reportUpper: {
    gap: 12,
  },
  keywordDismissPressable: {
    flexGrow: 1,
  },
  keywordDismissFill: {
    flexGrow: 1,
  },
  vocabularyList: {
    gap: 10,
  },
  vocabularyCard: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 12,
    padding: 12,
    gap: 5,
    backgroundColor: lightColors.background,
  },
  vocabularyCardDark: {
    borderColor: darkColors.border,
    backgroundColor: darkColors.background,
  },
  vocabularyWord: {
    fontSize: 16,
    fontWeight: "800",
  },
  copiedToast: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 25,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#15803d",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  copiedToastDark: {
    backgroundColor: "#166534",
  },
  copiedToastInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  copiedToastLabelSlot: {
    overflow: "hidden",
  },
  copiedToastText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    includeFontPadding: false,
  },
});

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => char + char)
        .join("")
    : normalized;
  const int = parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}
