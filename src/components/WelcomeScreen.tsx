import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FONT_DM_SERIF_DISPLAY } from "../theme/fonts";

const BG = "#111";
const HERO_MOUNT_DELAY_MS = 300;
const HERO_LINE_DURATION_MS = 400;
const HERO_SUBTITLE_FADE_MS = 300;
const HERO_LAST_LINE_DELAY_MS = 300;
const PRIMARY_SHIMMER_DELAY_MS = 1200;
const PRIMARY_SHIMMER_DURATION_MS = 700;
const PRIMARY_SHIMMER_WIDTH = 120;
const PRIMARY_SHIMMER_COLORS = [
  "rgba(255,255,255,0)",
  "rgba(0,0,0,0.08)",
  "rgba(255,255,255,0)",
] as const;

function useHeroLineAnimation(lineDelay: number) {
  const translateY = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(HERO_MOUNT_DELAY_MS + lineDelay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: 4,
            duration: 320,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(2)),
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
        ]),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [lineDelay, opacity, translateY]);

  return { translateY, opacity };
}

function useHeroSubtitleFade() {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(HERO_MOUNT_DELAY_MS + HERO_LAST_LINE_DELAY_MS + HERO_LINE_DURATION_MS),
      Animated.timing(opacity, {
        toValue: 1,
        duration: HERO_SUBTITLE_FADE_MS,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return opacity;
}

function usePrimaryButtonShimmer(buttonWidth: number, buttonHeight: number) {
  const shimmerX = useRef(new Animated.Value(-PRIMARY_SHIMMER_WIDTH)).current;

  useEffect(() => {
    if (buttonWidth <= 0 || buttonHeight <= 0) return;

    shimmerX.setValue(-PRIMARY_SHIMMER_WIDTH);
    const timeout = setTimeout(() => {
      Animated.timing(shimmerX, {
        toValue: buttonWidth + PRIMARY_SHIMMER_WIDTH,
        duration: PRIMARY_SHIMMER_DURATION_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, PRIMARY_SHIMMER_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [buttonHeight, buttonWidth, shimmerX]);

  return shimmerX;
}

const FEATURES = [
  {
    icon: "camera-outline" as const,
    iconColor: "#60a5fa",
    iconBg: "rgba(96,165,250,0.18)",
    title: "Scan pages as you read",
    description: "Point your camera at a page — AI does the rest in seconds.",
  },
  {
    icon: "sparkles-outline" as const,
    iconColor: "#a855f7",
    iconBg: "rgba(168,85,247,0.18)",
    title: "AI extracts what matters",
    description: "Key ideas, quotes, summaries and bullet points — automatically.",
  },
  {
    icon: "library-outline" as const,
    iconColor: "#fbbf24",
    iconBg: "rgba(251,191,36,0.18)",
    title: "Build your knowledge library",
    description: "Every book you read becomes a searchable archive of ideas.",
  },
] as const;

type Props = {
  onAddFirstBook: () => void;
  onTakePhoto: () => void;
  onSkip: () => void;
};

export function WelcomeScreen({ onAddFirstBook, onTakePhoto, onSkip }: Props) {
  const line1 = useHeroLineAnimation(0);
  const line2 = useHeroLineAnimation(150);
  const line3 = useHeroLineAnimation(300);
  const subtitleOpacity = useHeroSubtitleFade();
  const [primaryButtonSize, setPrimaryButtonSize] = useState({ width: 0, height: 0 });
  const shimmerX = usePrimaryButtonShimmer(primaryButtonSize.width, primaryButtonSize.height);

  const onPrimaryButtonLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== primaryButtonSize.width || height !== primaryButtonSize.height) {
      setPrimaryButtonSize({ width, height });
    }
  };

  return (
    <View style={styles.screen}>
      <View>
        <Text style={styles.appName}>BookNotes</Text>
        <Animated.Text
          style={[
            styles.headline,
            styles.headlineFirst,
            { opacity: line1.opacity, transform: [{ translateY: line1.translateY }] },
          ]}
        >
          Read it.
        </Animated.Text>
        <Animated.Text
          style={[styles.headline, { opacity: line2.opacity, transform: [{ translateY: line2.translateY }] }]}
        >
          Scan it.
        </Animated.Text>
        <Animated.Text
          style={[styles.headline, { opacity: line3.opacity, transform: [{ translateY: line3.translateY }] }]}
        >
          Never forget it.
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          Scan any page you read and AI extracts the key ideas, quotes and summaries automatically.
        </Animated.Text>
      </View>

      <View style={styles.middleBlock}>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.featureRow}>
            <View style={[styles.featureIconWrap, { backgroundColor: feature.iconBg }]}>
              <Ionicons name={feature.icon} size={20} color={feature.iconColor} />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription} numberOfLines={2} ellipsizeMode="tail">
                {feature.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.bottomBlock}>
        <View style={styles.primaryButtonWrap} onLayout={onPrimaryButtonLayout}>
          <Pressable
            onPress={onAddFirstBook}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add your first book"
          >
            <Ionicons name="barcode-outline" size={18} color="#111111" />
            <Text style={styles.primaryButtonText}>Add your first book</Text>
          </Pressable>
          {primaryButtonSize.height > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.primaryButtonShimmer,
                {
                  height: primaryButtonSize.height,
                  transform: [{ translateX: shimmerX }],
                },
              ]}
            >
              <LinearGradient
                colors={[...PRIMARY_SHIMMER_COLORS]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: PRIMARY_SHIMMER_WIDTH,
                  height: primaryButtonSize.height,
                }}
              />
            </Animated.View>
          ) : null}
        </View>
        <Pressable
          onPress={onTakePhoto}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
        >
          <Ionicons name="camera-outline" size={17} color="rgba(255,255,255,0.45)" />
          <Text style={styles.secondaryButtonText}>Take a photo</Text>
        </Pressable>
        <Pressable
          onPress={onSkip}
          style={({ pressed }) => [styles.skipWrap, pressed && styles.skipPressed]}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  middleBlock: {
    gap: 20,
  },
  bottomBlock: {
    gap: 10,
  },
  appName: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.52,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.3)",
  },
  headlineFirst: {
    marginTop: 8,
  },
  headline: {
    fontFamily: FONT_DM_SERIF_DISPLAY,
    fontSize: 34,
    fontWeight: "400",
    letterSpacing: -0.68,
    lineHeight: 39.1,
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    color: "rgba(255,255,255,0.45)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureTextCol: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#ffffff",
  },
  featureDescription: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16.8,
    color: "rgba(255,255,255,0.4)",
  },
  primaryButtonWrap: {
    borderRadius: 16,
    overflow: "hidden",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  primaryButtonShimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
  },
  skipWrap: {
    marginTop: 4,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipText: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.18)",
    textAlign: "center",
  },
});
