import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  Alert,
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
import { useAppSettings } from "../context/AppSettingsContext";
import { useStudyPreferences } from "../context/StudyPreferencesContext";
import type { ProfileStackParamList } from "../navigation/types";
import { formatHighlightDropdown, labelLength, labelTone } from "../study/studyPreferenceLabels";
import { DEFAULT_STUDY_PREFERENCES, type StudyLength, type StudyTone } from "../types/studyPreferences";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "StudyPreferences">;

type Choice<T extends string> = { id: T; title: string; subtitle: string };

const BLUE = "#60a5fa";
const SECTION_LABEL_TO_CARD = 6;
const ROW_ICON_GAP = 12;
const ROW_ICON_W = 18;
const DIVIDER_INSET = 14 + ROW_ICON_W + ROW_ICON_GAP;

const TONE_CHOICES: Choice<StudyTone>[] = [
  { id: "simple", title: "Simple", subtitle: "Like explaining to a beginner" },
  { id: "academic", title: "Academic", subtitle: "Formal" },
  { id: "exam", title: "Exam-ready", subtitle: "Focused, structured" },
];

const LENGTH_CHOICES: Choice<StudyLength>[] = [
  { id: "short", title: "Short", subtitle: "3–5 bullets" },
  {
    id: "medium",
    title: "Medium",
    subtitle: "Balanced depth — clear notes without extra padding",
  },
  {
    id: "detailed",
    title: "Detailed",
    subtitle: "Richer notes — more coverage when the page supports it",
  },
];

function SectionLabel({ darkMode }: { darkMode: boolean }) {
  return (
    <Text style={[styles.sectionLabel, !darkMode && styles.sectionLabelLight]}>
      Preferences
    </Text>
  );
}

export function StudyPreferencesScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode } = useAppSettings();
  const insets = useSafeAreaInsets();
  const {
    tone,
    length,
    highlightKeyElements,
    highlightKeyTerms,
    highlightDefinitions,
    highlightNumbersDates,
    setStudyPreferences,
    replaceStudyPreferences,
  } = useStudyPreferences();

  const [openMenu, setOpenMenu] = useState<"tone" | "length" | "highlight" | null>(null);

  const highlightDropdownLabel = formatHighlightDropdown({
    highlightKeyElements,
    highlightKeyTerms,
    highlightDefinitions,
    highlightNumbersDates,
  });

  const switchTrack = { false: darkMode ? "#3f3f3f" : "#d1d5db", true: "#34c759" } as const;

  const menuVisible = openMenu !== null;

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const hapticSelect = () => {
    Haptics.selectionAsync().catch(() => {});
  };

  const groupCard = [styles.groupCard, darkMode ? styles.groupCardDark : styles.groupCardLight];
  const divider = [styles.rowDivider, darkMode ? styles.rowDividerDark : styles.rowDividerLight];
  const chevronMuted = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

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
            color={darkMode ? "#ffffff" : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, darkMode && styles.topBarTitleDark]} numberOfLines={1}>
          Study preferences
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, darkMode && styles.heroCardDark]}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="school" size={22} color={BLUE} />
          </View>
          <Text style={[styles.heroTitle, darkMode && styles.heroTitleDark]}>Study preferences</Text>
          <Text
            style={[styles.heroDescription, darkMode && styles.heroDescriptionDark]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Adjust tone, length and language to match how you study.
          </Text>
        </View>

        <View>
          <SectionLabel darkMode={darkMode} />
          <View style={[...groupCard, { marginTop: SECTION_LABEL_TO_CARD }]}>
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => {
                hapticLight();
                setOpenMenu("tone");
              }}
              activeOpacity={0.82}
            >
              <View style={styles.rowIconSlot}>
                <Graph2DIcon size={ROW_ICON_W} color={BLUE} opacity={1} />
              </View>
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Tone / complexity</Text>
              <View style={styles.dropdownTrail}>
                <Text style={[styles.dropdownValue, darkMode && styles.dropdownValueDark]} numberOfLines={1}>
                  {labelTone(tone)}
                </Text>
                <Ionicons name="chevron-down" size={15} color={chevronMuted} />
              </View>
            </TouchableOpacity>
            <View style={[...divider, { marginLeft: DIVIDER_INSET }]} />
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => {
                hapticLight();
                setOpenMenu("length");
              }}
              activeOpacity={0.82}
            >
              <View style={styles.rowIconSlot}>
                <RulerIcon size={ROW_ICON_W} color={BLUE} opacity={1} />
              </View>
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Length</Text>
              <View style={styles.dropdownTrail}>
                <Text style={[styles.dropdownValue, darkMode && styles.dropdownValueDark]} numberOfLines={1}>
                  {labelLength(length)}
                </Text>
                <Ionicons name="chevron-down" size={15} color={chevronMuted} />
              </View>
            </TouchableOpacity>
            <View style={[...divider, { marginLeft: DIVIDER_INSET }]} />
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => {
                hapticLight();
                setOpenMenu("highlight");
              }}
              activeOpacity={0.82}
            >
              <View style={styles.rowIconSlot}>
                <HighlighterIcon size={ROW_ICON_W} color={BLUE} opacity={1} />
              </View>
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Key elements</Text>
              <View style={styles.dropdownTrail}>
                <Text style={[styles.dropdownValue, darkMode && styles.dropdownValueDark]} numberOfLines={1}>
                  {highlightDropdownLabel}
                </Text>
                <Ionicons name="chevron-down" size={15} color={chevronMuted} />
              </View>
            </TouchableOpacity>
            <View style={[...divider, { marginLeft: DIVIDER_INSET }]} />
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => {
                hapticLight();
                navigation.navigate("OutputLanguage");
              }}
              activeOpacity={0.82}
            >
              <View style={styles.rowIconSlot}>
                <Ionicons name="globe-outline" size={ROW_ICON_W} color={BLUE} />
              </View>
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Output language</Text>
              <View style={styles.langTrail}>
                <Text style={[styles.langValueMuted, darkMode && styles.langValueMutedDark]} numberOfLines={1}>
                  English
                </Text>
                <Ionicons name="chevron-forward" size={15} color={chevronMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => {
            hapticLight();
            Alert.alert(
              "Restore to defaults?",
              "Tone, length, and highlight options will be reset to their original values.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Restore",
                  style: "destructive",
                  onPress: () => {
                    hapticSelect();
                    replaceStudyPreferences({ ...DEFAULT_STUDY_PREFERENCES });
                  },
                },
              ]
            );
          }}
          activeOpacity={0.75}
        >
          <Text style={styles.resetLabel}>Restore to defaults</Text>
        </TouchableOpacity>
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
                <Graph2DIcon size={20} color={BLUE} opacity={1} />
              ) : openMenu === "length" ? (
                <RulerIcon size={20} color={BLUE} opacity={1} />
              ) : openMenu === "highlight" ? (
                <HighlighterIcon size={20} color={BLUE} opacity={1} />
              ) : null}
              <Text style={[styles.menuSheetTitle, darkMode && styles.menuSheetTitleDark]}>
                {openMenu === "tone"
                  ? "Tone / complexity"
                  : openMenu === "length"
                    ? "Length"
                    : openMenu === "highlight"
                      ? "Key elements"
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
                  <Text style={[styles.switchLabel, darkMode && styles.switchLabelDark]}>Highlight key elements</Text>
                  <Switch
                    value={highlightKeyElements}
                    onValueChange={(v) => {
                      hapticLight();
                      setStudyPreferences({ highlightKeyElements: v });
                    }}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View style={[styles.switchRow, !highlightKeyElements && styles.switchRowDisabled, styles.menuHighlightSwitchRow]}>
                  <Text style={[styles.switchLabel, darkMode && styles.switchLabelDark]}>Highlight key terms</Text>
                  <Switch
                    value={highlightKeyTerms}
                    onValueChange={(v) => {
                      hapticLight();
                      setStudyPreferences({ highlightKeyTerms: v });
                    }}
                    disabled={!highlightKeyElements}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View style={[styles.switchRow, !highlightKeyElements && styles.switchRowDisabled, styles.menuHighlightSwitchRow]}>
                  <Text style={[styles.switchLabel, darkMode && styles.switchLabelDark]}>Highlight definitions</Text>
                  <Switch
                    value={highlightDefinitions}
                    onValueChange={(v) => {
                      hapticLight();
                      setStudyPreferences({ highlightDefinitions: v });
                    }}
                    disabled={!highlightKeyElements}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View style={[styles.switchRow, !highlightKeyElements && styles.switchRowDisabled, styles.menuHighlightSwitchRow]}>
                  <Text style={[styles.switchLabel, darkMode && styles.switchLabelDark]}>Highlight important numbers/dates</Text>
                  <Switch
                    value={highlightNumbersDates}
                    onValueChange={(v) => {
                      hapticLight();
                      setStudyPreferences({ highlightNumbersDates: v });
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
                          setStudyPreferences({ tone: opt.id });
                          setOpenMenu(null);
                        }}
                      >
                        <View style={styles.menuOptionText}>
                          <Text style={[styles.menuOptionTitle, darkMode && styles.menuOptionTitleDark]}>{opt.title}</Text>
                          <Text style={[styles.menuOptionSub, darkMode && styles.menuOptionSubDark]}>{opt.subtitle}</Text>
                        </View>
                        {tone === opt.id ? (
                          <Ionicons name="checkmark" size={22} color={BLUE} />
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
                          setStudyPreferences({ length: opt.id });
                          setOpenMenu(null);
                        }}
                      >
                        <View style={styles.menuOptionText}>
                          <Text style={[styles.menuOptionTitle, darkMode && styles.menuOptionTitleDark]}>{opt.title}</Text>
                          {opt.subtitle ? (
                            <Text style={[styles.menuOptionSub, darkMode && styles.menuOptionSubDark]}>{opt.subtitle}</Text>
                          ) : null}
                        </View>
                        {length === opt.id ? (
                          <Ionicons name="checkmark" size={22} color={BLUE} />
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
    fontSize: 14,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  topBarTitleDark: {
    color: "#ffffff",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroCard: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.035)",
  },
  heroCardDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: "600",
    color: lightColors.textPrimary,
    textAlign: "center",
  },
  heroTitleDark: {
    color: "#ffffff",
  },
  heroDescription: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(0,0,0,0.4)",
    textAlign: "center",
    alignSelf: "stretch",
  },
  heroDescriptionDark: {
    color: "rgba(255,255,255,0.4)",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "rgba(255,255,255,0.3)",
    paddingLeft: 4,
  },
  sectionLabelLight: {
    color: "rgba(0,0,0,0.3)",
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  groupCardDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  groupCardLight: {
    backgroundColor: "rgba(0,0,0,0.035)",
    borderColor: "rgba(0,0,0,0.08)",
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 14,
    gap: ROW_ICON_GAP,
  },
  rowIconSlot: {
    width: ROW_ICON_W,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  rowLabelDark: {
    color: "#ffffff",
  },
  dropdownTrail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    maxWidth: "42%",
  },
  dropdownValue: {
    fontSize: 15,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  dropdownValueDark: {
    color: "#ffffff",
  },
  langTrail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    maxWidth: "42%",
  },
  langValueMuted: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(0,0,0,0.4)",
  },
  langValueMutedDark: {
    color: "rgba(255,255,255,0.4)",
  },
  rowDivider: {
    height: 0.5,
  },
  rowDividerDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rowDividerLight: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  resetButton: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resetLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#f87171",
    textAlign: "center",
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
  switchLabelDark: {
    color: darkColors.textPrimary,
  },
  settingsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: lightColors.borderStrong,
    marginVertical: 14,
  },
  settingsSeparatorDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
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
  menuSheetTitleDark: {
    color: darkColors.textPrimary,
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
  menuOptionTitleDark: {
    color: darkColors.textPrimary,
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
