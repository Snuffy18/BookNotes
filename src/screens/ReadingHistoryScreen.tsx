import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSettings } from "../context/AppSettingsContext";
import { useReadingSession } from "../context/ReadingSessionContext";
import type { ScanStackParamList } from "../navigation/types";
import type { ReadingSession } from "../types/note";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ScanStackParamList, "ReadingHistory">;

function formatDurationLabel(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatSessionEndedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function HistoryRow({ session, darkMode }: { session: ReadingSession; darkMode: boolean }) {
  const title = session.bookTitle?.trim() || "No book selected";
  const pages = `p. ${session.startPage} → ${session.endPage}`;
  const meta = `${formatDurationLabel(session.durationSeconds)} · ${formatSessionEndedAt(session.endedAt)}`;
  return (
    <View style={[styles.row, darkMode && styles.rowDark]}>
      <Text style={[styles.rowTitle, darkMode && styles.rowTitleDark]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.rowPages, darkMode && styles.rowPagesDark]}>{pages}</Text>
      <Text style={[styles.rowMeta, darkMode && styles.rowMetaDark]}>{meta}</Text>
    </View>
  );
}

export function ReadingHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode } = useAppSettings();
  const { sessions } = useReadingSession();

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarSide}
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, darkMode && styles.topBarTitleDark]} numberOfLines={1}>
          Reading history
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          sessions.length === 0 && styles.listContentEmpty,
        ]}
        renderItem={({ item }) => <HistoryRow session={item} darkMode={darkMode} />}
        ListEmptyComponent={
          <Text style={[styles.empty, darkMode && styles.emptyDark]}>
            No saved sessions yet. Finish a timer on the Scan page and tap Save session to see it here.
          </Text>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    minHeight: 44,
  },
  topBarSide: {
    width: 40,
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  topBarTitleDark: {
    color: darkColors.textPrimary,
  },
  listContent: {
    paddingBottom: 32,
    gap: 0,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    color: lightColors.textMuted,
    textAlign: "center",
  },
  emptyDark: {
    color: darkColors.textSecondary,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lightColors.borderStrong,
  },
  rowDark: {
    borderBottomColor: darkColors.border,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textPrimary,
    marginBottom: 4,
  },
  rowTitleDark: {
    color: darkColors.textPrimary,
  },
  rowPages: {
    fontSize: 15,
    color: lightColors.textSecondary,
    marginBottom: 2,
  },
  rowPagesDark: {
    color: darkColors.textSecondary,
  },
  rowMeta: {
    fontSize: 13,
    color: lightColors.textMuted,
  },
  rowMetaDark: {
    color: darkColors.textSecondary,
  },
});
