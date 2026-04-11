import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PromoParticleStarsLayer } from "./PromoParticleField";
import { CardSparkleDecor } from "./SparkleDecor";
import { useAppSettings } from "../context/AppSettingsContext";
import { hexWithAlpha, mixHex } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function OneTimeOfferModal({ visible, onClose }: Props) {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const [freeTrialEnabled, setFreeTrialEnabled] = useState(true);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /** Fills space between hero/pricing and the plan + CTA block so the button sits lower. */
  const offerColumnMinHeight = Math.max(
    (windowHeight - insets.top - insets.bottom - 52) * 0.9,
    396
  );

  const heroGradient = useMemo(() => {
    const [c0, c1] = accentGradient;
    const a = mixHex("#0f172a", c0, 0.35);
    const b = mixHex(c0, c1, 0.55);
    return [mixHex("#000000", a, 0.25), b] as [string, string];
  }, [accentGradient]);

  const planBorderColor = accentColor;

  const bg = darkMode ? darkColors.background : "#ffffff";
  const textPrimary = darkMode ? darkColors.textPrimary : lightColors.textPrimary;
  const textMuted = darkMode ? darkColors.textMuted : lightColors.textMuted;
  const textSecondary = darkMode ? darkColors.textSecondary : lightColors.textSecondary;
  const cardBg = darkMode ? darkColors.card : lightColors.card;
  const borderSubtle = darkMode ? darkColors.border : lightColors.border;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={28} color={textPrimary} />
          </Pressable>
        </View>

        <View style={styles.scrollArea}>
          <ScrollView
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.offerColumn, { minHeight: offerColumnMinHeight }]}>
              <View style={styles.offerTop}>
                <Text style={[styles.headline, { color: textPrimary }]}>Your one-time offer</Text>

                <View style={styles.heroWithDecor}>
                  <View style={[styles.heroShadowWrap, Platform.OS === "ios" && styles.heroShadowIOS]}>
                    <LinearGradient
                      colors={heroGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.heroCard}
                    >
                      <PromoParticleStarsLayer />
                      <Text style={styles.heroPct}>80% OFF</Text>
                    </LinearGradient>
                  </View>
                  <CardSparkleDecor color={hexWithAlpha(accentColor, 0.92)} />
                </View>

                <View style={styles.priceBlock}>
                  <Text style={[styles.priceLine, { color: textPrimary }]}>
                    <Text style={styles.strike}>$29.99</Text>
                    <Text> </Text>
                    <Text style={styles.priceStrong}>$1.66</Text>
                    <Text style={[styles.priceMo, { color: textSecondary }]}> /mo</Text>
                  </Text>
                  <Text style={[styles.disclaimer, { color: textMuted }]}>
                    Once you close your one-time offer, it&apos;s gone! Save 80% with yearly plan
                  </Text>
                </View>
              </View>

              <View style={styles.offerBottom}>
                <View style={styles.trialRow}>
                  <Text style={[styles.trialLabel, { color: textPrimary }]}>Free Trial Enabled</Text>
                  <Switch
                    value={freeTrialEnabled}
                    onValueChange={setFreeTrialEnabled}
                    trackColor={{ false: borderSubtle, true: hexWithAlpha(accentColor, 0.45) }}
                    thumbColor={freeTrialEnabled ? accentColor : "#f4f4f5"}
                    ios_backgroundColor={borderSubtle}
                  />
                </View>

                <View style={[styles.planCard, { borderColor: planBorderColor, backgroundColor: cardBg }]}>
                  <View style={[styles.planBadge, { backgroundColor: accentColor }]}>
                    <Text style={styles.planBadgeText}>3-DAY FREE TRIAL</Text>
                  </View>
                  <View style={styles.planBody}>
                    <View style={styles.planRow}>
                      <Text style={[styles.planTitle, { color: textPrimary }]}>Yearly Plan</Text>
                      <Text style={[styles.planPrice, { color: textPrimary }]}>$1.66 /mo</Text>
                    </View>
                    <Text style={[styles.planSub, { color: textMuted }]}>12mo • $19.99</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: accentColor, shadowColor: accentColor }]}
                  onPress={() => {}}
                  activeOpacity={0.88}
                >
                  <Text style={styles.ctaText}>Start Free Trial</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footerRow}>
              <Ionicons name="checkmark-circle" size={18} color={accentColor} />
              <Text style={[styles.footerText, { color: textPrimary }]}>No Commitment - Cancel Anytime</Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  closeBtn: {
    alignSelf: "flex-start",
    padding: 8,
    borderRadius: 12,
  },
  closeBtnPressed: {
    opacity: 0.6,
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 12,
    minHeight: "100%",
  },
  offerColumn: {
    width: "100%",
    justifyContent: "space-between",
  },
  offerTop: {
    gap: 18,
    paddingTop: 8,
  },
  offerBottom: {
    gap: 10,
    width: "100%",
    marginTop: -22,
  },
  headline: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroWithDecor: {
    position: "relative",
    width: "100%",
    alignItems: "center",
  },
  heroShadowWrap: {
    borderRadius: 22,
    alignSelf: "center",
    width: "70%",
    maxWidth: 306,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  heroShadowIOS: {
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroCard: {
    position: "relative",
    borderRadius: 22,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    overflow: "hidden",
  },
  heroPct: {
    position: "relative",
    zIndex: 1,
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1,
  },
  priceBlock: {
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 8,
  },
  priceLine: {
    fontSize: 22,
    fontWeight: "700",
  },
  strike: {
    textDecorationLine: "line-through",
    fontWeight: "600",
    opacity: 0.45,
    fontSize: 18,
  },
  priceStrong: {
    fontWeight: "800",
    fontSize: 24,
  },
  priceMo: {
    fontWeight: "600",
    fontSize: 18,
  },
  disclaimer: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  trialRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 0,
    width: "100%",
  },
  trialLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },
  planBadge: {
    paddingVertical: 10,
    alignItems: "center",
  },
  planBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  planBody: {
    padding: 16,
    gap: 6,
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  planPrice: {
    fontSize: 17,
    fontWeight: "800",
  },
  planSub: {
    fontSize: 13,
    fontWeight: "600",
  },
  cta: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingBottom: 8,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
