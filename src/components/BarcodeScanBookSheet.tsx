import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { OpenLibraryBookResult } from "../services/openLibrary";
import { formatIsbnDisplay } from "../services/openLibrary";
import { useAppSettings } from "../context/AppSettingsContext";
import { hexWithAlpha } from "../theme/colorUtils";
import { lightColors } from "../theme/colors";

export type BarcodeSheetPhase = "scanning" | "lookingUp" | "found" | "error";

const CROSSFADE_MS = 150;
const VIEWFINDER_HEIGHT = 200;
const BRACKET_ARM = 20;
const BRACKET_STROKE = 3;
const BRACKET_COLOR_DARK = "rgba(255,255,255,0.85)";
const BRACKET_COLOR_LIGHT = "rgba(15,23,42,0.75)";

type BarcodeScanBookSheetContentProps = {
  phase: BarcodeSheetPhase;
  detectedIsbn: string | null;
  bookResult: OpenLibraryBookResult | null;
  manualIsbnOpen: boolean;
  manualIsbnDraft: string;
  onManualIsbnDraftChange: (value: string) => void;
  onBarcodeScanned: (data: string) => void;
  onOpenManualIsbn: () => void;
  onSubmitManualIsbn: () => void;
  onCancelLookup: () => void;
  onAddToLibrary: () => void;
  onScanAgain: () => void;
  onTryAgain: () => void;
  onEnterManually: () => void;
  onClose: () => void;
};

function BarcodeViewfinderCorners({
  width,
  height,
  darkMode,
}: {
  width: number;
  height: number;
  darkMode: boolean;
}) {
  if (width <= 0 || height <= 0) return null;

  const frameW = width * 0.8;
  const frameH = height * 0.5;
  const left = (width - frameW) / 2;
  const top = (height - frameH) / 2;
  const corner = {
    position: "absolute" as const,
    width: BRACKET_ARM,
    height: BRACKET_ARM,
    borderColor: darkMode ? BRACKET_COLOR_DARK : BRACKET_COLOR_LIGHT,
  };

  return (
    <>
      <View
        style={{
          ...corner,
          left,
          top,
          borderLeftWidth: BRACKET_STROKE,
          borderTopWidth: BRACKET_STROKE,
        }}
      />
      <View
        style={{
          ...corner,
          left: left + frameW - BRACKET_ARM,
          top,
          borderRightWidth: BRACKET_STROKE,
          borderTopWidth: BRACKET_STROKE,
        }}
      />
      <View
        style={{
          ...corner,
          left,
          top: top + frameH - BRACKET_ARM,
          borderLeftWidth: BRACKET_STROKE,
          borderBottomWidth: BRACKET_STROKE,
        }}
      />
      <View
        style={{
          ...corner,
          left: left + frameW - BRACKET_ARM,
          top: top + frameH - BRACKET_ARM,
          borderRightWidth: BRACKET_STROKE,
          borderBottomWidth: BRACKET_STROKE,
        }}
      />
    </>
  );
}

const SCAN_TRAIL_HEIGHT = 56;

function AnimatedScanLine({
  viewfinderHeight,
  accentColor,
}: {
  viewfinderHeight: number;
  accentColor: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const trailOnTop = useRef(new Animated.Value(1)).current;
  const lineHeight = 2;
  const travel = Math.max(0, viewfinderHeight - lineHeight);
  const trailColors = useMemo<readonly [string, string, ...string[]]>(
    () => [
      hexWithAlpha(accentColor, 0),
      hexWithAlpha(accentColor, 0.04),
      hexWithAlpha(accentColor, 0.14),
      hexWithAlpha(accentColor, 0.32),
    ],
    [accentColor]
  );
  const trailColorsReversed = useMemo<readonly [string, string, ...string[]]>(
    () => [...trailColors].reverse() as [string, string, ...string[]],
    [trailColors]
  );
  const trailBelowOpacity = useMemo(
    () =>
      trailOnTop.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [trailOnTop]
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(trailOnTop, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(trailOnTop, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, trailOnTop]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travel],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.scanLineAnchor, { transform: [{ translateY }] }]}
    >
      <Animated.View style={[styles.scanTrailAbove, { opacity: trailOnTop }]}>
        <LinearGradient
          colors={trailColors}
          locations={[0, 0.35, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.scanTrailBelow, { opacity: trailBelowOpacity }]}>
        <LinearGradient
          colors={trailColorsReversed}
          locations={[0, 0.35, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={[styles.scanLine, { backgroundColor: accentColor }]} />
      <View
        style={[
          styles.scanLineGlow,
          {
            backgroundColor: hexWithAlpha(accentColor, 0.22),
            shadowColor: accentColor,
          },
        ]}
      />
    </Animated.View>
  );
}

function LookupSpinner({ darkMode }: { darkMode: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)",
        borderTopColor: "#60a5fa",
        transform: [{ rotate }],
      }}
    />
  );
}

function Panel({ children, darkMode }: { children: ReactNode; darkMode: boolean }) {
  return <View style={[styles.panel, !darkMode && styles.panelLight]}>{children}</View>;
}

function ScanningView({
  darkMode,
  manualIsbnOpen,
  manualIsbnDraft,
  onManualIsbnDraftChange,
  onBarcodeScanned,
  onOpenManualIsbn,
  onSubmitManualIsbn,
  onClose,
}: {
  darkMode: boolean;
} & Pick<
  BarcodeScanBookSheetContentProps,
  | "manualIsbnOpen"
  | "manualIsbnDraft"
  | "onManualIsbnDraftChange"
  | "onBarcodeScanned"
  | "onOpenManualIsbn"
  | "onSubmitManualIsbn"
  | "onClose"
>) {
  const [permission, requestPermission] = useCameraPermissions();
  const { accentColor } = useAppSettings();
  const [cameraReady, setCameraReady] = useState(false);
  const [viewfinderSize, setViewfinderSize] = useState({ width: 0, height: VIEWFINDER_HEIGHT });
  const scanLockRef = useRef(false);

  const handleBarcode = useCallback(
    (result: { data: string }) => {
      if (scanLockRef.current || manualIsbnOpen) return;
      scanLockRef.current = true;
      onBarcodeScanned(result.data);
    },
    [manualIsbnOpen, onBarcodeScanned]
  );

  useEffect(() => {
    scanLockRef.current = false;
  }, []);

  return (
    <>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, !darkMode && styles.headerTitleLight]}>Scan book barcode</Text>
        <Pressable
          style={[styles.closeButton, !darkMode && styles.closeButtonLight]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close barcode scanner"
        >
          <Ionicons
            name="close"
            size={13}
            color={darkMode ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.5)"}
          />
        </Pressable>
      </View>
      <Text style={[styles.headerSubtitle, !darkMode && styles.headerSubtitleLight]}>
        Point at the barcode on the back cover
      </Text>

      {manualIsbnOpen ? (
        <View style={styles.manualIsbnSection}>
          <Text style={[styles.manualIsbnLabel, !darkMode && styles.manualIsbnLabelLight]}>ISBN</Text>
          <TextInput
            style={[styles.manualIsbnInput, !darkMode && styles.manualIsbnInputLight]}
            value={manualIsbnDraft}
            onChangeText={onManualIsbnDraftChange}
            placeholder="9780143127741"
            placeholderTextColor={darkMode ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.35)"}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={onSubmitManualIsbn}
          />
          <TouchableOpacity
            style={styles.manualIsbnSubmit}
            onPress={onSubmitManualIsbn}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Look up ISBN"
          >
            <Text style={styles.manualIsbnSubmitText}>Look up</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <View style={styles.previewBlock}>
        <View
          style={styles.viewfinderWrap}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setViewfinderSize({ width, height });
          }}
        >
          {!permission?.granted ? (
            <Panel darkMode={darkMode}>
              <View style={styles.cameraGate}>
                <Text style={[styles.cameraGateText, !darkMode && styles.cameraGateTextLight]}>
                  Allow camera access to scan barcodes
                </Text>
                <TouchableOpacity
                  style={[styles.cameraGateBtn, !darkMode && styles.cameraGateBtnLight]}
                  onPress={() => void requestPermission()}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.cameraGateBtnText, !darkMode && styles.cameraGateBtnTextLight]}>
                    Allow camera
                  </Text>
                </TouchableOpacity>
              </View>
            </Panel>
          ) : (
            <View style={[styles.viewfinderCameraSlot, !darkMode && styles.viewfinderCameraSlotLight]}>
              <CameraView
                style={styles.viewfinderCamera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
                }}
                onBarcodeScanned={handleBarcode}
                onCameraReady={() => setCameraReady(true)}
                {...(Platform.OS === "android"
                  ? { ratio: "4:3" as const, videoQuality: "4:3" as const }
                  : {})}
              />
              {!cameraReady ? (
                <View
                  style={[styles.cameraPlaceholder, !darkMode && styles.cameraPlaceholderLight]}
                  pointerEvents="none"
                >
                  <Ionicons
                    name="barcode-outline"
                    size={28}
                    color={darkMode ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.25)"}
                  />
                </View>
              ) : null}
              <View style={styles.viewfinderOverlay} pointerEvents="none">
                <BarcodeViewfinderCorners
                  width={viewfinderSize.width}
                  height={viewfinderSize.height}
                  darkMode={darkMode}
                />
                <AnimatedScanLine viewfinderHeight={viewfinderSize.height} accentColor={accentColor} />
              </View>
            </View>
          )}
        </View>

        <Pressable
          style={styles.manualIsbnLinkWrap}
          onPress={onOpenManualIsbn}
          accessibilityRole="button"
          accessibilityLabel="Enter ISBN manually instead"
        >
          <Text style={[styles.textLink, !darkMode && styles.textLinkLight]}>Enter ISBN manually instead</Text>
        </Pressable>
      </View>
      )}

      {manualIsbnOpen ? (
        <Pressable
          style={styles.manualIsbnBackLinkWrap}
          onPress={onOpenManualIsbn}
          accessibilityRole="button"
          accessibilityLabel="Back to scanner"
        >
          <Text style={[styles.textLink, !darkMode && styles.textLinkLight]}>Back to scanner</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function LookingUpView({
  darkMode,
  detectedIsbn,
  onCancelLookup,
}: { darkMode: boolean } & Pick<BarcodeScanBookSheetContentProps, "detectedIsbn" | "onCancelLookup">) {
  return (
    <>
      <Text style={[styles.headerTitle, !darkMode && styles.headerTitleLight]}>Looking up book...</Text>
      <Text style={[styles.headerSubtitle, !darkMode && styles.headerSubtitleLight]}>
        {detectedIsbn ? `ISBN ${formatIsbnDisplay(detectedIsbn)}` : "ISBN"}
      </Text>

      <View style={styles.viewfinderWrap}>
        <Panel darkMode={darkMode}>
          <View style={styles.lookupInner}>
            <LookupSpinner darkMode={darkMode} />
            <Text style={[styles.lookupPrimary, !darkMode && styles.lookupPrimaryLight]}>
              Fetching book details
            </Text>
            <Text style={[styles.lookupSecondary, !darkMode && styles.lookupSecondaryLight]}>
              Open Library · cover image
            </Text>
          </View>
        </Panel>
      </View>

      <Pressable
        style={styles.textLinkWrap14}
        onPress={onCancelLookup}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={[styles.textLink, !darkMode && styles.textLinkLight]}>Cancel</Text>
      </Pressable>
    </>
  );
}

function FoundView({
  darkMode,
  bookResult,
  onAddToLibrary,
  onScanAgain,
}: { darkMode: boolean } & Pick<
  BarcodeScanBookSheetContentProps,
  "bookResult" | "onAddToLibrary" | "onScanAgain"
>) {
  if (!bookResult) return null;

  const chips: string[] = [];
  if (bookResult.pageCount != null) chips.push(`${bookResult.pageCount} pages`);
  if (bookResult.publishYear) chips.push(bookResult.publishYear);
  if (bookResult.subject) chips.push(bookResult.subject);

  return (
    <>
      <Text style={[styles.headerTitle, !darkMode && styles.headerTitleLight]}>Book found</Text>
      <Text style={[styles.headerSubtitle, !darkMode && styles.headerSubtitleLight]}>
        Confirm to add to your library
      </Text>

      <View style={[styles.bookCard, !darkMode && styles.bookCardLight]}>
        {bookResult.coverUrl ? (
          <Image source={{ uri: bookResult.coverUrl }} style={styles.bookCover} />
        ) : (
          <View style={[styles.bookCoverPlaceholder, !darkMode && styles.bookCoverPlaceholderLight]}>
            <Ionicons name="book-outline" size={18} color="#60a5fa" />
          </View>
        )}
        <View style={styles.bookMeta}>
          <Text style={[styles.bookTitle, !darkMode && styles.bookTitleLight]} numberOfLines={3}>
            {bookResult.title}
          </Text>
          <Text style={[styles.bookAuthor, !darkMode && styles.bookAuthorLight]} numberOfLines={2}>
            {bookResult.author}
          </Text>
          {chips.length > 0 ? (
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <View key={chip} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, !darkMode && styles.primaryBtnLight]}
        onPress={onAddToLibrary}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Add to library"
      >
        <Ionicons name="add" size={18} color={darkMode ? "#111111" : "#ffffff"} />
        <Text style={[styles.primaryBtnText, !darkMode && styles.primaryBtnTextLight]}>Add to library</Text>
      </TouchableOpacity>

      <Pressable
        style={styles.textLinkWrap8}
        onPress={onScanAgain}
        accessibilityRole="button"
        accessibilityLabel="Scan again"
      >
        <Text style={[styles.textLink, !darkMode && styles.textLinkLight]}>Scan again</Text>
      </Pressable>
    </>
  );
}

function ErrorView({
  darkMode,
  onTryAgain,
  onEnterManually,
}: { darkMode: boolean } & Pick<BarcodeScanBookSheetContentProps, "onTryAgain" | "onEnterManually">) {
  return (
    <>
      <Text style={[styles.headerTitle, !darkMode && styles.headerTitleLight]}>Book not found</Text>
      <Text style={[styles.headerSubtitle, !darkMode && styles.headerSubtitleLight]}>
        Try scanning again or enter details manually
      </Text>

      <View style={styles.viewfinderWrap}>
        <Panel darkMode={darkMode}>
          <View style={styles.errorInner}>
            <Ionicons
              name="warning-outline"
              size={24}
              color={darkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)"}
            />
            <Text style={[styles.errorText, !darkMode && styles.errorTextLight]}>Could not find this ISBN</Text>
          </View>
        </Panel>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, !darkMode && styles.primaryBtnLight]}
        onPress={onTryAgain}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={[styles.primaryBtnText, !darkMode && styles.primaryBtnTextLight]}>Try again</Text>
      </TouchableOpacity>

      <Pressable
        style={styles.textLinkWrap8}
        onPress={onEnterManually}
        accessibilityRole="button"
        accessibilityLabel="Enter manually"
      >
        <Text style={[styles.textLink, !darkMode && styles.textLinkLight]}>Enter manually</Text>
      </Pressable>
    </>
  );
}

export function BarcodeScanBookSheetContent(props: BarcodeScanBookSheetContentProps) {
  const { phase } = props;
  const { darkMode } = useAppSettings();

  return (
    <View>
      {phase === "scanning" ? <ScanningView {...props} darkMode={darkMode} /> : null}
      {phase === "lookingUp" ? <LookingUpView {...props} darkMode={darkMode} /> : null}
      {phase === "found" ? <FoundView {...props} darkMode={darkMode} /> : null}
      {phase === "error" ? <ErrorView {...props} darkMode={darkMode} /> : null}
    </View>
  );
}

export function useBarcodeSheetContentHeight(phase: BarcodeSheetPhase, manualIsbnOpen: boolean) {
  return useMemo(() => {
    const header = 28 + 4 + 12 + 16;
    const viewfinder = VIEWFINDER_HEIGHT + 16 + 16 + 12;
    const manualBackLink = 12 + 8;
    const link14 = 14 + 12 + 8;
    const link8 = 8 + 12 + 8;
    const primaryBtn = 14 + 14 + 14 + 14;
    const bookCard = 16 + 12 + 12 + 56 + 12;

    switch (phase) {
      case "scanning":
        return header + (manualIsbnOpen ? 132 + manualBackLink : viewfinder);
      case "lookingUp":
        return header + viewfinder + link14;
      case "found":
        return header + bookCard + primaryBtn + link8;
      case "error":
        return header + viewfinder + primaryBtn + link8;
      default:
        return header + viewfinder + link14;
    }
  }, [phase, manualIsbnOpen]);
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  headerTitleLight: {
    color: lightColors.textPrimary,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  closeButtonLight: {
    backgroundColor: "rgba(15,23,42,0.06)",
    borderColor: "rgba(15,23,42,0.1)",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
  },
  headerSubtitleLight: {
    color: lightColors.textMuted,
  },
  previewBlock: {
    marginTop: 16,
  },
  viewfinderWrap: {
    height: VIEWFINDER_HEIGHT,
    maxHeight: VIEWFINDER_HEIGHT,
    alignSelf: "stretch",
  },
  viewfinderCameraSlot: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  viewfinderCameraSlotLight: {
    borderColor: "rgba(15,23,42,0.1)",
  },
  viewfinderCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  scanLineAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
  },
  scanTrailAbove: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 2,
    height: SCAN_TRAIL_HEIGHT,
    width: "100%",
  },
  scanTrailBelow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 2,
    height: SCAN_TRAIL_HEIGHT,
    width: "100%",
  },
  scanLine: {
    height: 2,
    width: "100%",
    borderRadius: 1,
  },
  scanLineGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,10,0.92)",
  },
  cameraPlaceholderLight: {
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  panel: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  panelLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.1)",
  },
  cameraGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 14,
  },
  cameraGateText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 18,
  },
  cameraGateTextLight: {
    color: lightColors.textMuted,
  },
  cameraGateBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cameraGateBtnLight: {
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  cameraGateBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  cameraGateBtnTextLight: {
    color: lightColors.textPrimary,
  },
  manualIsbnSection: {
    marginTop: 16,
    gap: 10,
  },
  manualIsbnLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  manualIsbnLabelLight: {
    color: lightColors.textMuted,
  },
  manualIsbnInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  manualIsbnInputLight: {
    borderColor: "rgba(15,23,42,0.12)",
    color: lightColors.textPrimary,
    backgroundColor: "rgba(15,23,42,0.04)",
  },
  manualIsbnSubmit: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(96,165,250,0.15)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  manualIsbnSubmitText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#60a5fa",
  },
  lookupInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  lookupPrimary: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
  },
  lookupPrimaryLight: {
    color: lightColors.textMuted,
  },
  lookupSecondary: {
    fontSize: 10,
    fontWeight: "400",
    color: "rgba(255,255,255,0.25)",
  },
  lookupSecondaryLight: {
    color: "rgba(15,23,42,0.35)",
  },
  errorInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  errorTextLight: {
    color: lightColors.textMuted,
  },
  bookCard: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  bookCardLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.1)",
  },
  bookCover: {
    width: 40,
    height: 56,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  bookCoverPlaceholder: {
    width: 40,
    height: 56,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookCoverPlaceholderLight: {
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  bookMeta: {
    flex: 1,
    minWidth: 0,
  },
  bookTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#ffffff",
    lineHeight: 15.6,
  },
  bookTitleLight: {
    color: lightColors.textPrimary,
  },
  bookAuthor: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 13,
  },
  bookAuthorLight: {
    color: lightColors.textMuted,
  },
  chipRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "rgba(59,130,246,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(59,130,246,0.2)",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  chipText: {
    fontSize: 9,
    fontWeight: "500",
    color: "#60a5fa",
  },
  primaryBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignSelf: "stretch",
  },
  primaryBtnLight: {
    backgroundColor: "#111111",
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  primaryBtnTextLight: {
    color: "#ffffff",
  },
  manualIsbnLinkWrap: {
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 4,
  },
  manualIsbnBackLinkWrap: {
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 4,
  },
  textLinkWrap14: {
    marginTop: 14,
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 4,
  },
  textLinkWrap8: {
    marginTop: 8,
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 4,
  },
  textLink: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
  },
  textLinkLight: {
    color: "rgba(15,23,42,0.4)",
  },
});

export { CROSSFADE_MS, VIEWFINDER_HEIGHT };
