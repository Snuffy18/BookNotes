import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { useAppSettings } from "../context/AppSettingsContext";
import { darkColors, lightColors } from "../theme/colors";
import { hexWithAlpha } from "../theme/colorUtils";

export function HeaderText({
  title,
  subtitle,
  subtitleMuted = false,
  style,
  /** Renders on the same row as the title (e.g. streak pill). */
  trailing,
}: {
  title: string;
  subtitle?: string;
  /** Smaller subtitle at ~70% opacity for clearer hierarchy (e.g. Scan). */
  subtitleMuted?: boolean;
  style?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
}) {
  const { darkMode } = useAppSettings();

  const subtitleColor = subtitleMuted
    ? hexWithAlpha(darkMode ? darkColors.textSecondary : lightColors.textSecondary, 0.7)
    : undefined;

  const hasTrailing = Boolean(trailing);

  return (
    <View style={[styles.headerBlock, !subtitle && styles.headerBlockTitleOnly, style]}>
      <View style={[styles.titleRow, hasTrailing && styles.titleRowWithTrailing]}>
        <Text
          style={[styles.headerTitle, darkMode && styles.headerTitleDark, hasTrailing && styles.headerTitleFlex]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle ? (
        <Text
          style={[
            styles.headerSubtitle,
            subtitleMuted && styles.headerSubtitleMuted,
            darkMode && styles.headerSubtitleDark,
            subtitleColor ? { color: subtitleColor } : null,
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: 16,
  },
  headerBlockTitleOnly: {
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
  },
  titleRowWithTrailing: {
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  headerTitleFlex: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleDark: {
    color: darkColors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 4,
    color: lightColors.textSecondary,
    fontSize: 14,
  },
  headerSubtitleMuted: {
    fontSize: 12,
    lineHeight: 16,
  },
  headerSubtitleDark: {
    color: darkColors.textSecondary,
  },
});
