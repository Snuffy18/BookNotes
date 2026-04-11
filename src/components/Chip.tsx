import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { hexWithAlpha } from "../theme/colorUtils";

export function Chip({
  label,
  active = false,
  onPress,
  activeColor,
  activeTextColor,
  inactiveTextColor,
  inactiveBackgroundColor,
  activeVariant = "fill",
  compact = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  activeColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  inactiveBackgroundColor?: string;
  /** `fill` = solid accent; `subtle` = tinted background + border (for toggles). */
  activeVariant?: "fill" | "subtle";
  /** Smaller label (e.g. scan option toggles). */
  compact?: boolean;
}) {
  const subtleActiveStyle =
    active && activeVariant === "subtle" && activeColor
      ? {
          backgroundColor: hexWithAlpha(activeColor, 0.14),
          borderWidth: 1,
          borderColor: hexWithAlpha(activeColor, 0.45),
        }
      : null;

  const fillActiveStyle =
    active && activeVariant === "fill" && activeColor ? { backgroundColor: activeColor } : null;

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        compact && styles.chipCompact,
        !active && inactiveBackgroundColor ? { backgroundColor: inactiveBackgroundColor } : null,
        active && styles.chipActive,
        subtleActiveStyle,
        fillActiveStyle,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      <Text
        style={[
          styles.chipText,
          compact && styles.chipTextCompact,
          !active && inactiveTextColor ? { color: inactiveTextColor } : null,
          active && styles.chipTextActive,
          active && activeTextColor ? { color: activeTextColor } : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#e2e8f0",
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
  },
  chipActive: {
    backgroundColor: "#bfdbfe",
  },
  chipText: {
    color: "#334155",
    fontWeight: "500",
    fontSize: 14,
  },
  chipTextCompact: {
    fontSize: 11,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#1e3a8a",
    fontWeight: "700",
  },
});
