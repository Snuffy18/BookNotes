import { StyleSheet, Text, View } from "react-native";
import { useAppSettings } from "../context/AppSettingsContext";
import { darkColors, lightColors } from "../theme/colors";

export function HeaderText({ title, subtitle }: { title: string; subtitle: string }) {
  const { darkMode } = useAppSettings();

  return (
    <View style={styles.headerBlock}>
      <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>{title}</Text>
      <Text style={[styles.headerSubtitle, darkMode && styles.headerSubtitleDark]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  headerTitleDark: {
    color: darkColors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 4,
    color: lightColors.textSecondary,
    fontSize: 14,
  },
  headerSubtitleDark: {
    color: darkColors.textSecondary,
  },
});
