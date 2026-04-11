import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderText } from "../components/HeaderText";
import { OneTimeOfferModal } from "../components/OneTimeOfferModal";
import { PromoParticleStarsLayer } from "../components/PromoParticleField";
import { SparkleIcon } from "../components/SparkleDecor";
import type { ProfileStackParamList } from "../navigation/types";
import { useAppSettings } from "../context/AppSettingsContext";
import { mixHex } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";

type ProfileHomeNav = NativeStackNavigationProp<ProfileStackParamList, "ProfileHome">;

const LAST_SYNC_KEY = "profile_last_sync_iso";
const SUPPORT_EMAIL = "support@booknotes.app";
const PRIVACY_URL = "https://example.com/privacy";
const TERMS_URL = "https://example.com/terms";

function formatSyncedTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ProfileScreen() {
  const navigation = useNavigation<ProfileHomeNav>();
  const { darkMode, accentColor, accentGradient } = useAppSettings();
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

  const promoGradientColors = useMemo(() => {
    const [c0, c1] = accentGradient;
    const top = mixHex("#000000", c0, 0.16);
    const mid = mixHex("#0c0a14", mixHex(c0, c1, 0.4), 0.62);
    const bottom = mixHex(c0, c1, 0.58);
    return [top, mid, bottom] as [string, string, string];
  }, [accentGradient]);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.screen, darkMode && styles.screenDark]}
    >
      <HeaderText
        title="Profile & Settings"
        subtitle="Tune note style, language, and export options."
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <TouchableOpacity
            style={styles.exportHeaderRow}
            onPress={() => navigation.navigate("Appearance")}
            activeOpacity={0.85}
          >
            <View style={styles.exportHeaderLeft}>
              <Ionicons name="color-palette-outline" size={22} color={accentColor} />
              <Text style={[styles.exportHeaderLabel, darkMode && styles.textDark]}>Appearance</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.accentChevron} />
          </TouchableOpacity>
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <TouchableOpacity
            style={styles.exportHeaderRow}
            onPress={() => navigation.navigate("StudyPreferences")}
            activeOpacity={0.85}
          >
            <View style={styles.exportHeaderLeft}>
              <Ionicons name="school-outline" size={22} color={accentColor} />
              <Text style={[styles.exportHeaderLabel, darkMode && styles.textDark]}>Study Preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.accentChevron} />
          </TouchableOpacity>
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <TouchableOpacity
            style={styles.exportHeaderRow}
            onPress={() => navigation.navigate("AppBehavior")}
            activeOpacity={0.85}
          >
            <View style={styles.exportHeaderLeft}>
              <Ionicons name="options-outline" size={22} color={accentColor} />
              <Text style={[styles.exportHeaderLabel, darkMode && styles.textDark]}>App Behavior</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.accentChevron} />
          </TouchableOpacity>
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <TouchableOpacity
            style={styles.exportHeaderRow}
            onPress={() => navigation.navigate("ExportSettings")}
            activeOpacity={0.85}
          >
            <View style={styles.exportHeaderLeft}>
              <Ionicons name="share-outline" size={22} color={accentColor} />
              <Text style={[styles.exportHeaderLabel, darkMode && styles.textDark]}>Export</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.accentChevron} />
          </TouchableOpacity>
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
          <TouchableOpacity
            style={styles.exportHeaderRow}
            onPress={() => navigation.navigate("ReadingReminders")}
            activeOpacity={0.85}
          >
            <View style={styles.exportHeaderLeft}>
              <Ionicons name="notifications-outline" size={22} color={accentColor} />
              <Text style={[styles.exportHeaderLabel, darkMode && styles.textDark]}>Reading reminders</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.accentChevron} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, darkMode && styles.sectionHeadingDark]}>Support & Legal</Text>
        <View style={[styles.settingsCard, styles.supportLegalCard, darkMode && styles.settingsCardDark]}>
          <TouchableOpacity
            style={styles.supportRow}
            onPress={onRequestFeature}
            activeOpacity={0.85}
          >
            <View style={styles.supportRowLeft}>
              <Ionicons name="megaphone-outline" size={22} color={accentColor} />
              <Text style={[styles.supportLabel, darkMode && styles.textDark]}>Request a Feature</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.mutedChevron} />
          </TouchableOpacity>
          <View style={[styles.supportSeparator, darkMode && styles.supportSeparatorDark]} />
          <TouchableOpacity style={styles.supportRow} onPress={onContactUs} activeOpacity={0.85}>
            <View style={styles.supportRowLeft}>
              <Ionicons name="mail-outline" size={22} color={accentColor} />
              <Text style={[styles.supportLabel, darkMode && styles.textDark]}>Contact Us</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.mutedChevron} />
          </TouchableOpacity>
          <View style={[styles.supportSeparator, darkMode && styles.supportSeparatorDark]} />
          <TouchableOpacity
            style={styles.supportRow}
            onPress={() => openUrl(PRIVACY_URL, "Privacy Policy")}
            activeOpacity={0.85}
          >
            <View style={styles.supportRowLeft}>
              <Ionicons name="document-text-outline" size={22} color={accentColor} />
              <Text style={[styles.supportLabel, darkMode && styles.textDark]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.mutedChevron} />
          </TouchableOpacity>
          <View style={[styles.supportSeparator, darkMode && styles.supportSeparatorDark]} />
          <TouchableOpacity
            style={styles.supportRow}
            onPress={() => openUrl(TERMS_URL, "Terms of Service")}
            activeOpacity={0.85}
          >
            <View style={styles.supportRowLeft}>
              <Ionicons name="document-outline" size={22} color={accentColor} />
              <Text style={[styles.supportLabel, darkMode && styles.textDark]}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.mutedChevron} />
          </TouchableOpacity>
          <View style={[styles.supportSeparator, darkMode && styles.supportSeparatorDark]} />
          <TouchableOpacity style={styles.supportRow} onPress={onSyncData} activeOpacity={0.85}>
            <View style={styles.supportRowLeft}>
              <Ionicons name="sync-outline" size={22} color={accentColor} />
              <Text style={[styles.supportLabel, darkMode && styles.textDark]}>Sync Data</Text>
            </View>
            <View style={styles.supportRowRight}>
              <Text style={[styles.supportDetail, darkMode && styles.supportDetailDark]} numberOfLines={1}>
                {lastSyncedAt ? `Last synced: ${formatSyncedTime(lastSyncedAt)}` : "Never synced"}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={accentColor} style={styles.mutedChevron} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
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
  scrollContent: {
    paddingBottom: 110,
    gap: 12,
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
  settingsCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 16,
    gap: 12,
  },
  settingsCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  exportHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  exportHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exportHeaderLabel: {
    color: lightColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  accentChevron: {
    opacity: 0.55,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "600",
    color: lightColors.textMuted,
    marginBottom: 2,
    marginTop: 4,
  },
  sectionHeadingDark: {
    color: darkColors.textSecondary,
  },
  supportLegalCard: {
    gap: 0,
    paddingVertical: 4,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 10,
  },
  supportRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  supportRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    maxWidth: "52%",
  },
  supportLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  supportDetail: {
    fontSize: 13,
    fontWeight: "500",
    color: lightColors.textMuted,
    textAlign: "right",
  },
  supportDetailDark: {
    color: darkColors.textSecondary,
  },
  supportSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
    backgroundColor: lightColors.borderStrong,
  },
  supportSeparatorDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  mutedChevron: {
    opacity: 0.45,
  },
  hint: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  hintDark: {
    color: darkColors.textSecondary,
  },
  textDark: {
    color: darkColors.textPrimary,
  },
});
