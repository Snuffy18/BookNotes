import { StyleSheet, Text, TouchableOpacity } from "react-native";

export function Chip({
  label,
  active = false,
  onPress,
  activeColor,
  activeTextColor,
  inactiveTextColor,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  activeColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, active && activeColor ? { backgroundColor: activeColor } : null]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      <Text
        style={[
          styles.chipText,
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
  chipActive: {
    backgroundColor: "#bfdbfe",
  },
  chipText: {
    color: "#334155",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#1e3a8a",
    fontWeight: "700",
  },
});
