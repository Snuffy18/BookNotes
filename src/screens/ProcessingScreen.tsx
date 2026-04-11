import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AccentShimmerText } from "../components/AccentShimmerText";
import { HeaderText } from "../components/HeaderText";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { generateNotesFromImage } from "../services/ai";
import { useStreak } from "../context/StreakContext";
import { useScanContext } from "../context/ScanContext";
import { useStudyPreferences } from "../context/StudyPreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<ScanStackParamList, "Processing">;

const PROCESSING_STEPS = [
  "OCR extracting text",
  "Understanding content",
  "Building summary + key ideas",
] as const;

const STEP_MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

function ActivePulseDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.28,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[
        styles.pulseDot,
        { backgroundColor: color, opacity: pulse },
      ]}
    />
  );
}

const STEP_SHIMMER_MS = 1500;
const STEP_FADE_IN_MS = 340;

type RowPhase = "pending" | "shimmer" | "solid";
type LoaderLinePhase = "hidden" | "shimmer" | "solid";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function hapticStepCompleted() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function ProcessingScreen({ navigation, route }: Props) {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const studyPrefs = useStudyPreferences();
  const { addScan, activeBook } = useScanContext();
  const { recordSuccessfulScan } = useStreak();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);
  /** 0–1 fill synced with each step / loader shimmer sweep. */
  const progressFill = useRef(new Animated.Value(0)).current;
  /** One-shot 0→1 per step / loader line while text uses accent shimmer. */
  const textShimmerDriver = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(
    PROCESSING_STEPS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(10),
    }))
  ).current;
  const loaderFade = useRef({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(8),
  }).current;

  const [rowPhases, setRowPhases] = useState<RowPhase[]>(["shimmer", "pending", "pending"]);
  const [loaderLinePhase, setLoaderLinePhase] = useState<LoaderLinePhase>("hidden");

  const layoutPendingRef = useRef(false);
  const layoutResolveRef = useRef<(() => void) | null>(null);

  const handleAccentLayoutReady = useCallback(() => {
    if (layoutResolveRef.current) {
      const r = layoutResolveRef.current;
      layoutResolveRef.current = null;
      r();
    } else {
      layoutPendingRef.current = true;
    }
  }, []);

  const waitForLayoutReady = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (layoutPendingRef.current) {
        layoutPendingRef.current = false;
        queueMicrotask(resolve);
        return;
      }
      layoutResolveRef.current = resolve;
    });
  }, []);

  const runTextShimmerSweep = useCallback(() => {
    textShimmerDriver.setValue(0);
    return new Promise<void>((resolve) => {
      Animated.timing(textShimmerDriver, {
        toValue: 1,
        duration: STEP_SHIMMER_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) resolve();
      });
    });
  }, [textShimmerDriver]);

  /** Advances bar fill in lockstep with `runTextShimmerSweep` (same duration). */
  const animateProgressTo = useCallback(
    (to: number) => {
      return new Promise<void>((resolve) => {
        Animated.timing(progressFill, {
          toValue: to,
          duration: STEP_SHIMMER_MS,
          easing: Easing.linear,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) resolve();
        });
      });
    },
    [progressFill]
  );

  const animateStepFadeIn = useCallback(
    (index: number) => {
      stepFade[index].opacity.setValue(0);
      stepFade[index].translateY.setValue(10);
      Animated.parallel([
        Animated.timing(stepFade[index].opacity, {
          toValue: 1,
          duration: STEP_FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(stepFade[index].translateY, {
          toValue: 0,
          duration: STEP_FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [stepFade]
  );

  const animateLoaderFadeIn = useCallback(() => {
    loaderFade.opacity.setValue(0);
    loaderFade.translateY.setValue(8);
    Animated.parallel([
      Animated.timing(loaderFade.opacity, {
        toValue: 1,
        duration: STEP_FADE_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(loaderFade.translateY, {
        toValue: 0,
        duration: STEP_FADE_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [loaderFade]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const studyPreferencesSnapshot = {
          tone: studyPrefs.tone,
          length: studyPrefs.length,
          highlightKeyElements: studyPrefs.highlightKeyElements,
          highlightKeyTerms: studyPrefs.highlightKeyTerms,
          highlightDefinitions: studyPrefs.highlightDefinitions,
          highlightNumbersDates: studyPrefs.highlightNumbersDates,
        };
        const notes = await generateNotesFromImage(route.params.imageUri, studyPreferencesSnapshot);
        if (!mounted) return;

        const item = {
          id: `${Date.now()}`,
          createdAt: new Date().toISOString(),
          imageUri: route.params.imageUri,
          bookId: activeBook?.id,
          book: activeBook?.title,
          notes,
          studyPreferences: studyPreferencesSnapshot,
        };

        addScan(item);
        recordSuccessfulScan();
        navigation.replace("Results", { item });
      } catch (e) {
        if (!mounted) return;
        const message = e instanceof Error ? e.message : "Failed to generate notes.";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [
    addScan,
    navigation,
    recordSuccessfulScan,
    route.params.imageUri,
    activeBook,
    studyPrefs.tone,
    studyPrefs.length,
    studyPrefs.highlightKeyElements,
    studyPrefs.highlightKeyTerms,
    studyPrefs.highlightDefinitions,
    studyPrefs.highlightNumbersDates,
  ]);

  useEffect(() => {
    if (!loading) return;

    let cancelled = false;

    const afterCommit = () => delay(0);

    const run = async () => {
      layoutPendingRef.current = false;
      layoutResolveRef.current = null;
      progressFill.setValue(0);

      animateStepFadeIn(0);
      animateStepFadeIn(1);
      animateStepFadeIn(2);
      await afterCommit();
      await waitForLayoutReady();
      if (cancelled) return;
      await Promise.all([runTextShimmerSweep(), animateProgressTo(0.25)]);
      if (cancelled) return;
      hapticStepCompleted();

      setRowPhases(["solid", "shimmer", "pending"]);
      await afterCommit();
      await waitForLayoutReady();
      if (cancelled) return;
      await Promise.all([runTextShimmerSweep(), animateProgressTo(0.5)]);
      if (cancelled) return;
      hapticStepCompleted();

      setRowPhases(["solid", "solid", "shimmer"]);
      await afterCommit();
      await waitForLayoutReady();
      if (cancelled) return;
      await Promise.all([runTextShimmerSweep(), animateProgressTo(0.75)]);
      if (cancelled) return;
      hapticStepCompleted();

      setRowPhases(["solid", "solid", "solid"]);

      setLoaderLinePhase("shimmer");
      animateLoaderFadeIn();
      await afterCommit();
      await waitForLayoutReady();
      if (cancelled) return;
      await Promise.all([runTextShimmerSweep(), animateProgressTo(1)]);
      if (cancelled) return;
      setLoaderLinePhase("solid");
    };

    void run();
    return () => {
      cancelled = true;
      layoutPendingRef.current = false;
      const r = layoutResolveRef.current;
      layoutResolveRef.current = null;
      r?.();
    };
  }, [loading, animateLoaderFadeIn, animateProgressTo, animateStepFadeIn, progressFill, runTextShimmerSweep, waitForLayoutReady]);

  /** Dark mode: brighter than default slate body for stronger contrast on cards. */
  const processingBodyColor = darkMode ? "#ffffff" : lightColors.textPrimary;
  const stepMutedColor = darkMode ? darkColors.textSecondary : lightColors.textSecondary;

  const tw = Math.max(progressTrackWidth, 1);
  const progressFillWidth = progressFill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tw],
  });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <HeaderText
        title="Processing"
        subtitle="The AI is extracting text and generating study notes."
      />

      {loading ? (
        <LottieView
          source={require("../../assets/ocrscan.json")}
          autoPlay
          loop
          style={styles.ocrScanLottie}
        />
      ) : null}

      <View style={[styles.processingCard, darkMode && styles.processingCardDark]}>
        {PROCESSING_STEPS.map((label, index) => {
          const phase = rowPhases[index];
          const activeLabel = `${label} (active)`;
          return (
            <Animated.View
              key={label}
              style={{
                opacity: stepFade[index].opacity,
                transform: [{ translateY: stepFade[index].translateY }],
              }}
            >
              <View style={styles.stepRow}>
                <View style={styles.stepGlyphCol}>
                  {phase === "solid" ? (
                    <Ionicons name="checkmark" size={20} color={accentColor} accessibilityLabel="Done" />
                  ) : null}
                  {phase === "shimmer" ? (
                    <View style={styles.stepActiveGlyph}>
                      <Text style={[styles.stepArrow, { color: accentColor }]}>→</Text>
                      <ActivePulseDot color={accentColor} />
                    </View>
                  ) : null}
                  {phase === "pending" ? (
                    <Text style={[styles.stepPendingCircle, { color: stepMutedColor }]} accessibilityLabel="Pending">
                      ○
                    </Text>
                  ) : null}
                </View>
                <View style={styles.stepBody}>
                  {phase === "shimmer" ? (
                    <AccentShimmerText
                      text={activeLabel}
                      textStyle={[
                        styles.processingStep,
                        styles.processingStepMono,
                        { color: processingBodyColor },
                      ]}
                      accentColor={accentColor}
                      restColor={processingBodyColor}
                      restTrackAlpha={darkMode ? 0.2 : 0.12}
                      restShoulderAlpha={darkMode ? 0.45 : 0.35}
                      shimmerPhase={textShimmerDriver}
                      onLayoutReady={handleAccentLayoutReady}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.processingStep,
                        styles.processingStepMono,
                        { color: stepMutedColor },
                      ]}
                    >
                      {label}
                    </Text>
                  )}
                </View>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {loading && (
        <View style={[styles.loaderWrap, darkMode && styles.loaderWrapDark]}>
          <View
            style={[styles.progressTrack, darkMode && styles.progressTrackDark]}
            onLayout={(e) => setProgressTrackWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressFillWidth,
                },
              ]}
            >
              <LinearGradient
                colors={accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          {loaderLinePhase !== "hidden" ? (
            <Animated.View
              style={{
                opacity: loaderFade.opacity,
                transform: [{ translateY: loaderFade.translateY }],
              }}
            >
              {loaderLinePhase === "shimmer" ? (
                <AccentShimmerText
                  text="Generating notes..."
                  textStyle={[styles.loaderText, { color: processingBodyColor }]}
                  accentColor={accentColor}
                  restColor={processingBodyColor}
                  restTrackAlpha={darkMode ? 0.2 : 0.12}
                  restShoulderAlpha={darkMode ? 0.45 : 0.35}
                  shimmerPhase={textShimmerDriver}
                  onLayoutReady={handleAccentLayoutReady}
                />
              ) : (
                <Text style={[styles.loaderText, { color: processingBodyColor }]}>Generating notes...</Text>
              )}
            </Animated.View>
          ) : null}
        </View>
      )}

      {error && (
        <View style={[styles.errorBox, darkMode && styles.errorBoxDark]}>
          <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={() =>
              navigation.replace("Processing", {
                imageUri: route.params.imageUri,
              })
            }
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
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
  processingCard: {
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  processingCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  processingStep: {
    fontSize: 15,
  },
  processingStepMono: {
    fontFamily: STEP_MONO,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepGlyphCol: {
    width: 28,
    alignItems: "center",
    paddingTop: 1,
  },
  stepActiveGlyph: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  stepArrow: {
    fontSize: 16,
    fontFamily: STEP_MONO,
    fontWeight: "600",
  },
  stepPendingCircle: {
    fontSize: 15,
    fontFamily: STEP_MONO,
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  loaderWrap: {
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 14,
    padding: 14,
  },
  loaderWrapDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: lightColors.border,
    overflow: "hidden",
  },
  progressTrackDark: {
    backgroundColor: "#2a2a2a",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: "hidden",
  },
  loaderText: {
    fontWeight: "600",
  },
  ocrScanLottie: {
    width: 300,
    height: 300,
    alignSelf: "center",
    marginTop:-30,
  },
  errorBox: {
    marginTop: 20,
    backgroundColor: lightColors.dangerBg,
    borderColor: lightColors.dangerBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  errorBoxDark: {
    backgroundColor: darkColors.dangerBg,
    borderColor: darkColors.dangerBorder,
  },
  errorText: {
    color: lightColors.dangerText,
  },
  errorTextDark: {
    color: darkColors.dangerText,
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
  },
});
