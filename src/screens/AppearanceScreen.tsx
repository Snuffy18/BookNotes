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
  const subtitleColor = darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

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
          description="Theme, accent color and display mode."
          compactDescription
        />

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MoonIcon size={ROW_ICON_SIZE} color={accentColor} />
              <View style={styles.rowTextWrap}>
                <Text style={[styles.label, darkMode && styles.labelDark]}>Dark mode</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>Use dark app appearance.</Text>
              </View>
            </View>
            <Switch
              value={themeMode === "dark"}
              onValueChange={(value) => setThemeMode(value ? "dark" : "light")}
              trackColor={switchTrack}
              thumbColor="#ffffff"
              ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
            />
          </View>

          <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate("Themes")}
            activeOpacity={0.85}
          >
            <View style={styles.rowLeft}>
              <PaintbrushIcon size={ROW_ICON_SIZE} color={accentColor} />
              <View style={styles.rowTextWrap}>
                <Text style={[styles.label, darkMode && styles.labelDark]} numberOfLines={1}>
                  Themes
                </Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
                  Current: {accentLabels[accentTheme]}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={chevronColor} />
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
    paddingVertical: 18,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 18,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  label: {
    color: lightColors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  labelDark: {
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "400",
  },
});
