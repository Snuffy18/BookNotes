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
import { hexWithAlpha } from "../theme/colorUtils";
import { darkColors } from "../theme/colors";
import type { ExtractionMode } from "../types/note";

type Props = NativeStackScreenProps<ScanStackParamList, "ExtractionOptions">;
type IoniconName = ComponentProps<typeof Ionicons>["name"];

const SCREEN_BG = "#111";

const EXTRACTION_OPTIONS: Array<{
  mode: ExtractionMode;
  label: string;
  subtitle: string;
  icon: IoniconName;
}> = [
  {
    mode: "quotes",
    label: "Quotes",
    subtitle: "Notable quotes and passages from the text",
    icon: "chatbubble-ellipses-outline",
  },
  {
    mode: "words",
    label: "Words",
    subtitle: "Key vocabulary, terms and definitions",
    icon: "text-outline",
  },
  {
    mode: "bulletPoints",
    label: "Bullet Points",
    subtitle: "Main ideas as concise bullet points",
    icon: "list-outline",
  },
  {
    mode: "everything",
    label: "Everything",
    subtitle: "All of the above combined",
    icon: "sparkles-outline",
  },
];

export function ExtractionOptionsScreen({ navigation, route }: Props) {
  const { accentGradient, accentColor } = useAppSettings();
  const [smartExtractSelected, setSmartExtractSelected] = useState(true);
  const [selectedModes, setSelectedModes] = useState<ExtractionMode[]>([]);
  const selectedModeSet = useMemo(() => new Set(selectedModes), [selectedModes]);

  const accentCardBg = useMemo(() => hexWithAlpha(accentColor, 0.12), [accentColor]);
  const accentCardBorder = useMemo(() => hexWithAlpha(accentColor, 0.4), [accentColor]);
  const accentIconCircle = useMemo(() => hexWithAlpha(accentColor, 0.15), [accentColor]);
  const accentCheckBorder = useMemo(() => hexWithAlpha(accentColor, 0.5), [accentColor]);
  const accentRowSelectedBg = useMemo(() => hexWithAlpha(accentColor, 0.1), [accentColor]);
  const accentRowSelectedBorder = useMemo(() => hexWithAlpha(accentColor, 0.35), [accentColor]);

  const titleColor = "#ffffff";

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
    const p = route.params;
    navigation.replace("Processing", {
      imageUri: p.imageUri,
      ...(p.page ? { page: p.page } : {}),
      ...(p.chapter ? { chapter: p.chapter } : {}),
      extractionMode: extractionModes[0] ?? "everything",
      extractionModes,
      ...(p.rescanForScanId ? { rescanForScanId: p.rescanForScanId } : {}),
      ...(p.studyPreferences ? { studyPreferences: p.studyPreferences } : {}),
      ...(p.rescanReturnTab ? { rescanReturnTab: p.rescanReturnTab } : {}),
    });
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={darkColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <LinearGradient
          colors={accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconHero}
        >
          <Ionicons name="scan" size={20} color="#fff" />
        </LinearGradient>

        <HeaderText
          title="What do you want to extract?"
          style={styles.titleBlock}
          titleStyle={[styles.titleText, { color: titleColor }]}
        />

        <TouchableOpacity
          style={[
            styles.smartExtractCard,
            {
              backgroundColor: accentCardBg,
              borderColor: accentCardBorder,
            },
          ]}
          onPress={onSelectSmartExtract}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityState={{ selected: smartExtractSelected }}
        >
          <View style={[styles.smartExtractIconCircle, { backgroundColor: accentIconCircle }]}>
            <Ionicons name="sparkles" size={20} color={accentColor} />
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
              { borderColor: accentCheckBorder },
              smartExtractSelected && {
                backgroundColor: accentColor,
                borderColor: accentColor,
              },
            ]}
          >
            {smartExtractSelected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
        </TouchableOpacity>

        <Text style={styles.manualDivider}>Or choose manually</Text>

        <View style={styles.optionList}>
          {EXTRACTION_OPTIONS.map((option) => {
            const isSelected = !smartExtractSelected && selectedModeSet.has(option.mode);
            return (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.optionRow,
                  isSelected && {
                    backgroundColor: accentRowSelectedBg,
                    borderColor: accentRowSelectedBorder,
                  },
                ]}
                onPress={() => onToggleManual(option.mode)}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={option.icon} size={15} color="#ffffff" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionText}>{option.label}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && {
                      borderColor: accentColor,
                      backgroundColor: accentColor,
                    },
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
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 18,
    paddingTop: 10,
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
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 90,
    gap: 0,
  },
  iconHero: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  titleBlock: {
    alignItems: "center",
    marginBottom: 18,
    marginTop: 12,
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
    borderWidth: 1.5,
    gap: 14,
  },
  smartExtractIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  manualDivider: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.77,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 16,
    color: "rgba(255,255,255,0.3)",
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  optionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#ffffff",
  },
  optionSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 14,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "rgba(255,255,255,0.25)",
  },
  radioCircleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
