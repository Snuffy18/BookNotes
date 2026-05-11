import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import { useAppSettings } from "../context/AppSettingsContext";
import { darkColors, lightColors } from "../theme/colors";

type IonName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  icon: IonName;
  title: string;
  description: string;
  /** Single-line 12px description at ~40% opacity (e.g. Themes). */
  compactDescription?: boolean;
};

export function SettingsOptionHeroCard({ icon, title, description, compactDescription }: Props) {
  const { darkMode, accentGradient } = useAppSettings();

  return (
    <View style={[styles.card, darkMode && styles.cardDark]}>
      <LinearGradient
        colors={accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconSquare}
      >
        <Ionicons name={icon} size={28} color="#ffffff" />
      </LinearGradient>
      <Text style={[styles.title, darkMode && styles.titleDark]}>{title}</Text>
      <Text
        style={[
          compactDescription ? styles.descriptionCompact : styles.description,
          compactDescription && (darkMode ? styles.descriptionCompactDark : styles.descriptionCompactLight),
        ]}
        numberOfLines={compactDescription ? 1 : undefined}
      >
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: lightColors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: lightColors.border,
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
    shadowOpacity: 0.2,
  },
  iconSquare: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "700",
    color: lightColors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  titleDark: {
    color: darkColors.textPrimary,
  },
  description: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: lightColors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },
  descriptionDark: {
    color: darkColors.textSecondary,
  },
  descriptionCompact: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    maxWidth: 320,
  },
  descriptionCompactLight: {
    color: "rgba(0,0,0,0.4)",
  },
  descriptionCompactDark: {
    color: "rgba(255,255,255,0.4)",
  },
});
