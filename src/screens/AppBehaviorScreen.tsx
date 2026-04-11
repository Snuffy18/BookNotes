import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ProfileStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "AppBehavior">;

export function AppBehaviorScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode } = useAppSettings();
  const [autoSave, setAutoSave] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState(true);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarSide}
          onPress={() => navigation.goBack()}
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
          App Behavior
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SettingsOptionHeroCard
          icon="options-outline"
          title="App Behavior"
          description="Choose how scans are saved, when your device gives haptic feedback, and how offline scans are queued."
        />
        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <SettingToggle
            label="Auto-save scans"
            description="Save each generated report automatically."
            value={autoSave}
            onValueChange={setAutoSave}
            darkMode={darkMode}
          />
          <SettingToggle
            label="Haptic feedback"
            description="Vibrate lightly on key actions."
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            darkMode={darkMode}
          />
          <SettingToggle
            label="Offline queue"
            description="Queue scans while internet is unavailable."
            value={offlineQueue}
            onValueChange={setOfflineQueue}
            darkMode={darkMode}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingToggle({
  label,
  description,
  value,
  onValueChange,
  darkMode,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  darkMode: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.label, darkMode && styles.textDark]}>{label}</Text>
        <Text style={[styles.description, darkMode && styles.descriptionDark]}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
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
  scrollContent: {
    paddingBottom: 32,
    gap: 14,
  },
  settingsCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 16,
    gap: 14,
  },
  settingsCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: lightColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  description: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  descriptionDark: {
    color: darkColors.textSecondary,
  },
  textDark: {
    color: darkColors.textPrimary,
  },
});
