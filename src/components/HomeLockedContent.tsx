import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const GHOST_BAR_WIDTHS = ["60%", "90%", "75%", "40%"] as const;
const LOCKED_BG = "#111";

type Props = {
  onAddBook: () => void;
};

export function HomeLockedContent({ onAddBook }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.nudgeCard}>
        <View style={styles.nudgeIconWrap}>
          <Ionicons name="book-outline" size={18} color="#fbbf24" />
        </View>
        <View style={styles.nudgeTextCol}>
          <Text style={styles.nudgeTitle}>Add a book to get started</Text>
          <Text style={styles.nudgeSubtitle}>
            Scanning, chapter maps and reports unlock once you add your first book.
          </Text>
          <Pressable
            onPress={onAddBook}
            style={({ pressed }) => [styles.nudgeButton, pressed && styles.nudgeButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add a book"
          >
            <Ionicons name="add" size={13} color="#111111" />
            <Text style={styles.nudgeButtonText}>Add a book</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.disabledCameraBlock} pointerEvents="none">
        <View style={styles.disabledCameraButton}>
          <Ionicons name="camera-outline" size={20} color="rgba(255,255,255,0.25)" />
          <Text style={styles.disabledCameraLabel}>Open camera</Text>
        </View>
        <Text style={styles.disabledCameraHint}>Add a book first to enable scanning</Text>
      </View>

      <View style={styles.chapterLockCard}>
        <View style={styles.chapterLockIconWrap}>
          <Ionicons name="book-outline" size={16} color="rgba(255,255,255,0.25)" />
        </View>
        <View style={styles.chapterLockTextCol}>
          <Text style={styles.chapterLockTitle}>Chapter-aware reports</Text>
          <Text style={styles.chapterLockSubtitle}>Unlocks after adding a book</Text>
        </View>
        <Ionicons name="lock-closed-outline" size={12} color="rgba(255,255,255,0.25)" />
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.recentSectionLabel}>Recent scans</Text>
        <View style={styles.recentGhostRow}>
          {[0, 1, 2].map((cardIndex) => (
            <View key={cardIndex} style={styles.recentGhostCard}>
              {GHOST_BAR_WIDTHS.map((width, barIndex) => (
                <View
                  key={`${cardIndex}-${barIndex}`}
                  style={[styles.recentGhostBar, { width: width as `${number}%` }]}
                />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.lockedWidgetRow}>
          <LockedWidgetPlaceholder />
          <LockedWidgetPlaceholder />
        </View>

        <Text style={styles.lockedFooterHint}>Add a book to unlock all features</Text>
      </View>
    </View>
  );
}

function LockedWidgetPlaceholder() {
  return (
    <View style={styles.lockedWidgetCard}>
      <View style={styles.lockedWidgetGhostNumber} />
      <View style={styles.lockedWidgetGhostLabel} />
      <Ionicons
        name="lock-closed-outline"
        size={12}
        color="rgba(255,255,255,0.12)"
        style={styles.lockedWidgetLockIcon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
    width: "100%",
  },
  nudgeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
  },
  nudgeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(251,191,36,0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  nudgeTextCol: {
    flex: 1,
    minWidth: 0,
  },
  nudgeTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#ffffff",
  },
  nudgeSubtitle: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15.95,
    color: "rgba(255,255,255,0.4)",
  },
  nudgeButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  nudgeButtonPressed: {
    opacity: 0.9,
  },
  nudgeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111111",
  },
  disabledCameraBlock: {
    gap: 8,
  },
  disabledCameraButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  disabledCameraLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.25)",
  },
  disabledCameraHint: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
  },
  chapterLockCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    opacity: 0.5,
  },
  chapterLockIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chapterLockTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chapterLockTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.3)",
  },
  chapterLockSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.2)",
  },
  recentSection: {
    gap: 10,
  },
  recentSectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.2)",
  },
  recentGhostRow: {
    flexDirection: "row",
    gap: 8,
  },
  recentGhostCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    opacity: 0.55,
  },
  recentGhostBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  lockedWidgetRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  lockedWidgetCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 130,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
    overflow: "hidden",
    opacity: 0.4,
  },
  lockedWidgetGhostNumber: {
    height: 32,
    width: "50%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
  },
  lockedWidgetGhostLabel: {
    marginTop: 8,
    height: 10,
    width: "60%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 4,
  },
  lockedWidgetLockIcon: {
    position: "absolute",
    bottom: 14,
    right: 14,
  },
  lockedFooterHint: {
    marginTop: 16,
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.15)",
    textAlign: "center",
  },
});

export const HOME_LOCKED_BG = LOCKED_BG;
