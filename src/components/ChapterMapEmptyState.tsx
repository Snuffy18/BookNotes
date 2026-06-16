import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const BG = "#111";
const BG_LIGHT = "#ffffff";
const BOTTOM_FADE_DARK: readonly [string, string] = ["transparent", BG];
const BOTTOM_FADE_LIGHT: readonly [string, string] = ["rgba(255,255,255,0)", BG_LIGHT];

const GHOST_TITLE_WIDTHS = ["58%", "42%", "66%", "38%"] as const;
const GHOST_ROW_OPACITIES = [0.5, 0.35, 0.22, 0.12] as const;

const STEPS = [
  {
    icon: "camera-outline" as const,
    iconColor: "#60a5fa",
    iconBg: "rgba(96,165,250,0.1)",
    title: "Scan your contents page",
    description: "Open to the table of contents and take a photo — any book layout works.",
  },
  {
    icon: "sparkles-outline" as const,
    iconColor: "#a855f7",
    iconBg: "rgba(168,85,247,0.1)",
    title: "AI maps each chapter",
    description: "Chapter names and page numbers are extracted and saved automatically.",
  },
  {
    icon: "checkmark" as const,
    iconColor: "#4ade80",
    iconBg: "rgba(74,222,128,0.08)",
    title: "Notes become chapter-aware",
    description: "Every future scan is tagged to the right chapter — no extra work needed.",
  },
] as const;

type Props = {
  onScanPress: () => void;
  disabled?: boolean;
  bottomInset: number;
  darkMode?: boolean;
};

export function ChapterMapEmptyState({ onScanPress, disabled, bottomInset, darkMode = true }: Props) {
  return (
    <View style={[styles.root, !darkMode && styles.rootLight]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ghostSection}>
          <Text style={[styles.ghostLabel, !darkMode && styles.ghostLabelLight]}>Chapters</Text>
          {GHOST_TITLE_WIDTHS.map((titleWidth, index) => (
            <View
              key={titleWidth}
              style={[
                styles.ghostRow,
                index > 0 && styles.ghostRowDivider,
                index > 0 && !darkMode && styles.ghostRowDividerLight,
                { opacity: GHOST_ROW_OPACITIES[index] },
              ]}
            >
              <View style={[styles.ghostTitleBar, !darkMode && styles.ghostTitleBarLight, { width: titleWidth }]} />
              <View style={[styles.ghostPageBar, !darkMode && styles.ghostPageBarLight]} />
            </View>
          ))}
        </View>

        <View style={styles.howDivider}>
          <View style={[styles.howDividerLine, !darkMode && styles.howDividerLineLight]} />
          <Text style={[styles.howDividerLabel, !darkMode && styles.howDividerLabelLight]}>How it works</Text>
          <View style={[styles.howDividerLine, !darkMode && styles.howDividerLineLight]} />
        </View>

        <View style={[styles.stepsCard, !darkMode && styles.stepsCardLight]}>
          {STEPS.map((step, index) => (
            <View
              key={step.title}
              style={[styles.stepRow, index > 0 && styles.stepRowDivider, index > 0 && !darkMode && styles.stepRowDividerLight]}
            >
              <View style={[styles.stepIconWrap, { backgroundColor: step.iconBg }]}>
                <Ionicons name={step.icon} size={17} color={step.iconColor} />
              </View>
              <View style={styles.stepTextCol}>
                <Text style={[styles.stepTitle, !darkMode && styles.stepTitleLight]}>{step.title}</Text>
                <Text style={[styles.stepDescription, !darkMode && styles.stepDescriptionLight]}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 12) }]} pointerEvents="box-none">
        <LinearGradient
          colors={darkMode ? BOTTOM_FADE_DARK : BOTTOM_FADE_LIGHT}
          locations={[0, 0.65]}
          style={styles.bottomBarGradient}
          pointerEvents="none"
        />
        <View style={styles.bottomBarContent}>
          <Pressable
            onPress={onScanPress}
            disabled={disabled}
            style={({ pressed }) => [
              styles.scanButton,
              !darkMode && styles.scanButtonLight,
              disabled && styles.scanButtonDisabled,
              pressed && !disabled && styles.scanButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Scan contents page"
          >
            <Ionicons name="camera" size={18} color={darkMode ? "#111111" : "#ffffff"} />
            <Text style={[styles.scanButtonText, !darkMode && styles.scanButtonTextLight]}>Scan contents page</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  ghostSection: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  ghostLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.2)",
    marginBottom: 8,
  },
  ghostRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 12,
  },
  ghostRowDivider: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  ghostTitleBar: {
    height: 9,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    flexShrink: 1,
  },
  ghostPageBar: {
    width: 28,
    height: 9,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexShrink: 0,
  },
  howDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  howDividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  howDividerLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.25)",
  },
  stepsCard: {
    marginTop: 12,
    marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    overflow: "hidden",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  stepRowDivider: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepTextCol: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#ffffff",
  },
  stepDescription: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 16.5,
    color: "rgba(255,255,255,0.4)",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
  },
  bottomBarGradient: {
    ...StyleSheet.absoluteFill,
  },
  bottomBarContent: {
    paddingHorizontal: 20,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  scanButtonPressed: {
    opacity: 0.92,
  },
  scanButtonDisabled: {
    opacity: 0.45,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  rootLight: {
    backgroundColor: BG_LIGHT,
  },
  ghostLabelLight: {
    color: "rgba(15,23,42,0.3)",
  },
  ghostRowDividerLight: {
    borderTopColor: "rgba(15,23,42,0.06)",
  },
  ghostTitleBarLight: {
    backgroundColor: "rgba(15,23,42,0.18)",
  },
  ghostPageBarLight: {
    backgroundColor: "rgba(15,23,42,0.1)",
  },
  howDividerLineLight: {
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  howDividerLabelLight: {
    color: "rgba(15,23,42,0.4)",
  },
  stepsCardLight: {
    backgroundColor: "rgba(15,23,42,0.03)",
    borderColor: "rgba(15,23,42,0.08)",
  },
  stepRowDividerLight: {
    borderTopColor: "rgba(15,23,42,0.07)",
  },
  stepTitleLight: {
    color: "#0f172a",
  },
  stepDescriptionLight: {
    color: "rgba(15,23,42,0.5)",
  },
  scanButtonLight: {
    backgroundColor: "#111111",
  },
  scanButtonTextLight: {
    color: "#ffffff",
  },
});
