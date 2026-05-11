import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { useAppSettings } from "../context/AppSettingsContext";
import { useExportPreferences } from "../context/ExportPreferencesContext";
import type { ProfileStackParamList } from "../navigation/types";
import { EXPORT_SCOPE_LABELS } from "../types/exportPreferences";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ExportSettings">;
type IonName = ComponentProps<typeof Ionicons>["name"];

const GREEN = "#4ade80";
const GREEN_BUBBLE = "rgba(34,197,94,0.12)";
const SWITCH_ON = "#2563eb";
const SECTION_LABEL_TO_CARD = 6;
const ROW_PAD_V = 18;
const ROW_PAD_H = 14;
const ICON_INNER = 18;
const BUBBLE_SIZE = 30;
const BUBBLE_RADIUS = BUBBLE_SIZE / 2;
const ROW_GAP = 12;
const DIVIDER_INSET = ROW_PAD_H + BUBBLE_SIZE + ROW_GAP;
const CHEVRON_SIZE = 15;

function SectionLabel({ children, darkMode }: { children: string; darkMode: boolean }) {
  return (
    <Text style={[styles.sectionLabel, !darkMode && styles.sectionLabelLight]} numberOfLines={1}>
      {children}
    </Text>
  );
}

function GreenIconBubble({ name }: { name: IonName }) {
  return (
    <View style={styles.iconBubble}>
      <Ionicons name={name} size={ICON_INNER} color={GREEN} />
    </View>
  );
}

export function ExportSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode } = useAppSettings();
  const {
    defaultFormat,
    includeQuotes,
    includeSummary,
    includePageNumbers,
    exportScope,
    notionConnected,
    autoExportAfterScan,
    setExportPreferences,
  } = useExportPreferences();

  const switchTrack = {
    false: darkMode ? "#3f3f3f" : "#d1d5db",
    true: SWITCH_ON,
  } as const;

  const chevronColor = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  const valueMuted = darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const subtitleMuted = darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

  const groupCard = [styles.groupCard, darkMode ? styles.groupCardDark : styles.groupCardLight];
  const divider = [styles.rowDivider, darkMode ? styles.rowDividerDark : styles.rowDividerLight];

  const noopFormat = () => {
    Alert.alert("Default format", "PDF is the default export format.");
  };
  const noopScope = () => {
    Alert.alert("Export scope", "All books are included in exports.");
  };
  const noopNotion = () => {
    Alert.alert("Notion", "Connect Notion in a future update.");
  };

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
          Export
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SettingsOptionHeroCard
          icon="cloud-upload-outline"
          title="Export"
          description="Choose format, content and where notes go."
          compactDescription
        />

        <View>
          <SectionLabel darkMode={darkMode}>Content</SectionLabel>
          <View style={[...groupCard, { marginTop: SECTION_LABEL_TO_CARD }]}>
            <TouchableOpacity style={styles.row} onPress={noopFormat} activeOpacity={0.82}>
              <GreenIconBubble name="document-outline" />
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Default format</Text>
              <View style={styles.rowTrail}>
                <Text style={[styles.rowValue, { color: valueMuted }]} numberOfLines={1}>
                  {defaultFormat.toUpperCase()}
                </Text>
                <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={chevronColor} />
              </View>
            </TouchableOpacity>
            <View style={[...divider, { marginLeft: DIVIDER_INSET }]} />
            <View style={styles.row}>
              <GreenIconBubble name="chatbubble-outline" />
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Include quotes</Text>
              <Switch
                value={includeQuotes}
                onValueChange={(v) => setExportPreferences({ includeQuotes: v })}
                trackColor={switchTrack}
                thumbColor="#ffffff"
                ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
              />
            </View>
            <View style={[...divider, { marginLeft: DIVIDER_INSET }]} />
            <View style={styles.row}>
              <GreenIconBubble name="document-text-outline" />
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Include summary</Text>
              <Switch
                value={includeSummary}
                onValueChange={(v) => setExportPreferences({ includeSummary: v })}
                trackColor={switchTrack}
                thumbColor="#ffffff"
                ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
              />
            </View>
            <View style={[...divider, { marginLeft: DIVIDER_INSET }]} />
            <View style={styles.row}>
              <GreenIconBubble name="keypad-outline" />
              <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Include page numbers</Text>
              <Switch
                value={includePageNumbers}
                onValueChange={(v) => setExportPreferences({ includePageNumbers: v })}
                trackColor={switchTrack}
                thumbColor="#ffffff"
                ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
              />
            </View>
          </View>
        </View>

        <View>
          <SectionLabel darkMode={darkMode}>Destination</SectionLabel>
          <View style={[...groupCard, { marginTop: SECTION_LABEL_TO_CARD }]}>
            <TouchableOpacity style={styles.rowMultiline} onPress={noopScope} activeOpacity={0.82}>
              <GreenIconBubble name="funnel-outline" />
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Export scope</Text>
                <Text style={[styles.rowSubtitle, { color: subtitleMuted }]} numberOfLines={1}>
                  {EXPORT_SCOPE_LABELS[exportScope]}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={chevronColor} />
            </TouchableOpacity>
            <View style={[...divider, { marginLeft: DIVIDER_INSET }]} />
            <TouchableOpacity style={styles.rowMultiline} onPress={noopNotion} activeOpacity={0.82}>
              <GreenIconBubble name="open-outline" />
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Notion</Text>
                <Text
                  style={[
                    styles.rowSubtitle,
                    { color: notionConnected ? GREEN : "#f87171" },
                  ]}
                  numberOfLines={1}
                >
                  {notionConnected ? "Connected" : "Not connected"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={chevronColor} />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <SectionLabel darkMode={darkMode}>Automation</SectionLabel>
          <View style={[...groupCard, { marginTop: SECTION_LABEL_TO_CARD }]}>
            <View style={styles.rowMultiline}>
              <GreenIconBubble name="flash-outline" />
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowLabel, darkMode && styles.rowLabelDark]}>Auto-export after scan</Text>
                <Text style={[styles.rowSubtitle, { color: subtitleMuted }]} numberOfLines={2}>
                  Exports automatically when scan completes
                </Text>
              </View>
              <Switch
                value={autoExportAfterScan}
                onValueChange={(v) => setExportPreferences({ autoExportAfterScan: v })}
                trackColor={switchTrack}
                thumbColor="#ffffff"
                ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
              />
            </View>
          </View>
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
    paddingBottom: 40,
    gap: 20,
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
  iconBubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_RADIUS,
    backgroundColor: GREEN_BUBBLE,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: ROW_PAD_V,
    paddingHorizontal: ROW_PAD_H,
    gap: ROW_GAP,
  },
  rowMultiline: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: ROW_PAD_V,
    paddingHorizontal: ROW_PAD_H,
    gap: ROW_GAP,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  rowLabelDark: {
    color: "#ffffff",
  },
  rowSubtitle: {
    fontSize: 11,
    fontWeight: "400",
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  rowTrail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
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
});
