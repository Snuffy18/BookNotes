import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RichNoteText } from "../components/RichNoteText";
import { StudySettingsSummaryCard } from "../components/StudySettingsSummaryCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { DEFAULT_STUDY_PREFERENCES } from "../types/studyPreferences";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<ScanStackParamList, "Results">;

export function ResultsScreen({ route }: Props) {
  const { darkMode, accentColor } = useAppSettings();
  const { item } = route.params;
  const studyPrefsUsed = item.studyPreferences ?? DEFAULT_STUDY_PREFERENCES;
  const createdAt = new Date(item.createdAt);
  const createdLabel = createdAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const readingMinutes = Math.max(1, Math.round((item.notes.detailedNotes.length || 120) / 900));

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.heroCard, darkMode && styles.cardDark]}>
          <Text style={[styles.heroTitle, darkMode && styles.textPrimaryDark]}>
            {item.book ?? "AI Notes"}
          </Text>
          <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>{createdLabel}</Text>
          <View style={styles.heroMetaRow}>
            <View style={[styles.badge, { borderColor: accentColor }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>Generated now</Text>
            </View>
            <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>
              ~{readingMinutes} min read
            </Text>
          </View>
        </View>

        <StudySettingsSummaryCard prefs={studyPrefsUsed} darkMode={darkMode} accentColor={accentColor} />

        <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Summary</Text>
          <RichNoteText
            text={item.notes.summary}
            style={[styles.sectionText, darkMode && styles.textSecondaryDark]}
          />
        </View>

        <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Main Ideas</Text>
          <View style={styles.ideasList}>
            {item.notes.mainIdeas.map((idea, index) => (
              <View key={`${idea}-${index}`} style={styles.ideaRow}>
                <View style={[styles.ideaIndex, { borderColor: accentColor }]}>
                  <Text style={[styles.ideaIndexText, { color: accentColor }]}>{index + 1}</Text>
                </View>
                <RichNoteText
                  text={idea}
                  style={[styles.sectionText, styles.ideaText, darkMode && styles.textSecondaryDark]}
                />
              </View>
            ))}
          </View>
        </View>

        {item.notes.sectionHeadings && item.notes.sectionHeadings.length > 0 ? (
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

        <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Detailed Notes</Text>
          <RichNoteText
            text={item.notes.detailedNotes}
            style={[styles.sectionText, darkMode && styles.textSecondaryDark]}
          />
        </View>

        {item.notes.quotes && item.notes.quotes.length > 0 ? (
          <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Quotes</Text>
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
          </View>
        ) : null}

        <View style={[styles.sectionCard, darkMode && styles.cardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Keywords</Text>
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
        </View>
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
