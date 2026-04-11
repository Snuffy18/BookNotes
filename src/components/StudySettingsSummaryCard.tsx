import { StyleSheet, Text, View } from "react-native";
import { labelHighlightSummary, labelLength, labelTone } from "../study/studyPreferenceLabels";
import type { StudyPreferencesSnapshot } from "../types/studyPreferences";
import { darkColors, lightColors } from "../theme/colors";

type Props = {
  prefs: StudyPreferencesSnapshot;
  darkMode: boolean;
  accentColor: string;
};

export function StudySettingsSummaryCard({ prefs, darkMode, accentColor }: Props) {
  return (
    <View style={[styles.card, darkMode && styles.cardDark]}>
      <Text style={[styles.title, darkMode && styles.titleDark]}>Study settings</Text>
      <View style={styles.row}>
        <Text style={[styles.label, darkMode && styles.mutedDark]}>Tone</Text>
        <Text style={[styles.value, { color: accentColor }]} numberOfLines={1}>
          {labelTone(prefs.tone)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, darkMode && styles.mutedDark]}>Length</Text>
        <Text style={[styles.value, { color: accentColor }]} numberOfLines={1}>
          {labelLength(prefs.length)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, darkMode && styles.mutedDark]}>Highlights</Text>
        <Text
          style={[styles.value, styles.valueFlex, darkMode && styles.valueTextDark]}
          numberOfLines={3}
        >
          {labelHighlightSummary(prefs)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 14,
    gap: 10,
  },
  cardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  title: {
    color: lightColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  titleDark: {
    color: darkColors.textPrimary,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    color: lightColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    minWidth: 72,
    paddingTop: 1,
  },
  mutedDark: {
    color: darkColors.textMuted,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: lightColors.textPrimary,
    textAlign: "right",
    flexShrink: 0,
    maxWidth: "72%",
  },
  valueFlex: {
    flex: 1,
    maxWidth: undefined,
  },
  valueTextDark: {
    color: darkColors.textSecondary,
  },
});
