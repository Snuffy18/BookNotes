import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const BG = "#111";

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
};

export function ChapterMapEmptyState({ onScanPress, disabled, bottomInset }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ghostSection}>
          <Text style={styles.ghostLabel}>Chapters</Text>
          {GHOST_TITLE_WIDTHS.map((titleWidth, index) => (
            <View
              key={titleWidth}
              style={[
                styles.ghostRow,
                index > 0 && styles.ghostRowDivider,
                { opacity: GHOST_ROW_OPACITIES[index] },
              ]}
            >
              <View style={[styles.ghostTitleBar, { width: titleWidth }]} />
              <View style={styles.ghostPageBar} />
            </View>
          ))}
        </View>

        <View style={styles.howDivider}>
          <View style={styles.howDividerLine} />
          <Text style={styles.howDividerLabel}>How it works</Text>
          <View style={styles.howDividerLine} />
        </View>

        <View style={styles.stepsCard}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={[styles.stepRow, index > 0 && styles.stepRowDivider]}>
              <View style={[styles.stepIconWrap, { backgroundColor: step.iconBg }]}>
                <Ionicons name={step.icon} size={17} color={step.iconColor} />
              </View>
              <View style={styles.stepTextCol}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 12) }]} pointerEvents="box-none">
        <LinearGradient
          colors={["transparent", BG]}
          locations={[0, 0.65]}
          style={styles.bottomBarGradient}
          pointerEvents="none"
        />
        <Pressable
          onPress={onScanPress}
          disabled={disabled}
          style={({ pressed }) => [
            styles.scanButton,
            disabled && styles.scanButtonDisabled,
            pressed && !disabled && styles.scanButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan contents page"
        >
          <Ionicons name="camera" size={18} color="#111111" />
          <Text style={styles.scanButtonText}>Scan contents page</Text>
        </Pressable>
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
    paddingHorizontal: 20,
  },
  bottomBarGradient: {
    ...StyleSheet.absoluteFill,
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
});
