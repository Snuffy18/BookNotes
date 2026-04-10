import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderText } from "../components/HeaderText";
import { useAppSettings } from "../context/AppSettingsContext";
import type { AccentTheme } from "../theme/colors";
import { accentColors, accentGradients, darkColors, lightColors } from "../theme/colors";

const accentLabels: Record<AccentTheme, string> = {
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  emerald: "Emerald",
  orange: "Orange",
  red: "Red",
  teal: "Teal",
};

export function ProfileScreen() {
  const { darkMode, themeMode, setThemeMode, accentTheme, setAccentTheme } = useAppSettings();
  const [autoSave, setAutoSave] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState(true);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.screen, darkMode && styles.screenDark]}
    >
      <HeaderText
        title="Profile & Settings"
        subtitle="Tune note style, language, and export options."
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Themes</Text>
          <Text style={[styles.description, darkMode && styles.descriptionDark]}>
            Choose accent color style.
          </Text>
          <TouchableOpacity
            style={[styles.dropdownTrigger, darkMode && styles.dropdownTriggerDark]}
            onPress={() => setShowThemeDropdown(true)}
            activeOpacity={0.85}
          >
            <View style={styles.dropdownTriggerLeft}>
              <LinearGradient
                colors={accentGradients[accentTheme][darkMode ? "dark" : "light"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dropdownAccentDot}
              />
              <Text style={[styles.dropdownText, darkMode && styles.textDark]}>
                {accentLabels[accentTheme]}
              </Text>
            </View>
            <Text style={[styles.dropdownChevron, darkMode && styles.dropdownChevronDark]}>v</Text>
          </TouchableOpacity>
          <SettingToggle
            label="Dark mode"
            description="Use dark app appearance."
            value={themeMode === "dark"}
            onValueChange={(value) => setThemeMode(value ? "dark" : "light")}
            darkMode={darkMode}
          />
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Study Preferences</Text>
          <SettingRow label="Note style" value="Concise" darkMode={darkMode} />
          <SettingRow label="Summary depth" value="Standard" darkMode={darkMode} />
          <SettingRow label="Output language" value="English" darkMode={darkMode} />
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>App Behavior</Text>
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

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Export</Text>
          <SettingRow label="Default format" value="PDF" darkMode={darkMode} />
          <SettingRow label="Include keywords" value="Enabled" darkMode={darkMode} />
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <Text style={[styles.hint, darkMode && styles.hintDark]}>
            Set EXPO_PUBLIC_OPENAI_API_KEY in your environment to enable AI generation.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showThemeDropdown} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowThemeDropdown(false)}>
          <Pressable style={[styles.modalCard, darkMode && styles.modalCardDark]} onPress={() => {}}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Choose Accent Theme</Text>
            <FlatList
              data={(Object.keys(accentColors) as AccentTheme[]).map((key) => ({
                key,
                label: accentLabels[key],
                color: accentColors[key][darkMode ? "dark" : "light"],
                gradient: accentGradients[key][darkMode ? "dark" : "light"],
              }))}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.themeRow,
                    accentTheme === item.key && styles.themeRowActive,
                    accentTheme === item.key ? { borderColor: item.color } : null,
                    darkMode && accentTheme === item.key && styles.themeRowActiveDark,
                  ]}
                  onPress={() => {
                    setAccentTheme(item.key);
                    setShowThemeDropdown(false);
                  }}
                >
                  <LinearGradient
                    colors={item.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dropdownAccentDot}
                  />
                  <Text style={[styles.themeRowText, darkMode && styles.textDark]}>{item.label}</Text>
                  {accentTheme === item.key ? (
                    <Text style={[styles.themeRowSelected, darkMode && styles.textDark]}>Selected</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={[styles.themeRowSeparator, darkMode && styles.themeRowSeparatorDark]} />
              )}
            />
            <Text style={[styles.tapOutsideHint, darkMode && styles.tapOutsideHintDark]}>
              Tap outside to close
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SettingRow({ label, value, darkMode }: { label: string; value: string; darkMode: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, darkMode && styles.textDark]}>{label}</Text>
      <Text style={[styles.value, darkMode && styles.valueDark]}>{value}</Text>
    </View>
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
    paddingTop: 10,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  scrollContent: {
    paddingBottom: 110,
    gap: 12,
  },
  settingsCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 16,
    gap: 12,
  },
  settingsCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  sectionTitle: {
    color: lightColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
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
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    backgroundColor: lightColors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownTriggerDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.borderStrong,
  },
  dropdownTriggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownText: {
    color: lightColors.textPrimary,
    fontWeight: "600",
  },
  dropdownChevron: {
    color: lightColors.textMuted,
    fontWeight: "700",
  },
  dropdownChevronDark: {
    color: darkColors.textSecondary,
  },
  dropdownAccentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: darkColors.overlay,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 12,
    gap: 10,
    maxHeight: "65%",
  },
  modalCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  modalTitle: {
    color: lightColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  themeRowActive: {
    backgroundColor: "#f8fafc",
  },
  themeRowActiveDark: {
    backgroundColor: "#2a2a2a",
  },
  themeRowText: {
    color: lightColors.textPrimary,
    flex: 1,
  },
  themeRowSelected: {
    color: lightColors.textPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  themeRowSeparator: {
    height: 1,
    backgroundColor: lightColors.border,
  },
  themeRowSeparatorDark: {
    backgroundColor: darkColors.borderStrong,
  },
  tapOutsideHint: {
    textAlign: "center",
    color: lightColors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  tapOutsideHintDark: {
    color: darkColors.textSecondary,
  },
  label: {
    color: lightColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  value: {
    color: lightColors.textSecondary,
    fontSize: 14,
  },
  valueDark: {
    color: darkColors.textPrimary,
  },
  description: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  descriptionDark: {
    color: darkColors.textSecondary,
  },
  hint: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  hintDark: {
    color: darkColors.textSecondary,
  },
  textDark: {
    color: darkColors.textPrimary,
  },
});
