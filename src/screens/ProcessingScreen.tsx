import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HeaderText } from "../components/HeaderText";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { generateNotesFromImage } from "../services/ai";
import { useStreak } from "../context/StreakContext";
import { useScanContext } from "../context/ScanContext";

type Props = NativeStackScreenProps<ScanStackParamList, "Processing">;

export function ProcessingScreen({ navigation, route }: Props) {
  const { accentColor } = useAppSettings();
  const { addScan, activeBook } = useScanContext();
  const { recordSuccessfulScan } = useStreak();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const notes = await generateNotesFromImage(route.params.imageUri);
        if (!mounted) return;

        const item = {
          id: `${Date.now()}`,
          createdAt: new Date().toISOString(),
          imageUri: route.params.imageUri,
          bookId: activeBook?.id,
          book: activeBook?.title,
          notes,
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
  }, [addScan, navigation, recordSuccessfulScan, route.params.imageUri, activeBook]);

  useEffect(() => {
    if (!loading) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [loading, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["15%", "90%"],
  });

  const pulseOpacity = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <HeaderText
        title="Processing"
        subtitle="The AI is extracting text and generating study notes."
      />

      <View style={styles.processingCard}>
        <Text style={styles.processingStep}>1. OCR extracting text</Text>
        <Text style={styles.processingStep}>2. Understanding content</Text>
        <Text style={styles.processingStep}>3. Building summary + key ideas</Text>
      </View>

      {loading && (
        <View style={styles.loaderWrap}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth, opacity: pulseOpacity, backgroundColor: accentColor },
              ]}
            />
          </View>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={styles.loaderText}>Generating notes...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={() => navigation.replace("Processing", { imageUri: route.params.imageUri })}
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
    backgroundColor: "#f8fafc",
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  processingCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  processingStep: {
    color: "#0f172a",
    fontSize: 15,
  },
  loaderWrap: {
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  loaderText: {
    color: "#334155",
    fontWeight: "600",
  },
  errorBox: {
    marginTop: 20,
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  errorText: {
    color: "#991b1b",
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
  },
});
