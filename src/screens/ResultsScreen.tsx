import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RichNoteText } from "../components/RichNoteText";
import { StudySettingsSummaryCard } from "../components/StudySettingsSummaryCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { DEFAULT_STUDY_PREFERENCES } from "../types/studyPreferences";
import type { ExtractionMode } from "../types/note";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<ScanStackParamList, "Results">;

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

export function ResultsScreen({ route }: Props) {
  const { darkMode, accentColor } = useAppSettings();
  const { item } = route.params;
  const studyPrefsUsed = item.studyPreferences ?? DEFAULT_STUDY_PREFERENCES;
  const extractionModes = getExtractionModes(item.extractionMode, item.extractionModes);
  const showEverything = extractionModes.includes("everything");
  const showSummary = showEverything;
  const showMainIdeas = showEverything || extractionModes.includes("bulletPoints");
  const showDetailedNotes = showEverything;
  const showQuotes = showEverything || extractionModes.includes("quotes");
  const showKeywords = showEverything || extractionModes.includes("words");
  const showVocabularyDefinitions = !showEverything && extractionModes.includes("words");
  const createdAt = new Date(item.createdAt);
  const createdLabel = createdAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const readingMinutes = Math.max(1, Math.round((item.notes.detailedNotes.length || 120) / 900));

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, darkMode && styles.cardDark]}>
          <Text style={[styles.heroTitle, darkMode && styles.textPrimaryDark]}>
            {item.book ?? "AI Notes"}
          </Text>
          <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>{createdLabel}</Text>
          {item.chapter?.trim() ? (
            <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>
              {item.chapter.trim()}
            </Text>
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
          <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Summary</Text>
            <RichNoteText
              text={item.notes.summary}
              style={[styles.sectionText, darkMode && styles.textSecondaryDark]}
            />
          </View>
        ) : null}

        {showMainIdeas ? (
          <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Bullet Points</Text>
            <View style={styles.ideasList}>
              {item.notes.mainIdeas.length > 0 ? (
                item.notes.mainIdeas.map((idea, index) => (
                  <View key={`${idea}-${index}`} style={styles.ideaRow}>
                    <View style={[styles.ideaIndex, { borderColor: accentColor }]}>
                      <Text style={[styles.ideaIndexText, { color: accentColor }]}>{index + 1}</Text>
                    </View>
                    <RichNoteText
                      text={idea}
                      style={[styles.sectionText, styles.ideaText, darkMode && styles.textSecondaryDark]}
                    />
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

        {showEverything && item.notes.sectionHeadings && item.notes.sectionHeadings.length > 0 ? (
          <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Section headings</Text>
            <View style={styles.headingsList}>
              {item.notes.sectionHeadings.map((heading, index) => (
                <RichNoteText
                  key={`${index}-${heading.slice(0, 32)}`}
                  text={heading}
                  style={[styles.sectionText, styles.headingLine, darkMode && styles.textSecondaryDark]}
                />
              ))}
            </View>
          </View>
        ) : null}

        {showDetailedNotes ? (
          <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Detailed Notes</Text>
            <RichNoteText
              text={item.notes.detailedNotes}
              style={[styles.sectionText, darkMode && styles.textSecondaryDark]}
            />
          </View>
        ) : null}

        {showQuotes ? (
          <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Quotes</Text>
            {item.notes.quotes && item.notes.quotes.length > 0 ? (
              <View style={styles.quotesList}>
                {item.notes.quotes.map((quote, index) => (
                  <View
                    key={`${index}-${quote.slice(0, 24)}`}
                    style={[styles.quoteBlock, { borderLeftColor: accentColor }]}
                  >
                    <RichNoteText
                      text={quote}
                      style={[styles.sectionText, styles.quoteText, darkMode && styles.textSecondaryDark]}
                    />
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

        {showKeywords ? (
          <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>
              {showEverything ? "Keywords" : "Words"}
            </Text>
            {showVocabularyDefinitions && item.notes.vocabularyTerms && item.notes.vocabularyTerms.length > 0 ? (
              <View style={styles.vocabularyList}>
                {item.notes.vocabularyTerms.map((term, index) => (
                  <View
                    key={`${index}-${term.word}`}
                    style={[styles.vocabularyCard, darkMode && styles.vocabularyCardDark]}
                  >
                    <Text style={[styles.vocabularyWord, { color: accentColor }]}>{term.word}</Text>
                    <RichNoteText
                      text={term.definition}
                      style={[styles.sectionText, darkMode && styles.textSecondaryDark]}
                    />
                  </View>
                ))}
              </View>
            ) : item.notes.keywords.length > 0 ? (
              <View style={styles.keywordWrap}>
                {item.notes.keywords.map((keyword) => {
                  const label = stripMarkdownBoldMarkers(keyword);
                  return (
                    <View key={label || keyword} style={[styles.keywordChip, { borderColor: accentColor }]}>
                      <Text style={[styles.keywordText, { color: accentColor }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.sectionText, darkMode && styles.textSecondaryDark]}>
                No words were extracted from this page.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.stickyActionBar, darkMode && styles.cardDark]}>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="bookmark-outline" size={18} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
          <Text style={[styles.actionText, darkMode && styles.textPrimaryDark]}>Saved</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="copy-outline" size={18} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
          <Text style={[styles.actionText, darkMode && styles.textPrimaryDark]}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtnPrimary, { backgroundColor: accentColor }]}>
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.actionTextPrimary}>Export</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  scrollContent: {
    paddingBottom: 182,
    gap: 12,
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
  sectionTitle: {
    color: lightColors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
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
  headingsList: {
    gap: 8,
  },
  headingLine: {
    fontWeight: "600",
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
  keywordChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
});
