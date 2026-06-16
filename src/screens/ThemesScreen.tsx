import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Easing,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ButtonFloatingSparkles } from "../components/SparkleDecor";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { settingsScrollContentLightStyle, settingsScrollLight } from "../components/SettingsGroupCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ProfileStackParamList } from "../navigation/types";
import { accentLabels } from "../theme/accentLabels";
import { hexWithAlpha, mixHex } from "../theme/colorUtils";
import type { AccentTheme } from "../theme/colors";
import { accentColors, accentGradients, darkColors, lightColors } from "../theme/colors";

/** Local artwork per accent; emerald uses gradient-only card when asset missing. */
const accentImages: Record<AccentTheme, number | undefined> = {
  blue: require("../../assets/bluebcg2.jpg"),
  purple: require("../../assets/purplebcg.jpg"),
  pink: require("../../assets/pinkbcg2.jpg"),
  emerald: require("../../assets/emeraldbcg.jpg"),
  orange: require("../../assets/yellowbcg.jpg"),
  red: require("../../assets/redbcg2.jpg"),
  teal: require("../../assets/tealbcg.jpg"),
};

const ACCENT_ORDER: AccentTheme[] = [
  "blue",
  "purple",
  "pink",
  "emerald",
  "orange",
  "red",
  "teal",
];

const accentImageNudge: Partial<Record<AccentTheme, { scale: number; translateY: number }>> = {
  purple: { scale: 1, translateY: 0 },
  pink: { scale: 1, translateY: 0 },
};

const THEME_TOAST_MS = 2800;

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Themes">;

export function ThemesScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode, accentTheme, setAccentTheme } = useAppSettings();
  const [themeToastKey, setThemeToastKey] = useState<AccentTheme | null>(null);
  const themeToastKeyRef = useRef<AccentTheme | null>(null);
  themeToastKeyRef.current = themeToastKey;
  const themeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(24)).current;
  const toastScale = useRef(new Animated.Value(0.9)).current;
  const toastDismissingRef = useRef(false);

  const dismissThemeToastAnimated = useCallback(() => {
    if (toastDismissingRef.current || themeToastKeyRef.current === null) return;
    toastDismissingRef.current = true;
    if (themeToastTimerRef.current) {
      clearTimeout(themeToastTimerRef.current);
      themeToastTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: -32,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(toastScale, {
        toValue: 0.94,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      toastDismissingRef.current = false;
      if (finished) {
        setThemeToastKey(null);
      }
    });
  }, [toastOpacity, toastScale, toastTranslateY]);

  const showThemeToast = (key: AccentTheme) => {
    toastDismissingRef.current = false;
    toastOpacity.stopAnimation();
    toastTranslateY.stopAnimation();
    toastScale.stopAnimation();
    if (themeToastTimerRef.current) {
      clearTimeout(themeToastTimerRef.current);
    }
    setThemeToastKey(key);
    themeToastTimerRef.current = setTimeout(() => {
      themeToastTimerRef.current = null;
      dismissThemeToastAnimated();
    }, THEME_TOAST_MS);
  };

  useEffect(() => {
    return () => {
      if (themeToastTimerRef.current) clearTimeout(themeToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (themeToastKey === null) return;
    toastDismissingRef.current = false;
    toastOpacity.setValue(0);
    toastTranslateY.setValue(24);
    toastScale.setValue(0.9);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(toastScale, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [themeToastKey]);

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
          Themes
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView
        style={!darkMode ? settingsScrollLight : undefined}
        contentContainerStyle={[
          styles.scrollContent,
          !darkMode && settingsScrollContentLightStyle({ paddingBottom: 32 }),
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsOptionHeroCard
          icon="color-palette-outline"
          title="Choose your theme"
          description="Pick an accent palette for the whole app."
          compactDescription
        />

        <View style={styles.themeList}>
          {ACCENT_ORDER.map((key) => (
            <ThemeWorldCard
              key={key}
              accentKey={key}
              label={accentLabels[key]}
              selected={accentTheme === key}
              screenBackgroundColor={darkMode ? darkColors.background : lightColors.background}
              onSelect={() => {
                if (accentTheme !== key) {
                  Haptics.selectionAsync().catch(() => {});
                  setAccentTheme(key);
                  showThemeToast(key);
                }
              }}
            />
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={themeToastKey !== null}
        transparent
        animationType="none"
        onRequestClose={dismissThemeToastAnimated}
      >
        <View style={styles.themeToastRoot}>
          <TouchableOpacity
            style={styles.themeToastBackdrop}
            activeOpacity={1}
            onPress={dismissThemeToastAnimated}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          {themeToastKey ? (
            <View style={styles.themeToastWrap} pointerEvents="box-none">
              <Animated.View
                style={{
                  opacity: toastOpacity,
                  transform: [{ translateY: toastTranslateY }, { scale: toastScale }],
                }}
              >
                <ThemeUpdatedCard
                  accentKey={themeToastKey}
                  darkMode={darkMode}
                  onDismiss={dismissThemeToastAnimated}
                />
              </Animated.View>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ThemeUpdatedCard({
  accentKey,
  darkMode,
  onDismiss,
}: {
  accentKey: AccentTheme;
  darkMode: boolean;
  onDismiss: () => void;
}) {
  const accent = accentColors[accentKey];
  const [g0, g1] = accentGradients[accentKey];

  const surfaceColors = darkMode
    ? ([mixHex(darkColors.card, g0, 0.22), darkColors.card] as const)
    : ([mixHex("#ffffff", g0, 0.09), mixHex("#ffffff", g1, 0.04)] as const);

  return (
    <View
      style={[
        styles.themeToastCardOuter,
        {
          borderColor: accent,
          shadowColor: accent,
        },
      ]}
    >
      <LinearGradient
        colors={[surfaceColors[0], surfaceColors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.themeToastCardInner}
      >
        <View
          style={[
            styles.themeToastIconRing,
            {
              borderColor: hexWithAlpha(accent, 0.5),
              backgroundColor: hexWithAlpha(accent, darkMode ? 0.12 : 0.08),
            },
          ]}
        >
          <Ionicons name="checkmark" size={22} color={accent} />
        </View>
        <Text style={[styles.themeToastHeading, darkMode && styles.themeToastHeadingDark]}>Theme updated</Text>
        <Text style={[styles.themeToastBody, darkMode && styles.themeToastBodyDark]}>
          Your theme has changed to{" "}
          <Text style={[styles.themeToastEmphasis, { color: accent }]}>{accentLabels[accentKey]}</Text>.
        </Text>
        <TouchableOpacity
          style={[styles.themeToastButton, { backgroundColor: accent }]}
          onPress={onDismiss}
          activeOpacity={0.85}
        >
          <ButtonFloatingSparkles />
          <Text style={styles.themeToastButtonText}>OK</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

function ThemeWorldCard({
  accentKey,
  label,
  selected,
  screenBackgroundColor,
  onSelect,
}: {
  accentKey: AccentTheme;
  label: string;
  selected: boolean;
  screenBackgroundColor: string;
  onSelect: () => void;
}) {
  const image = accentImages[accentKey];
  const gradient = accentGradients[accentKey];

  const radio = (
    <View style={styles.radioWrap}>
      <View style={styles.radioCircleStack}>
        {!selected ? <View style={styles.radioUnselectedBackdrop} /> : null}
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={[styles.radioInner, { backgroundColor: accentGradients[accentKey][0] }]} /> : null}
        </View>
      </View>
    </View>
  );

  const labelBar = (
    <View style={styles.themeLabelBar}>
      <Text style={styles.themeLabelText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  const artOverlay = !selected ? (
    <View style={styles.desaturateOverlay} pointerEvents="none" />
  ) : null;

  const accent = accentColors[accentKey];
  const cardFrameStyle = {
    borderWidth: CARD_BORDER_WIDTH,
    borderRadius: CARD_RADIUS,
    borderColor: selected ? accent : screenBackgroundColor,
  };

  if (image === undefined) {
    return (
      <Pressable
        onPress={onSelect}
        style={({ pressed }) => [styles.cardOuter, cardFrameStyle, pressed && styles.cardPressed]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardArtColumn}>
            {artOverlay}
            {radio}
            <View style={styles.themeLabelBarSpacer} />
          </View>
          {labelBar}
        </LinearGradient>
      </Pressable>
    );
  }

  const nudge = accentImageNudge[accentKey];
  const imageStyle = [
    styles.cardImageBitmap,
    nudge != null
      ? {
          transform: [{ scale: nudge.scale }, { translateY: nudge.translateY }],
        }
      : null,
  ];

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [styles.cardOuter, cardFrameStyle, pressed && styles.cardPressed]}
    >
      <ImageBackground
        source={image}
        style={styles.cardImage}
        imageStyle={imageStyle}
        resizeMode="cover"
      >
        <View style={styles.cardArtColumn}>
          {artOverlay}
          {radio}
          <View style={styles.themeLabelBarSpacer} />
        </View>
        {labelBar}
      </ImageBackground>
    </Pressable>
  );
}

const CARD_RADIUS = 22;
const CARD_BORDER_WIDTH = 3;
const CARD_INNER_RADIUS = CARD_RADIUS - CARD_BORDER_WIDTH;

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
    paddingBottom: 32,
    gap: 14,
  },
  themeList: {
    gap: 16,
    marginTop: 4,
  },
  cardOuter: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    backgroundColor: lightColors.card,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    borderCurve: "continuous",
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  cardImage: {
    minHeight: 168,
    flexDirection: "column",
    borderRadius: CARD_INNER_RADIUS,
    overflow: "hidden",
  },
  cardImageBitmap: {
    borderRadius: CARD_INNER_RADIUS,
  },
  cardGradient: {
    minHeight: 168,
    borderRadius: CARD_INNER_RADIUS,
    flexDirection: "column",
    overflow: "hidden",
  },
  cardArtColumn: {
    flex: 1,
    minHeight: 96,
    position: "relative",
  },
  desaturateOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(220, 222, 230, 0.52)",
  },
  radioWrap: {
    padding: 14,
  },
  radioCircleStack: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  radioUnselectedBackdrop: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  radioOuter: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    backgroundColor: "#ffffff",
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  themeLabelBarSpacer: {
    flex: 1,
  },
  themeLabelBar: {
    backgroundColor: "#000000",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  themeLabelText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  themeToastRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  themeToastBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: darkColors.overlay,
  },
  themeToastWrap: {
    width: "100%",
    maxWidth: 340,
    paddingHorizontal: 24,
    zIndex: 1,
  },
  themeToastCardOuter: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    borderCurve: "continuous",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 24,
    elevation: 16,
  },
  themeToastCardInner: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: "center",
    gap: 6,
  },
  themeToastIconRing: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeToastHeading: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: lightColors.textPrimary,
    textAlign: "center",
  },
  themeToastHeadingDark: {
    color: darkColors.textPrimary,
  },
  themeToastBody: {
    fontSize: 14,
    lineHeight: 19,
    color: lightColors.textSecondary,
    textAlign: "center",
    letterSpacing: 0.08,
  },
  themeToastBodyDark: {
    color: darkColors.textMuted,
  },
  themeToastEmphasis: {
    fontWeight: "800",
  },
  themeToastButton: {
    marginTop: 0,
    alignSelf: "stretch",
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  themeToastButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    zIndex: 1,
  },
});
