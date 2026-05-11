import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { HeaderText } from "../components/HeaderText";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";
import type { ExtractionMode } from "../types/note";

type Props = NativeStackScreenProps<ScanStackParamList, "ExtractionOptions">;
type IoniconName = ComponentProps<typeof Ionicons>["name"];

const SMART_BLUE_BG = "rgba(59,130,246,0.12)";
const SMART_BLUE_BORDER = "rgba(59,130,246,0.4)";
const SMART_BLUE_ICON = "#60a5fa";
const SMART_ICON_CIRCLE = "rgba(59,130,246,0.15)";
const SMART_CHECK_FILL = "#3b82f6";

const EXTRACTION_OPTIONS: Array<{
  mode: ExtractionMode;
  label: string;
  icon: IoniconName;
}> = [
  { mode: "quotes", label: "Quotes", icon: "chatbubble-ellipses-outline" },
  { mode: "words", label: "Words", icon: "text-outline" },
  { mode: "bulletPoints", label: "Bullet Points", icon: "list-outline" },
  { mode: "everything", label: "Everything", icon: "sparkles-outline" },
];

export function ExtractionOptionsScreen({ navigation, route }: Props) {
  const { darkMode, accentGradient } = useAppSettings();
  const [smartExtractSelected, setSmartExtractSelected] = useState(true);
  const [selectedModes, setSelectedModes] = useState<ExtractionMode[]>([]);
  const selectedModeSet = useMemo(() => new Set(selectedModes), [selectedModes]);

  const titleColor = darkMode ? "#ffffff" : lightColors.textPrimary;

  const onSelectSmartExtract = () => {
    Haptics.selectionAsync().catch(() => {});
    setSmartExtractSelected(true);
  };

  const onToggleManual = (mode: ExtractionMode) => {
    Haptics.selectionAsync().catch(() => {});
    setSmartExtractSelected(false);
    setSelectedModes((current) => {
      if (mode === "everything") {
        return ["everything"];
      }

      const withoutEverything = current.filter((item) => item !== "everything");
      const isSelected = withoutEverything.includes(mode);
      const next = isSelected
        ? withoutEverything.filter((item) => item !== mode)
        : [...withoutEverything, mode];

      return next.length > 0 ? next : ["everything"];
    });
  };

  const onExtract = () => {
    Haptics.selectionAsync().catch(() => {});
    const extractionModes: ExtractionMode[] = smartExtractSelected
      ? ["everything"]
      : selectedModes.length > 0
        ? selectedModes
        : ["everything"];
    navigation.replace("Processing", {
      imageUri: route.params.imageUri,
      ...(route.params.page ? { page: route.params.page } : {}),
      extractionMode: extractionModes[0] ?? "everything",
      extractionModes,
    });
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.backButton, darkMode && styles.backButtonDark]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <LinearGradient
          colors={accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconHero}
        >
          <Ionicons name="scan" size={32} color="#fff" />
        </LinearGradient>

        <HeaderText
          title="What do you want to extract"
          style={styles.titleBlock}
          titleStyle={[styles.titleText, { color: titleColor }]}
        />

        <TouchableOpacity
          style={styles.smartExtractCard}
          onPress={onSelectSmartExtract}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityState={{ selected: smartExtractSelected }}
        >
          <View style={styles.smartExtractIconCircle}>
            <Ionicons name="sparkles" size={20} color={SMART_BLUE_ICON} />
          </View>
          <View style={styles.smartExtractCopy}>
            <Text style={styles.smartExtractTitle}>Smart Extract</Text>
            <Text style={styles.smartExtractSubtitle}>
              AI picks what matters — ideas, quotes, and key points
            </Text>
          </View>
          <View
            style={[
              styles.smartExtractCheck,
              smartExtractSelected && styles.smartExtractCheckSelected,
            ]}
          >
            {smartExtractSelected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
        </TouchableOpacity>

        <Text
          style={[
            styles.manualDivider,
            darkMode ? styles.manualDividerDark : styles.manualDividerLight,
          ]}
        >
          Or choose manually
        </Text>

        <View style={styles.optionList}>
          {EXTRACTION_OPTIONS.map((option) => {
            const isSelected = !smartExtractSelected && selectedModeSet.has(option.mode);
            return (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.optionRow,
                  darkMode ? styles.optionRowDark : styles.optionRowLight,
                  isSelected && styles.optionRowSelected,
                ]}
                onPress={() => onToggleManual(option.mode)}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.optionIcon,
                    darkMode ? styles.optionIconDark : styles.optionIconLight,
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={darkMode ? "#ffffff" : lightColors.textPrimary}
                  />
                </View>
                <Text
                  style={[styles.optionText, darkMode ? styles.optionTextDark : styles.optionTextLight]}
                >
                  {option.label}
                </Text>
                <View
                  style={[
                    styles.radioCircle,
                    darkMode ? styles.radioCircleDark : styles.radioCircleLight,
                    isSelected && styles.radioCircleSelected,
                  ]}
                >
                  {isSelected ? <View style={styles.radioCircleDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.extractButton} onPress={onExtract} activeOpacity={0.9}>
          <Text style={styles.extractButtonText}>Extract</Text>
          <Ionicons name="arrow-forward" size={20} color="#111111" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  headerRow: {
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  backButtonDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 90,
    gap: 0,
  },
  iconHero: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  titleBlock: {
    alignItems: "center",
    marginBottom: 18,
    marginTop: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  smartExtractCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 18,
    borderRadius: 16,
    backgroundColor: SMART_BLUE_BG,
    borderWidth: 1.5,
    borderColor: SMART_BLUE_BORDER,
    gap: 14,
  },
  smartExtractIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SMART_ICON_CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  smartExtractCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  smartExtractTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  smartExtractSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 16,
  },
  smartExtractCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "rgba(96,165,250,0.5)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  smartExtractCheckSelected: {
    backgroundColor: SMART_CHECK_FILL,
    borderColor: SMART_CHECK_FILL,
  },
  manualDivider: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.77,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 16,
  },
  manualDividerDark: {
    color: "rgba(255,255,255,0.3)",
  },
  manualDividerLight: {
    color: "rgba(15,23,42,0.3)",
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 0.5,
    gap: 12,
  },
  optionRowDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  optionRowLight: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderColor: "rgba(0,0,0,0.08)",
  },
  optionRowSelected: {
    backgroundColor: "rgba(59,130,246,0.1)",
    borderColor: "rgba(59,130,246,0.35)",
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  optionIconLight: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  optionTextDark: {
    color: "#ffffff",
  },
  optionTextLight: {
    color: lightColors.textPrimary,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleDark: {
    borderColor: "rgba(255,255,255,0.35)",
  },
  radioCircleLight: {
    borderColor: "rgba(15,23,42,0.28)",
  },
  radioCircleSelected: {
    borderColor: SMART_CHECK_FILL,
    backgroundColor: SMART_CHECK_FILL,
  },
  radioCircleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  extractButton: {
    marginTop: 22,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  extractButtonText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "600",
  },
});
