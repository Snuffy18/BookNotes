import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanProcessing } from "../context/ScanProcessingContext";
import type { ScanStackParamList } from "../navigation/types";
import {
  SCAN_PROCESSING_STEP_COUNT,
  SCAN_PROCESSING_STEPS,
} from "../processing/scanProcessingSteps";

const LOADING_LOTTIE = require("../../assets/loading.json");
const ERROR_LOTTIE = require("../../assets/error.json");
const CONFETTI_LOTTIE = require("../../assets/confetti2.json");

const LAST_STEP_INDEX = SCAN_PROCESSING_STEP_COUNT - 1;

type Props = {
  darkMode: boolean;
  navigation: NavigationProp<ScanStackParamList>;
  onTakeAnotherPhoto?: () => void;
};

export function ScanProcessingHomeWidget({ darkMode, navigation, onTakeAnotherPhoto }: Props) {
  const { accentColor } = useAppSettings();
  const {
    status,
    activeStepIndex,
    resultItem,
    error,
    dismissedToHome,
    params,
    startProcessing,
    clearJob,
  } = useScanProcessing();
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  if (status === "idle") return null;
  if (status === "running" && !dismissedToHome) return null;
  if (status === "error" && !dismissedToHome) return null;

  const isComplete = status === "complete";
  const isError = status === "error";
  const step = SCAN_PROCESSING_STEPS[Math.min(activeStepIndex, LAST_STEP_INDEX)];
  const isLastStep = !isComplete && !isError && activeStepIndex >= LAST_STEP_INDEX;
  const progressPct = isComplete
    ? 100
    : Math.round(((activeStepIndex + 1) / SCAN_PROCESSING_STEP_COUNT) * 100);

  const onPressIn = () => {
    if (isComplete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    if (isError) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const onPress = () => {
    if (isError) {
      setErrorModalVisible(true);
      return;
    }
    if (!isComplete || !resultItem) return;
    navigation.navigate("ReportDetails", {
      item: resultItem,
      reportNavOrigin: "scan",
    });
    clearJob();
  };

  const onRetry = () => {
    if (!params) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setErrorModalVisible(false);
    startProcessing(params);
  };

  const onTakePhotoAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setErrorModalVisible(false);
    clearJob();
    onTakeAnotherPhoto?.();
  };

  return (
    <>
      <Pressable
        onPressIn={onPressIn}
        onPress={onPress}
        disabled={!isComplete && !isError}
        style={({ pressed }) => [
          styles.card,
          darkMode ? styles.cardDark : styles.cardLight,
          isComplete && (darkMode ? styles.cardCompleteDark : styles.cardCompleteLight),
          isError && (darkMode ? styles.cardErrorDark : styles.cardErrorLight),
          (isComplete || isError) && pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isError
            ? "Processing failed — tap for options"
            : isComplete
              ? "View report — processing complete"
              : `Processing: ${step.label}`
        }
      >
        {isComplete ? (
          <View style={styles.cardConfettiLayer} pointerEvents="none">
            <LottieView
              source={CONFETTI_LOTTIE}
              autoPlay
              loop={false}
              speed={1}
              style={styles.cardConfettiLottie}
            />
          </View>
        ) : null}

        <View style={styles.cardContent}>
        <View
          style={[
            styles.iconWrap,
            isComplete && styles.iconWrapComplete,
            isError && styles.iconWrapError,
            isLastStep && styles.iconWrapLottie,
          ]}
        >
          {isComplete ? (
            <Ionicons name="checkmark" size={18} color="#22c55e" />
          ) : isError ? (
            <Ionicons name="close" size={18} color="#f87171" />
          ) : isLastStep ? (
            <LottieView
              source={LOADING_LOTTIE}
              autoPlay
              loop
              style={styles.loadingLottie}
            />
          ) : (
            <Ionicons name={step.pendingIcon} size={18} color="rgba(255,255,255,0.55)" />
          )}
        </View>

        <View style={styles.textCol}>
          <Text style={[styles.title, darkMode && styles.titleDark]}>
            {isComplete ? "Report ready" : isError ? "Couldn't process image" : "Extracting ideas"}
          </Text>
          <Text style={[styles.subtitle, darkMode && styles.subtitleDark]} numberOfLines={2}>
            {isComplete
              ? "Tap to view your new page report"
              : isError
                ? error ?? "Something went wrong. Tap for options."
                : step.activeSublabel}
          </Text>
          {!isComplete && !isError ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          ) : null}
          {!isComplete && !isError ? (
            <Text style={[styles.stepCaption, darkMode && styles.stepCaptionDark]}>
              Step {activeStepIndex + 1} of {SCAN_PROCESSING_STEP_COUNT} · {step.label}
            </Text>
          ) : null}
        </View>

        {isComplete || isError ? (
          <Ionicons
            name={isError ? "chevron-forward" : "chevron-forward"}
            size={16}
            color={darkMode ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.35)"}
          />
        ) : null}
        </View>
      </Pressable>

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setErrorModalVisible(false)}>
          <Pressable
            style={[styles.modalSheet, darkMode && styles.modalSheetDark]}
            onPress={(event) => event.stopPropagation()}
          >
            <LottieView source={ERROR_LOTTIE} autoPlay loop={false} style={styles.errorLottie} />

            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
              Couldn't process image
            </Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              {error ?? "We couldn't analyze this page. You can try again with the same photo or take a new one."}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: accentColor }]}
                onPress={onTakePhotoAgain}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Take another photo"
              >
                <Text style={styles.modalPrimaryBtnText}>Take another photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, darkMode && styles.modalSecondaryBtnDark]}
                onPress={onRetry}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <Text style={[styles.modalSecondaryBtnText, darkMode && styles.modalSecondaryBtnTextDark]}>
                  Try again
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 0.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: "hidden",
    position: "relative",
  },
  cardConfettiLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  cardConfettiLottie: {
    width: "400%",
    height: "520%",
    transform: [{ rotate: "180deg" }],
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 1,
  },
  cardLight: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderColor: "rgba(0,0,0,0.1)",
  },
  cardDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardCompleteLight: {
    backgroundColor: "rgba(34,197,94,0.06)",
    borderColor: "rgba(34,197,94,0.2)",
  },
  cardCompleteDark: {
    backgroundColor: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.22)",
  },
  cardErrorLight: {
    backgroundColor: "rgba(239,68,68,0.06)",
    borderColor: "rgba(239,68,68,0.18)",
  },
  cardErrorDark: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.22)",
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
    overflow: "hidden",
  },
  iconWrapLottie: {
    backgroundColor: "rgba(96,165,250,0.12)",
  },
  iconWrapComplete: {
    backgroundColor: "rgba(34,197,94,0.14)",
  },
  iconWrapError: {
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  loadingLottie: {
    width: 32,
    height: 32,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  titleDark: {
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(15,23,42,0.55)",
    lineHeight: 17,
  },
  subtitleDark: {
    color: "rgba(255,255,255,0.45)",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#60a5fa",
  },
  stepCaption: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(15,23,42,0.4)",
    marginTop: 2,
  },
  stepCaptionDark: {
    color: "rgba(255,255,255,0.35)",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalSheet: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
    gap: 12,
    alignItems: "center",
  },
  modalSheetDark: {
    backgroundColor: "#1a1a1a",
  },
  errorLottie: {
    width: 120,
    height: 120,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  modalTitleDark: {
    color: "#ffffff",
  },
  modalMessage: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(15,23,42,0.65)",
    lineHeight: 20,
    textAlign: "center",
  },
  modalMessageDark: {
    color: "rgba(255,255,255,0.55)",
  },
  modalActions: {
    width: "100%",
    gap: 8,
    marginTop: 4,
  },
  modalPrimaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  modalPrimaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  modalSecondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  modalSecondaryBtnDark: {
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalSecondaryBtnText: {
    color: "rgba(15,23,42,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  modalSecondaryBtnTextDark: {
    color: "rgba(255,255,255,0.85)",
  },
});
