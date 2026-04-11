import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MoonIcon } from "../components/MoonIcon";
import { PaintbrushIcon } from "../components/PaintbrushIcon";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ProfileStackParamList } from "../navigation/types";
import { accentLabels } from "../theme/accentLabels";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Appearance">;

export function AppearanceScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode, themeMode, setThemeMode, accentTheme, accentColor } = useAppSettings();

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
          Appearance
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SettingsOptionHeroCard
          icon="color-palette-outline"
          title="Appearance"
          description="Switch between light and dark mode, then open Themes to pick an accent palette for buttons and highlights."
        />

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <View style={styles.row}>
            <View style={styles.darkModeRowLeft}>
              <MoonIcon size={22} color={accentColor} />
              <View style={styles.rowTextWrap}>
                <Text style={[styles.label, darkMode && styles.textDark]}>Dark mode</Text>
                <Text style={[styles.description, darkMode && styles.descriptionDark]}>
                  Use dark app appearance.
                </Text>
              </View>
            </View>
            <Switch
              value={themeMode === "dark"}
              onValueChange={(value) => setThemeMode(value ? "dark" : "light")}
            />
          </View>

          <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />

          <TouchableOpacity
            style={styles.themesRow}
            onPress={() => navigation.navigate("Themes")}
            activeOpacity={0.85}
          >
            <View style={styles.themesRowLeft}>
              <PaintbrushIcon size={22} color={accentColor} />
              <Text style={[styles.label, darkMode && styles.textDark]} numberOfLines={1}>
                Themes
              </Text>
            </View>
            <View style={styles.themesRowRight}>
              <Text
                style={[styles.themesCurrent, darkMode && styles.themesCurrentDark]}
                numberOfLines={1}
              >
                {accentLabels[accentTheme]}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.accentChevron} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 32,
    gap: 14,
  },
  settingsCard: {
    backgroundColor: lightColors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 16,
  },
  settingsCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  settingsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: lightColors.borderStrong,
    marginVertical: 12,
  },
  settingsSeparatorDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  darkModeRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
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
  themesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  themesRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  themesRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  themesCurrent: {
    flexShrink: 1,
    fontSize: 13,
    color: lightColors.textMuted,
    fontWeight: "500",
    textAlign: "right",
  },
  themesCurrentDark: {
    color: darkColors.textSecondary,
  },
  accentChevron: {
    opacity: 0.55,
  },
});
