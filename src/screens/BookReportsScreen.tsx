import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import type { LibraryStackParamList } from "../navigation/types";
import type { ScanItem } from "../types/note";
import { darkColors, lightColors } from "../theme/colors";

type Navigation = NativeStackNavigationProp<LibraryStackParamList, "BookReports">;
type Route = RouteProp<LibraryStackParamList, "BookReports">;

export function BookReportsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { darkMode, accentColor } = useAppSettings();
  const { books, scans } = useScanContext();
  const [searchQuery, setSearchQuery] = useState("");

  const book = books.find((item) => item.id === route.params.bookId);
  const reports = scans.filter((scan) => scan.bookId === route.params.bookId);
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
        if (report.notes.keywords.some((k) => k.toLowerCase().includes(query))) {
          matches.push("Keywords");
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
        return { report, matches };
      })
      .filter((item) => item.matches.length > 0);
  }, [reports, query]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.headerBlock}>
        <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>
          {book ? book.title : "Book Reports"}
        </Text>
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
          filteredReports.length === 0 && styles.scrollContentEmpty,
        ]}
      >
        {filteredReports.length === 0 ? (
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
          filteredReports.map(({ report, matches }, index) => (
            <TouchableOpacity
              key={report.id}
              style={[styles.reportCard, darkMode && styles.reportCardDark]}
              onPress={() =>
                navigation.navigate("ReportDetails", {
                  item: report,
                  highlightQuery: query || undefined,
                })
              }
              activeOpacity={0.85}
            >
              <View style={styles.reportHeaderRow}>
                <Text
                  style={[styles.reportTitle, darkMode && styles.reportTitleDark]}
                  numberOfLines={2}
                >
                  {buildReportTitle(report)}
                </Text>
                <View style={[styles.reportIndexPill, styles.reportIndexPillFixed, { borderColor: accentColor }]}>
                  <Text style={[styles.reportIndexText, { color: accentColor }]}>#{reports.length - index}</Text>
                </View>
              </View>
              <Text style={[styles.reportDate, darkMode && styles.reportDateDark]}>
                {new Date(report.createdAt).toLocaleDateString()}
              </Text>
              <Text style={[styles.reportSnippet, darkMode && styles.reportSnippetDark]} numberOfLines={2}>
                {report.notes.summary}
              </Text>
              {matches.length > 0 ? (
                <View style={styles.matchWrap}>
                  <Text style={[styles.reportMatchText, { color: accentColor }]}>Found in:</Text>
                  <View style={styles.matchBadgeRow}>
                    {matches.map((match) => (
                      <View key={match} style={[styles.matchBadge, { borderColor: accentColor }]}>
                        <Text style={[styles.matchBadgeText, { color: accentColor }]}>{match}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildReportTitle(report: ScanItem) {
  const pageValue = (report as { page?: string | number }).page;
  const page =
    typeof pageValue === "number"
      ? String(pageValue)
      : typeof pageValue === "string"
      ? pageValue.trim()
      : "";

  const topic =
    report.chapter?.trim() ||
    report.notes.mainIdeas[0]?.trim() ||
    report.notes.keywords[0]?.trim() ||
    getSummaryTopic(report.notes.summary);

  if (page) {
    return `${topic} - Page ${page}`;
  }
  return topic;
}

function getSummaryTopic(summary: string) {
  const firstSentence = summary.split(/[.!?]/)[0]?.trim() || "Reading Notes";
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
  headerTitle: {
    color: lightColors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
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
});
