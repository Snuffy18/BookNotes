import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Graph2DIcon } from "../components/Graph2DIcon";
import { HighlighterIcon } from "../components/HighlighterIcon";
import { RulerIcon } from "../components/RulerIcon";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ProfileStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "StudyPreferences">;

type ToneOption = "simple" | "academic" | "exam";
type LengthOption = "short" | "medium" | "detailed";

type Choice<T extends string> = { id: T; title: string; subtitle: string };

const TONE_CHOICES: Choice<ToneOption>[] = [
  { id: "simple", title: "Simple", subtitle: "Like explaining to a beginner" },
  { id: "academic", title: "Academic", subtitle: "Formal" },
  { id: "exam", title: "Exam-ready", subtitle: "Focused, structured" },
];

const LENGTH_CHOICES: Choice<LengthOption>[] = [
  { id: "short", title: "Short", subtitle: "3–5 bullets" },
  { id: "medium", title: "Medium", subtitle: "" },
  { id: "detailed", title: "Detailed", subtitle: "" },
];

function labelForTone(id: ToneOption): string {
  return TONE_CHOICES.find((c) => c.id === id)?.title ?? id;
}

function labelForLength(id: LengthOption): string {
  const c = LENGTH_CHOICES.find((x) => x.id === id);
  if (!c) return id;
  return c.subtitle ? `${c.title} · ${c.subtitle}` : c.title;
}

function labelForHighlights(
  master: boolean,
  keyTerms: boolean,
  definitions: boolean,
  numbersDates: boolean,
): string {
  if (!master) return "Off";
  const n = [keyTerms, definitions, numbersDates].filter(Boolean).length;
  if (n === 3) return "All";
  if (n === 0) return "None";
  return `${n} of 3`;
}

export function StudyPreferencesScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode, accentColor } = useAppSettings();
  const insets = useSafeAreaInsets();

  const [tone, setTone] = useState<ToneOption>("simple");
  const [length, setLength] = useState<LengthOption>("medium");
  const [openMenu, setOpenMenu] = useState<"tone" | "length" | "highlight" | null>(null);

  const [highlightKeyElements, setHighlightKeyElements] = useState(true);
  const [highlightKeyTerms, setHighlightKeyTerms] = useState(true);
  const [highlightDefinitions, setHighlightDefinitions] = useState(true);
  const [highlightNumbersDates, setHighlightNumbersDates] = useState(true);

  const switchTrack = { false: darkMode ? "#3f3f3f" : "#d1d5db", true: "#34c759" } as const;

  const menuVisible = openMenu !== null;

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const hapticSelect = () => {
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarSide}
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
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
          Study Preferences
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SettingsOptionHeroCard
          icon="school-outline"
          title="Study Preferences"
          description="Choose tone, length, highlights, and language so notes match how you study."
        />

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <View style={styles.settingInlineRow}>
            <View style={styles.settingTextBlock}>
              <View style={[styles.blockTitleRow, styles.blockTitleRowOnly]}>
                <Graph2DIcon size={20} color={accentColor} opacity={darkMode ? 0.95 : 1} />
                <Text style={[styles.blockTitle, darkMode && styles.textDark]}>Tone / complexity</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.dropdown, styles.dropdownInline, darkMode && styles.dropdownDark]}
              onPress={() => {
                hapticLight();
                setOpenMenu("tone");
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownValue, styles.dropdownValueInline, darkMode && styles.textDark]} numberOfLines={1}>
                {labelForTone(tone)}
              </Text>
              <Ionicons name="chevron-down" size={18} color={accentColor} style={styles.dropdownChevron} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <View style={styles.settingInlineRow}>
            <View style={styles.settingTextBlock}>
              <View style={[styles.blockTitleRow, styles.blockTitleRowOnly]}>
                <RulerIcon size={22} color={accentColor} opacity={darkMode ? 0.95 : 1} />
                <Text style={[styles.blockTitle, darkMode && styles.textDark]}>Length</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.dropdown, styles.dropdownInline, darkMode && styles.dropdownDark]}
              onPress={() => {
                hapticLight();
                setOpenMenu("length");
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownValue, styles.dropdownValueInline, darkMode && styles.textDark]} numberOfLines={1}>
                {labelForLength(length)}
              </Text>
              <Ionicons name="chevron-down" size={18} color={accentColor} style={styles.dropdownChevron} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <SettingRow label="Output language" value="English" darkMode={darkMode} />
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <View style={styles.settingInlineRow}>
            <View style={styles.settingTextBlock}>
              <View style={[styles.blockTitleRow, styles.blockTitleRowOnly]}>
                <HighlighterIcon size={20} color={accentColor} opacity={darkMode ? 0.95 : 1} />
                <Text style={[styles.blockTitle, darkMode && styles.textDark]}>Highlight key elements</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.dropdown, styles.dropdownInline, darkMode && styles.dropdownDark]}
              onPress={() => {
                hapticLight();
                setOpenMenu("highlight");
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownValue, styles.dropdownValueInline, darkMode && styles.textDark]} numberOfLines={1}>
                {labelForHighlights(
                  highlightKeyElements,
                  highlightKeyTerms,
                  highlightDefinitions,
                  highlightNumbersDates,
                )}
              </Text>
              <Ionicons name="chevron-down" size={18} color={accentColor} style={styles.dropdownChevron} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={menuVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          hapticLight();
          setOpenMenu(null);
        }}
      >
        <View style={styles.menuModalRoot}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => {
              hapticLight();
              setOpenMenu(null);
            }}
          />
          <View style={[styles.menuSheet, darkMode && styles.menuSheetDark, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.menuGrabberWrap}>
              <View style={[styles.menuGrabber, darkMode && styles.menuGrabberDark]} />
            </View>
            <View style={styles.menuSheetTitleRow}>
              {openMenu === "tone" ? (
                <Graph2DIcon size={20} color={accentColor} opacity={darkMode ? 0.95 : 1} />
              ) : openMenu === "length" ? (
                <RulerIcon size={22} color={accentColor} opacity={darkMode ? 0.95 : 1} />
              ) : openMenu === "highlight" ? (
                <HighlighterIcon size={20} color={accentColor} opacity={darkMode ? 0.95 : 1} />
              ) : null}
              <Text style={[styles.menuSheetTitle, darkMode && styles.textDark]}>
                {openMenu === "tone"
                  ? "Tone / complexity"
                  : openMenu === "length"
                    ? "Length"
                    : openMenu === "highlight"
                      ? "Highlight key elements"
                      : ""}
              </Text>
            </View>
            {openMenu === "highlight" ? (
              <ScrollView
                style={styles.menuHighlightScroll}
                contentContainerStyle={styles.menuHighlightScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.switchRow, styles.menuHighlightSwitchRow]}>
                  <Text style={[styles.switchLabel, darkMode && styles.textDark]}>Highlight key elements</Text>
                  <Switch
                    value={highlightKeyElements}
                    onValueChange={(v) => {
                      hapticLight();
                      setHighlightKeyElements(v);
                    }}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View style={[styles.switchRow, !highlightKeyElements && styles.switchRowDisabled, styles.menuHighlightSwitchRow]}>
                  <Text style={[styles.switchLabel, darkMode && styles.textDark]}>Highlight key terms</Text>
                  <Switch
                    value={highlightKeyTerms}
                    onValueChange={(v) => {
                      hapticLight();
                      setHighlightKeyTerms(v);
                    }}
                    disabled={!highlightKeyElements}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View style={[styles.switchRow, !highlightKeyElements && styles.switchRowDisabled, styles.menuHighlightSwitchRow]}>
                  <Text style={[styles.switchLabel, darkMode && styles.textDark]}>Highlight definitions</Text>
                  <Switch
                    value={highlightDefinitions}
                    onValueChange={(v) => {
                      hapticLight();
                      setHighlightDefinitions(v);
                    }}
                    disabled={!highlightKeyElements}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View style={[styles.switchRow, !highlightKeyElements && styles.switchRowDisabled, styles.menuHighlightSwitchRow]}>
                  <Text style={[styles.switchLabel, darkMode && styles.textDark]}>Highlight important numbers/dates</Text>
                  <Switch
                    value={highlightNumbersDates}
                    onValueChange={(v) => {
                      hapticLight();
                      setHighlightNumbersDates(v);
                    }}
                    disabled={!highlightKeyElements}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
              </ScrollView>
            ) : (
              <View style={styles.menuOptions}>
                {openMenu === "tone"
                  ? TONE_CHOICES.map((opt) => (
                      <Pressable
                        key={opt.id}
                        style={({ pressed }) => [
                          styles.menuOption,
                          pressed && (darkMode ? styles.menuOptionPressedDark : styles.menuOptionPressed),
                        ]}
                        onPress={() => {
                          hapticSelect();
                          setTone(opt.id);
                          setOpenMenu(null);
                        }}
                      >
                        <View style={styles.menuOptionText}>
                          <Text style={[styles.menuOptionTitle, darkMode && styles.textDark]}>{opt.title}</Text>
                          <Text style={[styles.menuOptionSub, darkMode && styles.menuOptionSubDark]}>{opt.subtitle}</Text>
                        </View>
                        {tone === opt.id ? (
                          <Ionicons name="checkmark" size={22} color={accentColor} />
                        ) : (
                          <View style={styles.menuCheckPlaceholder} />
                        )}
                      </Pressable>
                    ))
                  : null}
                {openMenu === "length"
                  ? LENGTH_CHOICES.map((opt) => (
                      <Pressable
                        key={opt.id}
                        style={({ pressed }) => [
                          styles.menuOption,
                          pressed && (darkMode ? styles.menuOptionPressedDark : styles.menuOptionPressed),
                        ]}
                        onPress={() => {
                          hapticSelect();
                          setLength(opt.id);
                          setOpenMenu(null);
                        }}
                      >
                        <View style={styles.menuOptionText}>
                          <Text style={[styles.menuOptionTitle, darkMode && styles.textDark]}>{opt.title}</Text>
                          {opt.subtitle ? (
                            <Text style={[styles.menuOptionSub, darkMode && styles.menuOptionSubDark]}>{opt.subtitle}</Text>
                          ) : null}
                        </View>
                        {length === opt.id ? (
                          <Ionicons name="checkmark" size={22} color={accentColor} />
                        ) : (
                          <View style={styles.menuCheckPlaceholder} />
                        )}
                      </Pressable>
                    ))
                  : null}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingRow({ label, value, darkMode }: { label: string; value: string; darkMode: boolean }) {
  return (
    <View style={styles.optionRow}>
      <Text style={[styles.label, darkMode && styles.textDark]}>{label}</Text>
      <Text style={[styles.value, darkMode && styles.valueDark]} numberOfLines={1}>
        {value}
      </Text>
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
  },
  settingsCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  settingsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: lightColors.borderStrong,
    marginVertical: 14,
  },
  settingsSeparatorDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  settingInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  blockTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  blockTitleRowOnly: {
    marginBottom: 0,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: lightColors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: lightColors.chipBg,
    borderWidth: 1,
    borderColor: lightColors.border,
    gap: 8,
  },
  dropdownInline: {
    alignSelf: "center",
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: "flex-start",
  },
  dropdownDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: darkColors.border,
  },
  dropdownValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  dropdownValueInline: {
    flex: 0,
    fontSize: 14,
  },
  dropdownChevron: {
    opacity: 0.85,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  label: {
    color: lightColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  value: {
    flexShrink: 1,
    textAlign: "right",
    color: lightColors.textSecondary,
    fontSize: 14,
  },
  valueDark: {
    color: darkColors.textPrimary,
  },
  textDark: {
    color: darkColors.textPrimary,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 2,
  },
  switchRowDisabled: {
    opacity: 0.45,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: lightColors.textPrimary,
    paddingRight: 8,
  },
  menuModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  menuSheet: {
    backgroundColor: lightColors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: "72%",
  },
  menuSheetDark: {
    backgroundColor: "#2c2c2e",
  },
  menuGrabberWrap: {
    alignItems: "center",
    paddingBottom: 8,
  },
  menuGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  menuGrabberDark: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  menuSheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  menuSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: lightColors.textPrimary,
    textAlign: "center",
  },
  menuOptions: {
    gap: 0,
    paddingBottom: 8,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 12,
  },
  menuOptionPressed: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  menuOptionPressedDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  menuOptionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  menuOptionSub: {
    fontSize: 13,
    lineHeight: 18,
    color: lightColors.textMuted,
  },
  menuOptionSubDark: {
    color: darkColors.textSecondary,
  },
  menuCheckPlaceholder: {
    width: 22,
    height: 22,
  },
  menuHighlightScroll: {
    maxHeight: 420,
  },
  menuHighlightScrollContent: {
    paddingBottom: 8,
  },
  menuHighlightSwitchRow: {
    paddingVertical: 4,
  },
});
