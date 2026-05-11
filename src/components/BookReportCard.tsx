import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { BookReport } from "../types/note";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";

export function BookReportCard({
  report,
  onPress,
}: {
  report: BookReport;
  onPress?: () => void;
}) {
  const latestScan = report.scans[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: report.book.coverUri }} style={styles.cover} />
      <View style={styles.content}>
        <Text style={styles.title}>{report.book.title}</Text>
        <Text style={styles.meta}>{report.scans.length} scanned page(s)</Text>
        <Text style={styles.preview} numberOfLines={2}>
          {latestScan ? stripMarkdownBoldMarkers(latestScan.notes.summary) : "No summary yet."}
        </Text>
        <Text style={styles.date}>
          Last scan: {latestScan ? new Date(latestScan.createdAt).toLocaleDateString() : "-"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  cover: {
    width: 68,
    height: 92,
    borderRadius: 8,
    backgroundColor: "#cbd5e1",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  meta: {
    color: "#1d4ed8",
    fontWeight: "600",
    fontSize: 12,
  },
  preview: {
    color: "#334155",
    marginTop: 2,
  },
  date: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 12,
  },
});
