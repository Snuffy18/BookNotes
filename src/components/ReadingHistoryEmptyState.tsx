import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ReadingHistoryEmptyHourglass } from "./ReadingHistoryEmptyHourglass";

type Props = {
  darkMode: boolean;
  onStartReading: () => void;
};

export function ReadingHistoryEmptyState({ darkMode, onStartReading }: Props) {
  return (
    <View style={styles.wrap}>
      <ReadingHistoryEmptyHourglass />

      <View style={styles.textBlock}>
        <Text style={[styles.title, !darkMode && styles.titleLight]}>No sessions yet</Text>
        <Text style={[styles.subtitle, !darkMode && styles.subtitleLight]}>
          Finish a reading timer and save it — your sessions will appear here over time.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onStartReading}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Start a reading session"
      >
        <Ionicons name="play" size={16} color="#111111" />
        <Text style={styles.actionBtnText}>Start a reading session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 32,
  },
  textBlock: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  titleLight: {
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20.8,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    maxWidth: 220,
  },
  subtitleLight: {
    color: "rgba(15,23,42,0.4)",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
});
