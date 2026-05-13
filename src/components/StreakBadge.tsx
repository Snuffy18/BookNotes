import { Pressable, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { FireIcon } from "./FireIcon";
import { useAppSettings } from "../context/AppSettingsContext";
import { useStreak } from "../context/StreakContext";
import type { ScanStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ScanStackParamList, "ScanCamera">;

type Props = {
  variant?: "default" | "homeLocked";
};

/** Cal AI–style pill: flame + streak count; opens Streak details screen. */
export function StreakBadge({ variant = "default" }: Props) {
  const navigation = useNavigation<Nav>();
  const { darkMode } = useAppSettings();
  const { streak } = useStreak();

  const openStreakDetails = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate("StreakDetails");
  };

  return (
    <Pressable
      onPress={openStreakDetails}
      style={({ pressed }) => [
        styles.pill,
        darkMode && styles.pillDark,
        variant === "homeLocked" && styles.pillHomeLocked,
        pressed && styles.pillPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${streak.currentStreak} day streak. Opens streak details.`}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <FireIcon size={16} />
      <Text
        style={[
          styles.count,
          darkMode && styles.countDark,
          variant === "homeLocked" && styles.countHomeLocked,
        ]}
      >
        {streak.currentStreak} {streak.currentStreak === 1 ? "day" : "days"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15,23,42,0.08)",
  },
  pillDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  pillHomeLocked: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "transparent",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pillPressed: {
    opacity: 0.75,
  },
  count: {
    fontSize: 13,
    fontWeight: "800",
    color: lightColors.textPrimary,
  },
  countDark: {
    fontSize: 13,
    color: darkColors.textPrimary,
  },
  countHomeLocked: {
    fontWeight: "500",
    color: "#ffffff",
  },
});
