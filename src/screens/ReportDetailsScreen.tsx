import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { PdfExportToast, type PdfExportToastMode } from "../components/PdfExportToast";
import { RichNoteText } from "../components/RichNoteText";
import { StudySettingsSummaryCard } from "../components/StudySettingsSummaryCard";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import type { LibraryStackParamList, ScanStackParamList } from "../navigation/types";
import type { ExtractionMode, ScanItem } from "../types/note";
import { DEFAULT_STUDY_PREFERENCES } from "../types/studyPreferences";
import {
  createSingleReportPdf,
  sanitizeFileBase,
  singleReportShareLabel,
} from "../utils/bookReportsPdf";
import { splitCaseInsensitive } from "../utils/splitCaseInsensitive";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";
import { darkColors, lightColors } from "../theme/colors";
import { FONT_CANELA_TEXT_BOLD } from "../theme/fonts";
import { hexWithAlpha } from "../theme/colorUtils";

const COPIED_TOAST_H = 32;
const COPIED_TOAST_W_START = 32;
const COPIED_TOAST_W_END = 228;
/** Hold at circle before widening; expand duration — keep toast visible long enough for both. */
const COPIED_TOAST_HOLD_MS = 280;
const COPIED_TOAST_EXPAND_MS = 650;
const COPIED_TOAST_VISIBLE_MS =
  COPIED_TOAST_HOLD_MS + COPIED_TOAST_EXPAND_MS + 1800;

type Props =
  | NativeStackScreenProps<LibraryStackParamList, "ReportDetails">
  | NativeStackScreenProps<ScanStackParamList, "ReportDetails">;
type CopyOptionKey = "summary" | "bulletPoints" | "detailedNotes" | "quotes";

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

export function ReportDetailsScreen({ route, navigation }: Props) {
  const { darkMode, accentColor } = useAppSettings();
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
  const studyPrefsUsed = item.studyPreferences ?? DEFAULT_STUDY_PREFERENCES;
  const extractionModes = getExtractionModes(item.extractionMode, item.extractionModes);
  const showEverything = extractionModes.includes("everything");
  const showSummary = showEverything;
  const showMainIdeas = showEverything || extractionModes.includes("bulletPoints");
  const showDetailedNotes = showEverything;
  const showQuotes = showEverything || extractionModes.includes("quotes");
  const showKeywords = showEverything || extractionModes.includes("words");
  const showVocabularyDefinitions = !showEverything && extractionModes.includes("words");

  const onDeleteReport = () => {
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
  };

  const createdAt = new Date(item.createdAt);
  const createdLabel = createdAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const readingMinutes = Math.max(1, Math.round((item.notes.detailedNotes.length || 120) / 900));
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [highlightActive, setHighlightActive] = useState(Boolean(highlightQuery));
  /** Keyword chip tap: highlight this term everywhere until user taps to dismiss. */
  const [keywordTapHighlight, setKeywordTapHighlight] = useState<string | null>(null);
  /** Per-section copy icons only while true; cleared after a successful copy or by Done. */
  const [sectionCopyMode, setSectionCopyMode] = useState(false);
  const [copiedToastVisible, setCopiedToastVisible] = useState(false);
  const [pdfToastMode, setPdfToastMode] = useState<PdfExportToastMode | null>(null);
  const copiedToastExpand = useRef(new Animated.Value(0)).current;
  const [pageEditorOpen, setPageEditorOpen] = useState(false);
  const [pageDraft, setPageDraft] = useState("");
  const missingPage = !item.page?.trim();

  const pdfShareDialogTitle = useMemo(
    () => `Export ${sanitizeFileBase(singleReportShareLabel(item, bookForReport ?? null))}`,
    [item, bookForReport],
  );

  const onExportReportPdf = useCallback(async () => {
    setPdfToastMode("loading");
    try {
      const uri = await createSingleReportPdf(item, bookForReport ?? null);
      setPdfToastMode({ type: "ready", uri });
    } catch (e) {
      setPdfToastMode(null);
      const message = e instanceof Error ? e.message : "Could not create the PDF.";
      Alert.alert("Export failed", message);
    }
  }, [item, bookForReport]);

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

  const onCopySucceeded = () => {
    setSectionCopyMode(false);
    setCopiedToastVisible(true);
  };

  const showSearchHighlight = Boolean(normalizedQuery) && highlightActive;
  const keywordNeedle = keywordTapHighlight?.trim() ?? "";
  const copyOneSection = async (key: CopyOptionKey) => {
    const lines = [...buildReportHeaderLines(item, createdLabel)];

    if (key === "summary" && showSummary) {
      pushCopySection(lines, "Summary", stripMarkdownBoldMarkers(item.notes.summary));
    } else if (key === "bulletPoints" && showMainIdeas) {
      pushCopySection(
        lines,
        "Bullet Points",
        item.notes.mainIdeas.map((idea) => stripMarkdownBoldMarkers(idea))
      );
    } else if (key === "detailedNotes" && showDetailedNotes) {
      pushCopySection(lines, "Detailed Notes", stripMarkdownBoldMarkers(item.notes.detailedNotes));
    } else if (key === "quotes" && showQuotes) {
      const quotes = item.notes.quotes ?? [];
      pushCopySection(
        lines,
        "Quotes",
        quotes.map((quote) => stripMarkdownBoldMarkers(quote))
      );
    } else {
      return;
    }

    await Clipboard.setStringAsync(lines.join("\n").trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onCopySucceeded();
  };

  const copyKeywordsSection = async () => {
    const lines = [...buildReportHeaderLines(item, createdLabel)];
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
    } else if (item.notes.keywords.length > 0) {
      pushCopySection(
        lines,
        sectionLabel,
        item.notes.keywords.map((keyword) => stripMarkdownBoldMarkers(keyword))
      );
    } else {
      pushCopySection(lines, sectionLabel, []);
    }
    await Clipboard.setStringAsync(lines.join("\n").trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onCopySucceeded();
  };

  const copyReinforcedIdeasSection = async () => {
    if (!item.reinforcedIdeas?.length) return;
    const lines = [...buildReportHeaderLines(item, createdLabel)];
    pushCopySection(
      lines,
      "Reinforced Ideas",
      item.reinforcedIdeas.map((match) => {
        const idea = stripMarkdownBoldMarkers(match.idea);
        return match.matchedPage ? `${idea} (also seen on page ${match.matchedPage})` : idea;
      })
    );
    await Clipboard.setStringAsync(lines.join("\n").trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onCopySucceeded();
  };

  const renderSectionHeader = (title: string, onCopy: () => void | Promise<void>) => (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionTitle, styles.sectionTitleFlex, darkMode && styles.textPrimaryDark]}>
        {title}
      </Text>
      <View style={styles.sectionCopySlot}>
        {sectionCopyMode ? (
          <Pressable
            onPress={() => void onCopy()}
            style={({ pressed }) => [styles.sectionCopyBtn, pressed && styles.sectionCopyBtnPressed]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${title}`}
          >
            <Ionicons
              name="copy-outline"
              size={18}
              color={darkMode ? darkColors.textSecondary : lightColors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderBodyText = (text: string, baseStyle: any) => {
    if (showSearchHighlight) {
      return renderHighlightedText(text, baseStyle);
    }
    if (keywordNeedle.length > 0) {
      return renderKeywordHighlightText(text, baseStyle, keywordNeedle);
    }
    return <RichNoteText text={text} style={baseStyle} />;
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

  const renderReportUpperSections = () => (
    <>
      <View style={[styles.heroCard, darkMode && styles.cardDark]}>
        <Text style={[styles.heroTitle, darkMode && styles.textPrimaryDark]}>
          {item.book ?? "Report Details"}
        </Text>
        <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>{createdLabel}</Text>
        {item.chapter?.trim() ? (
          <Text style={[styles.heroChapter, darkMode && styles.textMutedDark]}>
            {item.chapter.trim()}
          </Text>
        ) : null}
        {item.page?.trim() ? (
          <Text style={[styles.heroPage, darkMode && styles.textMutedDark]}>Page {item.page.trim()}</Text>
        ) : null}
        <View style={styles.heroMetaRow}>
          <View style={[styles.badge, { borderColor: accentColor }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>
              {formatExtractionLabel(extractionModes)}
            </Text>
          </View>
          <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>
            ~{readingMinutes} min read
          </Text>
        </View>
      </View>

      <StudySettingsSummaryCard prefs={studyPrefsUsed} darkMode={darkMode} accentColor={accentColor} />

      {showSummary ? (
        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.summary = e.nativeEvent.layout.y;
          }}
        >
          {renderSectionHeader("Summary", () => copyOneSection("summary"))}
          {renderBodyText(item.notes.summary, [
            styles.sectionText,
            darkMode && styles.textSecondaryDark,
          ])}
        </View>
      ) : null}

      {showMainIdeas ? (
        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.mainIdeas = e.nativeEvent.layout.y;
          }}
        >
          {renderSectionHeader("Bullet Points", () => copyOneSection("bulletPoints"))}
          <View style={styles.ideasList}>
            {item.notes.mainIdeas.length > 0 ? (
              item.notes.mainIdeas.map((idea, index) => (
                <View key={`${idea}-${index}`} style={styles.ideaRow}>
                  <View style={[styles.ideaIndex, { borderColor: accentColor }]}>
                    <Text style={[styles.ideaIndexText, { color: accentColor }]}>{index + 1}</Text>
                  </View>
                  {renderBodyText(idea, [
                    styles.sectionText,
                    styles.ideaText,
                    darkMode && styles.textSecondaryDark,
                  ])}
                </View>
              ))
            ) : (
              <Text style={[styles.sectionText, darkMode && styles.textSecondaryDark]}>
                No bullet points were extracted from this page.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {showDetailedNotes ? (
        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.detailedNotes = e.nativeEvent.layout.y;
          }}
        >
          {renderSectionHeader("Detailed Notes", () => copyOneSection("detailedNotes"))}
          {renderBodyText(item.notes.detailedNotes, [
            styles.sectionText,
            darkMode && styles.textSecondaryDark,
          ])}
        </View>
      ) : null}

      {item.reinforcedIdeas && item.reinforcedIdeas.length > 0 ? (
        <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
          {renderSectionHeader("Reinforced Ideas", copyReinforcedIdeasSection)}
          <Text style={[styles.sectionText, darkMode && styles.textSecondaryDark]}>
            These ideas also appeared in earlier pages, suggesting they matter to your reading focus.
          </Text>
          <View style={styles.ideasList}>
            {item.reinforcedIdeas.map((match, index) => (
              <View key={`${match.idea}-${index}`} style={styles.ideaRow}>
                <View style={[styles.ideaIndex, { borderColor: accentColor }]}>
                  <Ionicons name="repeat-outline" size={12} color={accentColor} />
                </View>
                <View style={styles.ideaText}>
                  {renderBodyText(match.idea, [
                    styles.sectionText,
                    darkMode && styles.textSecondaryDark,
                  ])}
                  {match.matchedPage ? (
                    <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>
                      Also seen on page {match.matchedPage}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {showQuotes ? (
        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.quotes = e.nativeEvent.layout.y;
          }}
        >
          {renderSectionHeader("Quotes", () => copyOneSection("quotes"))}
          {item.notes.quotes && item.notes.quotes.length > 0 ? (
            <View style={styles.quotesList}>
              {item.notes.quotes.map((quote, index) => (
                <View
                  key={`${index}-${quote.slice(0, 24)}`}
                  style={[styles.quoteBlock, { borderLeftColor: accentColor }]}
                >
                  {renderBodyText(quote, [
                    styles.sectionText,
                    styles.quoteText,
                    darkMode && styles.textSecondaryDark,
                  ])}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.sectionText, darkMode && styles.textSecondaryDark]}>
              No quotes were found on this page.
            </Text>
          )}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
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

        {showKeywords ? (
          <View
            style={[styles.sectionCard, darkMode && styles.cardDark]}
            onLayout={(e) => {
              sectionY.current.keywords = e.nativeEvent.layout.y;
            }}
          >
          {renderSectionHeader(showEverything ? "Keywords" : "Words", copyKeywordsSection)}
          {showVocabularyDefinitions && item.notes.vocabularyTerms && item.notes.vocabularyTerms.length > 0 ? (
            <View style={styles.vocabularyList}>
              {item.notes.vocabularyTerms.map((term, index) => (
                <View
                  key={`${index}-${term.word}`}
                  style={[styles.vocabularyCard, darkMode && styles.vocabularyCardDark]}
                >
                  {renderBodyText(term.word, [
                    styles.vocabularyWord,
                    { color: accentColor },
                  ])}
                  {renderBodyText(term.definition, [
                    styles.sectionText,
                    darkMode && styles.textSecondaryDark,
                  ])}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.keywordWrap}>
            {item.notes.keywords.map((keyword) => {
              const label = stripMarkdownBoldMarkers(keyword);
              const isSearchMatch =
                Boolean(normalizedQuery) &&
                highlightActive &&
                label.toLowerCase().includes(normalizedQuery);
              const isKeywordSelected = keywordNeedle.length > 0 && label === keywordTapHighlight;
              return (
                <Pressable
                  key={label || keyword}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setKeywordTapHighlight((prev) => (prev === label ? null : label));
                  }}
                  style={({ pressed }) => [
                    styles.keywordChip,
                    { borderColor: accentColor },
                    isSearchMatch && {
                      backgroundColor: `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.14)`,
                    },
                    isKeywordSelected && {
                      backgroundColor: `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.22)`,
                      borderWidth: 2,
                    },
                    pressed && styles.keywordChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.keywordText,
                      { color: accentColor },
                      isSearchMatch && { fontWeight: "800" },
                      isKeywordSelected && { fontWeight: "800" },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            </View>
          )}
        </View>
        ) : null}

        <TouchableOpacity style={styles.deleteReportBtn} onPress={onDeleteReport} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={18} color="#dc2626" />
          <Text style={styles.deleteReportText}>Delete report</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>

      {copiedToastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.copiedToast,
            darkMode && styles.copiedToastDark,
            {
              bottom: 96 + insets.bottom,
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

      <View style={[styles.stickyActionBar, darkMode && styles.cardDark]}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            sectionCopyMode && {
              borderColor: accentColor,
              backgroundColor: hexWithAlpha(accentColor, 0.12),
            },
          ]}
          onPress={() => setSectionCopyMode((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons
            name={sectionCopyMode ? "checkmark-outline" : "copy-outline"}
            size={18}
            color={sectionCopyMode ? accentColor : darkMode ? darkColors.textPrimary : lightColors.textPrimary}
          />
          <Text
            style={[
              styles.actionText,
              darkMode && styles.textPrimaryDark,
              sectionCopyMode && { color: accentColor },
            ]}
          >
            {sectionCopyMode ? "Done" : "Copy"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => void onExportReportPdf()}
          activeOpacity={0.85}
          disabled={pdfToastMode !== null}
        >
          <Ionicons name="share-outline" size={18} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
          <Text style={[styles.actionText, darkMode && styles.textPrimaryDark]}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtnPrimary, { backgroundColor: accentColor }]}>
          <Ionicons name="sparkles-outline" size={18} color="#fff" />
          <Text style={styles.actionTextPrimary}>Ask AI</Text>
        </TouchableOpacity>
      </View>

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
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  scrollContent: {
    paddingBottom: 110 + 72,
  },
  /** Gap between report cards (ScrollView gap only applies to direct children). */
  scrollInner: {
    gap: 12,
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
  heroCard: {
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  heroTitle: {
    color: lightColors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  heroMeta: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  heroPage: {
    color: lightColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  heroChapter: {
    color: lightColors.textMuted,
    fontSize: 13,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    marginTop: 2,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 14,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 30,
  },
  sectionCopySlot: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: lightColors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  sectionTitleFlex: {
    flex: 1,
  },
  sectionCopyBtn: {
    padding: 6,
    borderRadius: 8,
  },
  sectionCopyBtnPressed: {
    opacity: 0.65,
  },
  sectionText: {
    color: lightColors.textSecondary,
    lineHeight: 21,
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
  ideasList: {
    gap: 10,
  },
  ideaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  ideaIndex: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  ideaIndexText: {
    fontSize: 12,
    fontWeight: "700",
  },
  ideaText: {
    flex: 1,
  },
  quotesList: {
    gap: 12,
  },
  quoteBlock: {
    borderLeftWidth: 3,
    paddingLeft: 12,
  },
  quoteText: {
    fontStyle: "italic",
  },
  keywordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  /** Hero + notes + quotes column (inside dismiss Pressable or plain). */
  reportUpper: {
    gap: 12,
  },
  keywordDismissPressable: {
    flexGrow: 1,
  },
  keywordDismissFill: {
    flexGrow: 1,
  },
  keywordChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  keywordChipPressed: {
    opacity: 0.85,
  },
  keywordText: {
    fontSize: 12,
    fontWeight: "700",
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
    fontSize: 15,
    fontWeight: "800",
  },
  deleteReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  deleteReportText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#dc2626",
  },
  stickyActionBar: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: "row",
    gap: 8,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 22,
    padding: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    flexDirection: "row",
    gap: 6,
  },
  actionBtnPrimary: {
    flex: 1.3,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    flexDirection: "row",
    gap: 6,
  },
  actionText: {
    color: lightColors.textPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  actionTextPrimary: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
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
