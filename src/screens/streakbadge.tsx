import { Ionicons } from "@expo/vector-icons";
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FireIcon } from "../components/FireIcon";
import { SparkleIcon } from "../components/SparkleDecor";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import { useStreak } from "../context/StreakContext";
import type { ScanStackParamList } from "../navigation/types";
import { hexWithAlpha } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<ScanStackParamList, "StreakDetails">;

const STREAK_MILESTONES = [
  { id: "rookie", title: "Rookie", days: 3, streakLabel: "3 STREAK", subtitle: "3 day streak", showFlame: false },
  { id: "serious", title: "Getting Serious", days: 10, streakLabel: "10 STREAK", subtitle: "10 day streak", showFlame: true },
  { id: "locked", title: "Locked In", days: 50, streakLabel: "50 STREAK", subtitle: "50 day streak", showFlame: true },
  { id: "triple", title: "Triple Threat", days: 100, streakLabel: "100 STREAK", subtitle: "100 day streak", showFlame: true },
  { id: "nodays", title: "No Days Off", days: 365, streakLabel: "365 STREAK", subtitle: "365 day streak", showFlame: true },
  { id: "immortal", title: "Immortal", days: 1000, streakLabel: "1000 STREAK", subtitle: "1000 day streak", showFlame: true },
] as const;

const SCAN_MILESTONES = [
  { id: "s5", title: "First chapters", scans: 5, subtitle: "5 scans logged", icon: "book-outline" as const },
  { id: "s50", title: "Study streak", scans: 50, subtitle: "50 scans logged", icon: "library-outline" as const },
  { id: "s500", title: "Shelf master", scans: 500, subtitle: "500 scans logged", icon: "albums-outline" as const },
];

const TOTAL_BADGES = STREAK_MILESTONES.length + SCAN_MILESTONES.length;

function countUnlockedBadges(longestStreak: number, scanCount: number): number {
  let n = 0;
  for (const m of STREAK_MILESTONES) {
    if (longestStreak >= m.days) n += 1;
  }
  for (const m of SCAN_MILESTONES) {
    if (scanCount >= m.scans) n += 1;
  }
  return n;
}

export function StreakDetailsScreen({ navigation }: Props) {
  const { darkMode, accentColor } = useAppSettings();
  const { streak } = useStreak();
  const { scans } = useScanContext();
  const scanCount = scans.length;
  const unlocked = countUnlockedBadges(streak.longestStreak, scanCount);
  const progress = TOTAL_BADGES > 0 ? unlocked / TOTAL_BADGES : 0;
  const streakSparkleGold = darkMode ? "#fde68a" : "#f59e0b";

  const onShare = async () => {
    try {
      await Share.share({
        message: `BookNotes: ${streak.currentStreak} day streak · ${unlocked}/${TOTAL_BADGES} milestones · Longest: ${streak.longestStreak} days`,
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topNavRow}>
        <TouchableOpacity
          style={styles.navCircle}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navCircle} onPress={onShare} activeOpacity={0.7}>
          <Ionicons
            name="share-outline"
            size={20}
            color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.pageTitle, darkMode && styles.pageTitleDark]}>Milestones</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <View style={[styles.heroIconWrap, styles.summaryHeroCenter]}>
              <View style={styles.fireHeroCluster}>
                <View style={[styles.streakSparkle, styles.streakSparkleTL]} pointerEvents="none">
                  <SparkleIcon size={11} color={streakSparkleGold} opacity={0.55} />
                </View>
                <View style={[styles.streakSparkle, styles.streakSparkleTR]} pointerEvents="none">
                  <SparkleIcon size={8} color={streakSparkleGold} opacity={0.42} />
                </View>
                <View style={[styles.streakSparkle, styles.streakSparkleML]} pointerEvents="none">
                  <SparkleIcon size={7} color={streakSparkleGold} opacity={0.38} />
                </View>
                <View style={[styles.streakSparkle, styles.streakSparkleBR]} pointerEvents="none">
                  <SparkleIcon size={10} color={streakSparkleGold} opacity={0.48} />
                </View>
                <FireIcon size={72} />
                <View style={[styles.heroCountBadge, darkMode && styles.heroCountBadgeDark]}>
                  <Text style={[styles.heroCountText, darkMode && styles.heroCountTextDark]}>{streak.currentStreak}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.summaryLabel, styles.summaryHeroCenter, darkMode && styles.summaryLabelDark]}>
              Day Streak
            </Text>
            <View style={[styles.statCard, darkMode && styles.statCardDark]}>
              <FireIcon size={18} />
              <View style={styles.statCardText}>
                <Text style={[styles.statCardBold, darkMode && styles.statCardBoldDark]}>
                  {streak.longestStreak} days
                </Text>
                <Text style={[styles.statCardMuted, darkMode && styles.statCardMutedDark]}>longest streak</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryCol}>
            <View style={[styles.heroIconWrap, styles.summaryHeroCenter]}>
              <View style={[styles.badgeHeroPoly, darkMode && styles.badgeHeroPolyDark]}>
                <Ionicons name="ribbon" size={36} color={darkMode ? "#a78bfa" : "#5b21b6"} />
              </View>
              <View style={[styles.heroCountBadge, darkMode && styles.heroCountBadgeDark]}>
                <Text style={[styles.heroCountText, darkMode && styles.heroCountTextDark]}>{unlocked}</Text>
              </View>
            </View>
            <Text style={[styles.summaryLabel, styles.summaryHeroCenter, darkMode && styles.summaryLabelDark]}>
              Badges earned
            </Text>
            <View style={[styles.statCard, darkMode && styles.statCardDark]}>
              <Ionicons name="ribbon-outline" size={18} color={accentColor} />
              <View style={styles.statCardText}>
                <Text style={[styles.statCardBold, darkMode && styles.statCardBoldDark]}>
                  {unlocked}/{TOTAL_BADGES} badges
                </Text>
                <View style={[styles.progressTrack, darkMode && styles.progressTrackDark]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%`, backgroundColor: accentColor },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionHeading, darkMode && styles.sectionHeadingDark]}>Streak milestones</Text>
        <View style={styles.badgeGrid}>
          {STREAK_MILESTONES.map((m) => {
            const earned = streak.longestStreak >= m.days;
            return (
              <View
                key={m.id}
                style={[
                  styles.hexCell,
                  darkMode && styles.hexCellDark,
                  earned && { borderColor: hexWithAlpha(accentColor, 0.55), backgroundColor: hexWithAlpha(accentColor, 0.08) },
                  !earned && styles.hexLocked,
                ]}
              >
                {m.showFlame ? (
                  <View style={styles.hexFlame}>
                    <FireIcon size={20} />
                  </View>
                ) : (
                  <View style={styles.hexFlameSpacer} />
                )}
                <Text style={[styles.hexStreakText, !earned && styles.hexMuted, darkMode && styles.hexStreakTextDark]}>
                  {m.streakLabel}
                </Text>
                <Text style={[styles.hexTitle, darkMode && styles.hexTitleDark]} numberOfLines={2}>
                  {m.title}
                </Text>
                <Text style={[styles.hexSub, darkMode && styles.hexSubDark]}>{m.subtitle}</Text>
                {!earned ? <Ionicons name="lock-closed" size={14} color={darkMode ? "#64748b" : "#94a3b8"} style={styles.hexLock} /> : null}
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced, darkMode && styles.sectionHeadingDark]}>
          Scan milestones
        </Text>
        <View style={styles.badgeGrid}>
          {SCAN_MILESTONES.map((m) => {
            const earned = scanCount >= m.scans;
            return (
              <View
                key={m.id}
                style={[
                  styles.roundCell,
                  darkMode && styles.roundCellDark,
                  earned && { borderColor: hexWithAlpha(accentColor, 0.55), backgroundColor: hexWithAlpha(accentColor, 0.08) },
                  !earned && styles.roundLocked,
                ]}
              >
                <View style={[styles.roundIconCircle, darkMode && styles.roundIconCircleDark]}>
                  <Ionicons name={m.icon} size={26} color={earned ? accentColor : darkMode ? "#64748b" : "#94a3b8"} />
                </View>
                <Text style={[styles.roundNum, darkMode && styles.roundNumDark]}>{m.scans}</Text>
                <Text style={[styles.roundTitle, darkMode && styles.roundTitleDark]} numberOfLines={2}>
                  {m.title}
                </Text>
                <Text style={[styles.hexSub, darkMode && styles.hexSubDark]}>{m.subtitle}</Text>
                {!earned ? <Ionicons name="lock-closed" size={14} color={darkMode ? "#64748b" : "#94a3b8"} style={styles.hexLock} /> : null}
              </View>
            );
          })}
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
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: lightColors.textPrimary,
    marginBottom: 20,
  },
  pageTitleDark: {
    color: darkColors.textPrimary,
  },
  scrollContent: {
    paddingBottom: 40,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  summaryCol: {
    flex: 1,
    alignItems: "stretch",
    gap: 8,
  },
  summaryHeroCenter: {
    alignSelf: "center",
  },
  heroIconWrap: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  fireHeroCluster: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  streakSparkle: {
    position: "absolute",
    zIndex: 0,
  },
  streakSparkleTL: {
    top: 4,
    left: 0,
    transform: [{ rotate: "-14deg" }],
  },
  streakSparkleTR: {
    top: 10,
    right: 4,
    transform: [{ rotate: "18deg" }],
  },
  streakSparkleML: {
    top: 34,
    left: -2,
    transform: [{ rotate: "8deg" }],
  },
  streakSparkleBR: {
    bottom: 22,
    right: 2,
    transform: [{ rotate: "-6deg" }],
  },
  heroCountBadge: {
    position: "absolute",
    bottom: 4,
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15,23,42,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  heroCountBadgeDark: {
    backgroundColor: "#1c1c1c",
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroCountText: {
    fontSize: 13,
    fontWeight: "800",
    color: lightColors.textPrimary,
  },
  heroCountTextDark: {
    color: darkColors.textPrimary,
  },
  badgeHeroPoly: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(91,33,182,0.12)",
  },
  badgeHeroPolyDark: {
    backgroundColor: "rgba(167,139,250,0.15)",
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: lightColors.textSecondary,
  },
  summaryLabelDark: {
    color: darkColors.textMuted,
  },
  statCard: {
    width: "100%",
    height: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  statCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  statCardText: {
    flex: 1,
    gap: 6,
  },
  statCardBold: {
    fontSize: 15,
    fontWeight: "800",
    color: lightColors.textPrimary,
  },
  statCardBoldDark: {
    color: darkColors.textPrimary,
  },
  statCardMuted: {
    fontSize: 12,
    color: lightColors.textMuted,
  },
  statCardMutedDark: {
    color: darkColors.textSecondary,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: lightColors.chipBg,
    overflow: "hidden",
  },
  progressTrackDark: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: lightColors.textMuted,
    marginTop: 12,
    marginBottom: 4,
  },
  sectionHeadingSpaced: {
    marginTop: 20,
  },
  sectionHeadingDark: {
    color: darkColors.textSecondary,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  hexCell: {
    width: "31%",
    minWidth: 100,
    flexGrow: 1,
    maxWidth: "48%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.card,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  hexCellDark: {
    borderColor: darkColors.border,
    backgroundColor: darkColors.card,
  },
  hexLocked: {
    opacity: 0.55,
  },
  hexFlame: {
    marginBottom: 2,
  },
  hexFlameSpacer: {
    height: 22,
  },
  hexStreakText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: lightColors.textPrimary,
    textAlign: "center",
  },
  hexStreakTextDark: {
    color: darkColors.textPrimary,
  },
  hexMuted: {
    opacity: 0.7,
  },
  hexTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: lightColors.textPrimary,
    textAlign: "center",
  },
  hexTitleDark: {
    color: darkColors.textPrimary,
  },
  hexSub: {
    fontSize: 10,
    color: lightColors.textMuted,
    textAlign: "center",
  },
  hexSubDark: {
    color: darkColors.textSecondary,
  },
  hexLock: {
    marginTop: 4,
  },
  roundCell: {
    width: "31%",
    minWidth: 100,
    flexGrow: 1,
    maxWidth: "48%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.card,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  roundCellDark: {
    borderColor: darkColors.border,
    backgroundColor: darkColors.card,
  },
  roundLocked: {
    opacity: 0.55,
  },
  roundIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: lightColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  roundIconCircleDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  roundNum: {
    fontSize: 16,
    fontWeight: "800",
    color: lightColors.textPrimary,
  },
  roundNumDark: {
    color: darkColors.textPrimary,
  },
  roundTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: lightColors.textPrimary,
    textAlign: "center",
  },
  roundTitleDark: {
    color: darkColors.textPrimary,
  },
});
