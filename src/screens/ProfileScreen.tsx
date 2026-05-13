import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OneTimeOfferModal } from "../components/OneTimeOfferModal";
import { PromoParticleStarsLayer } from "../components/PromoParticleField";
import { SparkleIcon } from "../components/SparkleDecor";
import { ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING } from "../navigation/rootTabLayout";
import type { ProfileStackParamList } from "../navigation/types";
import { useAppSettings } from "../context/AppSettingsContext";
import { mixHex } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";

type ProfileHomeNav = NativeStackNavigationProp<ProfileStackParamList, "ProfileHome">;
type IoniconName = ComponentProps<typeof Ionicons>["name"];

const LAST_SYNC_KEY = "profile_last_sync_iso";
const SUPPORT_EMAIL = "support@booknotes.app";
const PRIVACY_URL = "https://example.com/privacy";
const TERMS_URL = "https://example.com/terms";

const SECTION_GAP = 20;
const SECTION_LABEL_TO_CARD = 6;

function formatSyncedTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function SectionLabel({ children, darkMode }: { children: string; darkMode: boolean }) {
  return (
    <Text style={[styles.sectionLabel, !darkMode && styles.sectionLabelLight]} numberOfLines={1}>
      {children}
    </Text>
  );
}

function IconBubble({
  name,
  bubbleBg,
  iconColor,
  size = 18,
}: {
  name: IoniconName;
  bubbleBg: string;
  iconColor: string;
  size?: number;
}) {
  return (
    <View style={[styles.iconBubble, { backgroundColor: bubbleBg }]}>
      <Ionicons name={name} size={size} color={iconColor} />
    </View>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<ProfileHomeNav>();
  const { darkMode, accentColor, accentGradient, soundEffectsEnabled, setSoundEffectsEnabled } =
    useAppSettings();
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LAST_SYNC_KEY).then((raw) => {
      if (cancelled || !raw) return;
      const t = new Date(raw);
      if (!Number.isNaN(t.getTime())) setLastSyncedAt(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openUrl = useCallback(async (url: string, label: string) => {
    if (url.startsWith("mailto:")) {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(label, `Email us at ${SUPPORT_EMAIL}`);
      }
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(label, "Could not open this link on your device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(label, "Something went wrong opening the link.");
    }
  }, []);

  const onRequestFeature = useCallback(() => {
    const q = encodeURIComponent("Feature request");
    void openUrl(`mailto:${SUPPORT_EMAIL}?subject=${q}`, "Request a feature");
  }, [openUrl]);

  const onContactUs = useCallback(() => {
    void openUrl(`mailto:${SUPPORT_EMAIL}`, "Contact us");
  }, [openUrl]);

  const onSyncData = useCallback(async () => {
    const now = new Date();
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString());
      setLastSyncedAt(now);
    } catch {
      Alert.alert("Sync", "Could not save sync time.");
    }
  }, []);

  const onClearAllLocalData = useCallback(() => {
    Alert.alert(
      "Delete all local data?",
      "This removes everything stored in Async Storage on this device: library, scans, reading sessions, streaks, and other saved preferences. You cannot undo this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              setLastSyncedAt(null);
              await reloadAppAsync(
                "All local data was cleared. The app will reload so changes take effect."
              );
            } catch (e) {
              Alert.alert(
                "Could not finish reset",
                e instanceof Error ? e.message : "Try force-quitting the app and opening it again."
              );
            }
          },
        },
      ]
    );
  }, []);

  const promoGradientColors = useMemo(() => {
    const [c0, c1] = accentGradient;
    const top = mixHex("#000000", c0, 0.16);
    const mid = mixHex("#0c0a14", mixHex(c0, c1, 0.4), 0.62);
    const bottom = mixHex(c0, c1, 0.58);
    return [top, mid, bottom] as [string, string, string];
  }, [accentGradient]);

  const syncSubtitle = lastSyncedAt
    ? `Last synced ${formatSyncedTime(lastSyncedAt)}`
    : "Last synced never";
  const syncTrailing = lastSyncedAt ? formatSyncedTime(lastSyncedAt) : "Never";

  const groupCard = [styles.groupCard, darkMode ? styles.groupCardDark : styles.groupCardLight];
  const groupCardSupport = [
    styles.groupCardSupport,
    darkMode ? styles.groupCardSupportDark : styles.groupCardSupportLight,
  ];
  const dividerMain = [styles.rowDivider, darkMode ? styles.rowDividerDark : styles.rowDividerLight];
  const dividerSupport = [
    styles.rowDividerSupport,
    darkMode ? styles.rowDividerSupportDark : styles.rowDividerSupportLight,
  ];
  const chevronMainColor = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  const neutralIconBubble = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const neutralIconColor = darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.screen, darkMode && styles.screenDark]}
    >
      <Text style={[styles.pageTitle, darkMode && styles.pageTitleDark]}>Profile & Settings</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.promoWrap}
          activeOpacity={0.96}
          onPress={() => setOfferModalVisible(true)}
        >
          <LinearGradient
            colors={promoGradientColors}
            locations={[0, 0.48, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.promoGradient}
          >
            <PromoParticleStarsLayer />
            <View style={styles.promoSparkleWatermark} pointerEvents="none">
              <SparkleIcon size={130} color={accentColor} opacity={0.16} />
            </View>
            <View style={styles.promoInner}>
              <Text style={styles.promoTitle}>Unlock BookNotes+</Text>
              <Text style={styles.promoSubtitle}>
                Unlimited scans, smarter notes, and exports — everything you need to study faster.
              </Text>
              <View style={styles.promoCta}>
                <Text style={styles.promoCtaText}>Upgrade now</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.restoreRow}>
          <Text style={[styles.restorePrefix, darkMode && styles.restorePrefixDark]}>
            Already a Pro member?{" "}
          </Text>
          <TouchableOpacity onPress={() => {}} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={[styles.restoreLink, darkMode && styles.restoreLinkDark]}>Restore purchase</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: SECTION_GAP }}>
          <SectionLabel darkMode={darkMode}>Preferences</SectionLabel>
          <View style={[...groupCard, { marginTop: SECTION_LABEL_TO_CARD }]}>
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => navigation.navigate("Appearance")}
              activeOpacity={0.82}
            >
              <IconBubble
                name="color-palette-outline"
                bubbleBg="rgba(168,85,247,0.15)"
                iconColor="#a855f7"
              />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, darkMode && styles.prefTitleDark]}>Appearance</Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>
                  Theme, font, display
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={chevronMainColor} />
            </TouchableOpacity>
            <View style={dividerMain} />
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => navigation.navigate("StudyPreferences")}
              activeOpacity={0.82}
            >
              <IconBubble
                name="book-outline"
                bubbleBg="rgba(59,130,246,0.15)"
                iconColor="#60a5fa"
              />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, darkMode && styles.prefTitleDark]}>
                  Study preferences
                </Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>
                  Extract style, language
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={chevronMainColor} />
            </TouchableOpacity>
            <View style={dividerMain} />
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => navigation.navigate("AppBehavior")}
              activeOpacity={0.82}
            >
              <IconBubble name="options-outline" bubbleBg={neutralIconBubble} iconColor={neutralIconColor} />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, darkMode && styles.prefTitleDark]}>App behaviour</Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>
                  Notifications, defaults
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={chevronMainColor} />
            </TouchableOpacity>
            <View style={dividerMain} />
            <View style={styles.prefRow}>
              <IconBubble name="volume-high-outline" bubbleBg={neutralIconBubble} iconColor={neutralIconColor} />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, darkMode && styles.prefTitleDark]}>Sound effects</Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>
                  Chimes for scans & AI steps
                </Text>
              </View>
              <Switch value={soundEffectsEnabled} onValueChange={setSoundEffectsEnabled} />
            </View>
          </View>
        </View>

        <View style={{ marginTop: SECTION_GAP }}>
          <SectionLabel darkMode={darkMode}>Tools</SectionLabel>
          <View style={[...groupCard, { marginTop: SECTION_LABEL_TO_CARD }]}>
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => navigation.navigate("ExportSettings")}
              activeOpacity={0.82}
            >
              <IconBubble
                name="cloud-upload-outline"
                bubbleBg="rgba(34,197,94,0.12)"
                iconColor="#4ade80"
              />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, darkMode && styles.prefTitleDark]}>Export</Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>
                  PDF, CSV, Notion
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={chevronMainColor} />
            </TouchableOpacity>
            <View style={dividerMain} />
            <TouchableOpacity
              style={styles.prefRow}
              onPress={() => navigation.navigate("ReadingReminders")}
              activeOpacity={0.82}
            >
              <IconBubble
                name="notifications-outline"
                bubbleBg="rgba(251,191,36,0.12)"
                iconColor="#fbbf24"
              />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, darkMode && styles.prefTitleDark]}>Reading reminders</Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>
                  Daily nudges
                </Text>
              </View>
              <Text style={[styles.rowTrailingMuted, darkMode && styles.rowTrailingMutedDark]}>Off</Text>
              <Ionicons name="chevron-forward" size={18} color={chevronMainColor} />
            </TouchableOpacity>
            <View style={dividerMain} />
            <TouchableOpacity style={styles.prefRow} onPress={onSyncData} activeOpacity={0.82}>
              <IconBubble name="refresh-outline" bubbleBg={neutralIconBubble} iconColor={neutralIconColor} />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, darkMode && styles.prefTitleDark]}>Sync data</Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>{syncSubtitle}</Text>
              </View>
              <Text style={[styles.rowTrailingMuted, darkMode && styles.rowTrailingMutedDark]}>
                {syncTrailing}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={chevronMainColor} />
            </TouchableOpacity>
            <View style={dividerMain} />
            <TouchableOpacity style={styles.prefRow} onPress={onClearAllLocalData} activeOpacity={0.82}>
              <IconBubble name="trash-outline" bubbleBg="rgba(239,68,68,0.12)" iconColor="#f87171" />
              <View style={styles.prefRowText}>
                <Text style={[styles.prefTitle, styles.prefTitleDanger, darkMode && styles.prefTitleDangerDark]}>
                  Clear local data
                </Text>
                <Text style={[styles.prefSubtitle, darkMode && styles.prefSubtitleDark]}>
                  Delete Async Storage (library, sessions, preferences)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={chevronMainColor} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: SECTION_GAP }}>
          <SectionLabel darkMode={darkMode}>Support & legal</SectionLabel>
          <View style={[...groupCardSupport, { marginTop: SECTION_LABEL_TO_CARD }]}>
            <TouchableOpacity style={styles.supportRow} onPress={onRequestFeature} activeOpacity={0.82}>
              <Ionicons
                name="megaphone-outline"
                size={14}
                color={darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)"}
              />
              <Text style={[styles.supportLabel, darkMode && styles.supportLabelDark]}>Request a feature</Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"}
              />
            </TouchableOpacity>
            <View style={dividerSupport} />
            <TouchableOpacity style={styles.supportRow} onPress={onContactUs} activeOpacity={0.82}>
              <Ionicons
                name="mail-outline"
                size={14}
                color={darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)"}
              />
              <Text style={[styles.supportLabel, darkMode && styles.supportLabelDark]}>Contact us</Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"}
              />
            </TouchableOpacity>
            <View style={dividerSupport} />
            <TouchableOpacity
              style={styles.supportRow}
              onPress={() => openUrl(PRIVACY_URL, "Privacy Policy")}
              activeOpacity={0.82}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)"}
              />
              <Text style={[styles.supportLabel, darkMode && styles.supportLabelDark]}>Privacy policy</Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"}
              />
            </TouchableOpacity>
            <View style={dividerSupport} />
            <TouchableOpacity
              style={styles.supportRow}
              onPress={() => openUrl(TERMS_URL, "Terms of Service")}
              activeOpacity={0.82}
            >
              <Ionicons
                name="document-outline"
                size={14}
                color={darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)"}
              />
              <Text style={[styles.supportLabel, darkMode && styles.supportLabelDark]}>Terms of service</Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.hintCard, darkMode && styles.hintCardDark]}>
          <Text style={[styles.hint, darkMode && styles.hintDark]}>
            Set EXPO_PUBLIC_OPENAI_API_KEY in your environment to enable AI generation.
          </Text>
        </View>
      </ScrollView>

      <OneTimeOfferModal visible={offerModalVisible} onClose={() => setOfferModalVisible(false)} />
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
  pageTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: lightColors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pageTitleDark: {
    color: "#ffffff",
  },
  scrollContent: {
    paddingBottom: ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING,
    paddingTop: 8,
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
  groupCardSupport: {
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  groupCardSupportDark: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  groupCardSupportLight: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderColor: "rgba(0,0,0,0.06)",
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  prefRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  prefTitleDark: {
    color: "#ffffff",
  },
  prefTitleDanger: {
    color: "#b91c1c",
  },
  prefTitleDangerDark: {
    color: "#fca5a5",
  },
  prefSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(0,0,0,0.4)",
  },
  prefSubtitleDark: {
    color: "rgba(255,255,255,0.35)",
  },
  rowTrailingMuted: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(0,0,0,0.4)",
  },
  rowTrailingMutedDark: {
    color: "rgba(255,255,255,0.35)",
  },
  rowDivider: {
    height: 0.5,
    marginLeft: 14 + 34 + 12,
  },
  rowDividerDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rowDividerLight: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  rowDividerSupport: {
    height: 0.5,
    marginLeft: 14 + 14 + 10,
  },
  rowDividerSupportDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rowDividerSupportLight: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  supportLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(0,0,0,0.4)",
  },
  supportLabelDark: {
    color: "rgba(255,255,255,0.4)",
  },
  promoWrap: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 2,
  },
  promoGradient: {
    borderRadius: 28,
    overflow: "hidden",
    minHeight: 200,
  },
  promoSparkleWatermark: {
    position: "absolute",
    right: -18,
    top: -12,
    zIndex: 0,
  },
  promoInner: {
    position: "relative",
    zIndex: 1,
    padding: 22,
    gap: 12,
  },
  promoTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  promoSubtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  promoCta: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 4,
  },
  promoCtaText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  restoreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  restorePrefix: {
    fontSize: 13,
    color: lightColors.textMuted,
  },
  restorePrefixDark: {
    color: darkColors.textMuted,
  },
  restoreLink: {
    fontSize: 13,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  restoreLinkDark: {
    color: darkColors.textPrimary,
  },
  hintCard: {
    marginTop: SECTION_GAP,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  hintCardDark: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  hint: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  hintDark: {
    color: darkColors.textSecondary,
  },
});
