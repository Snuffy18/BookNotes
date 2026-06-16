import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsGroupCard, SETTINGS_CARD_SHADOW_BLEED } from "../components/SettingsGroupCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ProfileStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "OutputLanguage">;

/** Placeholder until output language is stored in preferences; only English is available today. */
export function OutputLanguageScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode } = useAppSettings();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.screen, darkMode && styles.screenDark, !darkMode && styles.screenLight]}
    >
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
            color={darkMode ? "#ffffff" : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, darkMode && styles.topBarTitleDark]} numberOfLines={1}>
          Output language
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <SettingsGroupCard darkMode={darkMode}>
        <View style={styles.row}>
          <Text style={[styles.langLabel, darkMode && styles.langLabelDark]}>English</Text>
          <Ionicons name="checkmark" size={20} color="#60a5fa" />
        </View>
      </SettingsGroupCard>
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
  screenLight: {
    overflow: "visible",
    paddingBottom: SETTINGS_CARD_SHADOW_BLEED,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    minHeight: 44,
  },
  topBarSide: {
    width: 40,
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  topBarTitleDark: {
    color: "#ffffff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  langLabelDark: {
    color: "#ffffff",
  },
});
