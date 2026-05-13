import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Graph2DIcon } from "./Graph2DIcon";
import { HighlighterIcon } from "./HighlighterIcon";
import { RulerIcon } from "./RulerIcon";
import { formatHighlightDropdown, labelLength, labelTone } from "../study/studyPreferenceLabels";
import { darkColors, lightColors } from "../theme/colors";
import {
  DEFAULT_STUDY_PREFERENCES,
  type StudyLength,
  type StudyPreferencesSnapshot,
  type StudyTone,
} from "../types/studyPreferences";

type Choice<T extends string> = { id: T; title: string; subtitle: string };

const BLUE = "#60a5fa";
const ROW_ICON_W = 18;
const ROW_ICON_GAP = 12;
const DIVIDER_INSET = 14 + ROW_ICON_W + ROW_ICON_GAP;
const SHEET_ANIM_MS = 280;
const BACKDROP_FADE_MS = 260;
const SHEET_EASE = Easing.out(Easing.cubic);

const TONE_CHOICES: Choice<StudyTone>[] = [
  { id: "simple", title: "Simple", subtitle: "Like explaining to a beginner" },
  { id: "academic", title: "Academic", subtitle: "Formal" },
  { id: "exam", title: "Exam-ready", subtitle: "Focused, structured" },
];

const LENGTH_CHOICES: Choice<StudyLength>[] = [
  { id: "short", title: "Short", subtitle: "3–5 bullets" },
  { id: "medium", title: "Medium", subtitle: "Balanced depth" },
  { id: "detailed", title: "Detailed", subtitle: "Richer notes when the page supports it" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  initialPrefs: StudyPreferencesSnapshot;
  darkMode: boolean;
  onContinueToExtract: (prefs: StudyPreferencesSnapshot) => void;
};

export function ReportStudySettingsModal({
  visible,
  onClose,
  initialPrefs,
  darkMode,
  onContinueToExtract,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [draft, setDraft] = useState<StudyPreferencesSnapshot>(initialPrefs);
  const [openMenu, setOpenMenu] = useState<"tone" | "length" | "highlight" | null>(null);
  const [sheetMounted, setSheetMounted] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(winH)).current;

  useEffect(() => {
    if (visible) {
      setSheetMounted(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(winH);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: BACKDROP_FADE_MS,
          easing: SHEET_EASE,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: SHEET_ANIM_MS,
          easing: SHEET_EASE,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!sheetMounted) return;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: BACKDROP_FADE_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: winH,
        duration: SHEET_ANIM_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setSheetMounted(false);
    });
  }, [visible, sheetMounted, backdropOpacity, sheetTranslateY, winH]);

  useEffect(() => {
    if (visible) {
      setDraft(initialPrefs);
      setOpenMenu(null);
    }
  }, [visible, initialPrefs]);

  const highlightDropdownLabel = formatHighlightDropdown({
    highlightKeyElements: draft.highlightKeyElements,
    highlightKeyTerms: draft.highlightKeyTerms,
    highlightDefinitions: draft.highlightDefinitions,
    highlightNumbersDates: draft.highlightNumbersDates,
  });

  const switchTrack = { false: darkMode ? "#3f3f3f" : "#d1d5db", true: "#34c759" } as const;
  const menuVisible = openMenu !== null;
  const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  const hapticSelect = () => Haptics.selectionAsync().catch(() => {});

  const groupCard = [styles.groupCard, darkMode ? styles.groupCardDark : styles.groupCardLight];
  const divider = [styles.rowDivider, darkMode ? styles.rowDividerDark : styles.rowDividerLight];
  const chevronMuted = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const setPartial = (partial: Partial<StudyPreferencesSnapshot>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  return (
    <Modal visible={sheetMounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss study settings" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            darkMode && styles.sheetDark,
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, darkMode && styles.sheetTitleDark]}>Study settings</Text>
            <Text style={[styles.sheetSubtitle, darkMode && styles.sheetSubtitleDark]}>
              Next, choose what to extract. Notes will be regenerated with these preferences.
            </Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[...groupCard]}>
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
                    {labelTone(draft.tone)}
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
                    {labelLength(draft.length)}
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
            </View>

            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => {
                hapticLight();
                setDraft({ ...DEFAULT_STUDY_PREFERENCES });
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.resetLabel, darkMode && styles.resetLabelDark]}>Restore defaults</Text>
            </TouchableOpacity>
          </ScrollView>

          <View
            style={[
              styles.footerRow,
              darkMode ? styles.footerRowBorderDark : styles.footerRowBorderLight,
            ]}
          >
            <TouchableOpacity style={styles.cancelFooterBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={[styles.cancelFooterText, darkMode && styles.cancelFooterTextDark]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryFooterBtn}
              onPress={() => {
                hapticSelect();
                onContinueToExtract(draft);
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryFooterText}>Choose what to extract</Text>
              <Ionicons name="arrow-forward" size={18} color="#111" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

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
          <View
            style={[
              styles.menuSheet,
              darkMode && styles.menuSheetDark,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
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
                    value={draft.highlightKeyElements}
                    onValueChange={(v) => {
                      hapticLight();
                      setPartial({ highlightKeyElements: v });
                    }}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View
                  style={[
                    styles.switchRow,
                    !draft.highlightKeyElements && styles.switchRowDisabled,
                    styles.menuHighlightSwitchRow,
                  ]}
                >
                  <Text style={[styles.switchLabel, darkMode && styles.switchLabelDark]}>Highlight key terms</Text>
                  <Switch
                    value={draft.highlightKeyTerms}
                    onValueChange={(v) => {
                      hapticLight();
                      setPartial({ highlightKeyTerms: v });
                    }}
                    disabled={!draft.highlightKeyElements}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View
                  style={[
                    styles.switchRow,
                    !draft.highlightKeyElements && styles.switchRowDisabled,
                    styles.menuHighlightSwitchRow,
                  ]}
                >
                  <Text style={[styles.switchLabel, darkMode && styles.switchLabelDark]}>Highlight definitions</Text>
                  <Switch
                    value={draft.highlightDefinitions}
                    onValueChange={(v) => {
                      hapticLight();
                      setPartial({ highlightDefinitions: v });
                    }}
                    disabled={!draft.highlightKeyElements}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                    ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
                  />
                </View>
                <View style={[styles.settingsSeparator, darkMode && styles.settingsSeparatorDark]} />
                <View
                  style={[
                    styles.switchRow,
                    !draft.highlightKeyElements && styles.switchRowDisabled,
                    styles.menuHighlightSwitchRow,
                  ]}
                >
                  <Text style={[styles.switchLabel, darkMode && styles.switchLabelDark]}>
                    Highlight important numbers/dates
                  </Text>
                  <Switch
                    value={draft.highlightNumbersDates}
                    onValueChange={(v) => {
                      hapticLight();
                      setPartial({ highlightNumbersDates: v });
                    }}
                    disabled={!draft.highlightKeyElements}
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
                          setPartial({ tone: opt.id });
                          setOpenMenu(null);
                        }}
                      >
                        <View style={styles.menuOptionText}>
                          <Text style={[styles.menuOptionTitle, darkMode && styles.menuOptionTitleDark]}>{opt.title}</Text>
                          <Text style={[styles.menuOptionSub, darkMode && styles.menuOptionSubDark]}>{opt.subtitle}</Text>
                        </View>
                        {draft.tone === opt.id ? (
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
                          setPartial({ length: opt.id });
                          setOpenMenu(null);
                        }}
                      >
                        <View style={styles.menuOptionText}>
                          <Text style={[styles.menuOptionTitle, darkMode && styles.menuOptionTitleDark]}>{opt.title}</Text>
                          {opt.subtitle ? (
                            <Text style={[styles.menuOptionSub, darkMode && styles.menuOptionSubDark]}>{opt.subtitle}</Text>
                          ) : null}
                        </View>
                        {draft.length === opt.id ? (
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: lightColors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "88%",
    paddingTop: 12,
  },
  sheetDark: {
    backgroundColor: darkColors.background,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 6,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  sheetTitleDark: {
    color: "#ffffff",
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(0,0,0,0.55)",
  },
  sheetSubtitleDark: {
    color: "rgba(255,255,255,0.45)",
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
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
    paddingVertical: 16,
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
    maxWidth: "42%",
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: lightColors.textSecondary,
  },
  dropdownValueDark: {
    color: "rgba(255,255,255,0.75)",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  rowDividerDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rowDividerLight: {
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  resetBtn: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  resetLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: lightColors.textMuted,
  },
  resetLabelDark: {
    color: "rgba(255,255,255,0.4)",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRowBorderLight: {
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  footerRowBorderDark: {
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  cancelFooterBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cancelFooterText: {
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textMuted,
  },
  cancelFooterTextDark: {
    color: "rgba(255,255,255,0.5)",
  },
  primaryFooterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fbbf24",
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryFooterText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111111",
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
    paddingTop: 8,
    maxHeight: "72%",
  },
  menuSheetDark: {
    backgroundColor: "#1c1c1c",
  },
  menuGrabberWrap: {
    alignItems: "center",
    paddingVertical: 6,
  },
  menuGrabber: {
    width: 40,
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
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  menuSheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  menuSheetTitleDark: {
    color: "#ffffff",
  },
  menuOptions: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuOptionPressed: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  menuOptionPressedDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  menuOptionText: {
    flex: 1,
    gap: 2,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  menuOptionTitleDark: {
    color: "#ffffff",
  },
  menuOptionSub: {
    fontSize: 13,
    color: lightColors.textMuted,
  },
  menuOptionSubDark: {
    color: "rgba(255,255,255,0.45)",
  },
  menuCheckPlaceholder: {
    width: 22,
    height: 22,
  },
  menuHighlightScroll: {
    maxHeight: 320,
  },
  menuHighlightScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  menuHighlightSwitchRow: {
    paddingVertical: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchRowDisabled: {
    opacity: 0.45,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  switchLabelDark: {
    color: "#ffffff",
  },
  settingsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginVertical: 4,
  },
  settingsSeparatorDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
