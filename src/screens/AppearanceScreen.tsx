import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MoonIcon } from "../components/MoonIcon";
import { PaintbrushIcon } from "../components/PaintbrushIcon";
import { SettingsGroupCard, settingsScrollContentLightStyle, settingsScrollLight } from "../components/SettingsGroupCard";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ProfileStackParamList } from "../navigation/types";
import { accentLabels } from "../theme/accentLabels";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Appearance">;

const CHEVRON_SIZE = 15;
const ROW_ICON_SIZE = 18;

export function AppearanceScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode, themeMode, setThemeMode, accentTheme, accentColor } = useAppSettings();

  const switchTrack = {
    false: darkMode ? "#3f3f3f" : "#d1d5db",
    true: accentColor,
  } as const;

  const chevronColor = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

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

      <ScrollView
        style={settingsScrollLight}
        contentContainerStyle={[
          styles.scrollContent,
          settingsScrollContentLightStyle({ paddingBottom: 32 }),
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsOptionHeroCard
          icon="color-palette-outline"
          title="Appearance"
          description="Theme, accent color and display mode."
          compactDescription
        />

        <SettingsGroupCard darkMode={darkMode}>
          <View style={styles.row}>
            <View style={styles.rowIconSlot}>
              <MoonIcon size={ROW_ICON_SIZE} color={accentColor} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.label, darkMode && styles.labelDark]}>Dark mode</Text>
              <Text style={[styles.description, darkMode && styles.descriptionDark]}>
                Use dark app appearance.
              </Text>
            </View>
            <Switch
              value={themeMode === "dark"}
              onValueChange={(value) => setThemeMode(value ? "dark" : "light")}
              trackColor={switchTrack}
              thumbColor="#ffffff"
              ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
            />
          </View>

          <View style={[styles.rowDivider, darkMode ? styles.rowDividerDark : styles.rowDividerLight]} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("Themes")}
            activeOpacity={0.85}
          >
            <View style={styles.rowIconSlot}>
              <PaintbrushIcon size={ROW_ICON_SIZE} color={accentColor} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.label, darkMode && styles.labelDark]} numberOfLines={1}>
                Themes
              </Text>
              <Text style={[styles.description, darkMode && styles.descriptionDark]} numberOfLines={1}>
                Current: {accentLabels[accentTheme]}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={chevronColor} />
          </TouchableOpacity>
        </SettingsGroupCard>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowIconSlot: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    width: "90%",
    alignSelf: "center",
  },
  rowDividerLight: {
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  rowDividerDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  label: {
    color: lightColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  labelDark: {
    color: "#ffffff",
  },
  description: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  descriptionDark: {
    color: darkColors.textSecondary,
  },
});
