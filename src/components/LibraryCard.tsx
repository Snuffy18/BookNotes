import { StyleSheet, Text, View } from "react-native";
import type { ScanItem } from "../types/note";
import { FONT_CANELA_TEXT_BOLD } from "../theme/fonts";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";

export function LibraryCard({ item }: { item: ScanItem }) {
  return (
    <View style={styles.libraryCard}>
      <Text style={styles.libraryBook}>{item.book ?? "Scanned Book Page"}</Text>
      <Text style={styles.libraryChapter}>{item.chapter ?? "AI Generated Notes"}</Text>
      <Text style={styles.libraryPreview}>{stripMarkdownBoldMarkers(item.notes.summary)}</Text>
      <Text style={styles.libraryDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  libraryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 4,
  },
  libraryBook: {
    color: "#0f172a",
    fontSize: 16,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  libraryChapter: {
    color: "#1e40af",
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  libraryPreview: {
    color: "#334155",
    marginTop: 2,
  },
  libraryDate: {
    color: "#64748b",
    marginTop: 6,
    fontSize: 12,
  },
});
