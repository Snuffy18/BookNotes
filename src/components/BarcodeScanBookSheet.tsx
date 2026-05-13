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

export type BarcodeSheetPhase = "scanning" | "lookingUp" | "found" | "error";

const CROSSFADE_MS = 150;
const VIEWFINDER_HEIGHT = 180;

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
};

function BarcodeViewfinderCorners() {
  const c = {
    position: "absolute" as const,
    width: 16,
    height: 16,
    borderColor: "rgba(255,255,255,0.7)",
  };
  const inset = 10;
  return (
    <>
      <View
        style={{ ...c, left: inset, top: inset, borderLeftWidth: 2, borderTopWidth: 2 }}
      />
      <View
        style={{ ...c, right: inset, top: inset, borderRightWidth: 2, borderTopWidth: 2 }}
      />
      <View
        style={{ ...c, left: inset, bottom: inset, borderLeftWidth: 2, borderBottomWidth: 2 }}
      />
      <View
        style={{ ...c, right: inset, bottom: inset, borderRightWidth: 2, borderBottomWidth: 2 }}
      />
    </>
  );
}

const SCAN_BLUE = "#60a5fa";
const SCAN_TRAIL_HEIGHT = 56;

function AnimatedScanLine() {
  const progress = useRef(new Animated.Value(0)).current;
  const scanInset = 10;
  const lineHeight = 2;
  const travel = VIEWFINDER_HEIGHT - scanInset * 2 - lineHeight;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [scanInset, scanInset + travel],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.scanLineGroup, { transform: [{ translateY }] }]}
    >
      <LinearGradient
        colors={[
          "rgba(96,165,250,0)",
          "rgba(96,165,250,0.04)",
          "rgba(96,165,250,0.14)",
          "rgba(96,165,250,0.32)",
        ]}
        locations={[0, 0.35, 0.72, 1]}
        style={styles.scanTrail}
      />
      <View style={styles.scanLine} />
      <View style={styles.scanLineGlow} />
    </Animated.View>
  );
}

function LookupSpinner() {
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
        borderColor: "rgba(255,255,255,0.1)",
        borderTopColor: "#60a5fa",
        transform: [{ rotate }],
      }}
    />
  );
}

function DarkPanel({ children }: { children: ReactNode }) {
  return <View style={styles.darkPanel}>{children}</View>;
}

function ScanningView({
  manualIsbnOpen,
  manualIsbnDraft,
  onManualIsbnDraftChange,
  onBarcodeScanned,
  onOpenManualIsbn,
  onSubmitManualIsbn,
}: Pick<
  BarcodeScanBookSheetContentProps,
  | "manualIsbnOpen"
  | "manualIsbnDraft"
  | "onManualIsbnDraftChange"
  | "onBarcodeScanned"
  | "onOpenManualIsbn"
  | "onSubmitManualIsbn"
>) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
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
      <Text style={styles.headerTitle}>Scan book barcode</Text>
      <Text style={styles.headerSubtitle}>Point at the barcode on the back cover</Text>

      {manualIsbnOpen ? (
        <View style={styles.manualIsbnSection}>
          <Text style={styles.manualIsbnLabel}>ISBN</Text>
          <TextInput
            style={styles.manualIsbnInput}
            value={manualIsbnDraft}
            onChangeText={onManualIsbnDraftChange}
            placeholder="9780143127741"
            placeholderTextColor="rgba(255,255,255,0.25)"
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
      <View style={styles.viewfinderWrap}>
        {!permission?.granted ? (
          <DarkPanel>
            <View style={styles.cameraGate}>
              <Text style={styles.cameraGateText}>Allow camera access to scan barcodes</Text>
              <TouchableOpacity
                style={styles.cameraGateBtn}
                onPress={() => void requestPermission()}
                activeOpacity={0.85}
              >
                <Text style={styles.cameraGateBtnText}>Allow camera</Text>
              </TouchableOpacity>
            </View>
          </DarkPanel>
        ) : (
          <View style={styles.viewfinderCameraSlot}>
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
              <View style={styles.cameraPlaceholder} pointerEvents="none">
                <Ionicons name="barcode-outline" size={28} color="rgba(255,255,255,0.35)" />
              </View>
            ) : null}
            <View style={styles.viewfinderOverlay} pointerEvents="none">
              <BarcodeViewfinderCorners />
              <AnimatedScanLine />
            </View>
          </View>
        )}
      </View>
      )}

      <Pressable
        style={styles.textLinkWrap14}
        onPress={onOpenManualIsbn}
        accessibilityRole="button"
        accessibilityLabel={manualIsbnOpen ? "Back to scanner" : "Enter ISBN manually instead"}
      >
        <Text style={styles.textLink}>
          {manualIsbnOpen ? "Back to scanner" : "Enter ISBN manually instead"}
        </Text>
      </Pressable>
    </>
  );
}

function LookingUpView({
  detectedIsbn,
  onCancelLookup,
}: Pick<BarcodeScanBookSheetContentProps, "detectedIsbn" | "onCancelLookup">) {
  return (
    <>
      <Text style={styles.headerTitle}>Looking up book...</Text>
      <Text style={styles.headerSubtitle}>
        {detectedIsbn ? `ISBN ${formatIsbnDisplay(detectedIsbn)}` : "ISBN"}
      </Text>

      <View style={styles.viewfinderWrap}>
        <DarkPanel>
          <View style={styles.lookupInner}>
            <LookupSpinner />
            <Text style={styles.lookupPrimary}>Fetching book details</Text>
            <Text style={styles.lookupSecondary}>Open Library · cover image</Text>
          </View>
        </DarkPanel>
      </View>

      <Pressable
        style={styles.textLinkWrap14}
        onPress={onCancelLookup}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={styles.textLink}>Cancel</Text>
      </Pressable>
    </>
  );
}

function FoundView({
  bookResult,
  onAddToLibrary,
  onScanAgain,
}: Pick<BarcodeScanBookSheetContentProps, "bookResult" | "onAddToLibrary" | "onScanAgain">) {
  if (!bookResult) return null;

  const chips: string[] = [];
  if (bookResult.pageCount != null) chips.push(`${bookResult.pageCount} pages`);
  if (bookResult.publishYear) chips.push(bookResult.publishYear);
  if (bookResult.subject) chips.push(bookResult.subject);

  return (
    <>
      <Text style={styles.headerTitle}>Book found</Text>
      <Text style={styles.headerSubtitle}>Confirm to add to your library</Text>

      <View style={styles.bookCard}>
        {bookResult.coverUrl ? (
          <Image source={{ uri: bookResult.coverUrl }} style={styles.bookCover} />
        ) : (
          <View style={styles.bookCoverPlaceholder}>
            <Ionicons name="book-outline" size={18} color="#60a5fa" />
          </View>
        )}
        <View style={styles.bookMeta}>
          <Text style={styles.bookTitle} numberOfLines={3}>
            {bookResult.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={2}>
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
        style={styles.primaryBtn}
        onPress={onAddToLibrary}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Add to library"
      >
        <Ionicons name="add" size={18} color="#111111" />
        <Text style={styles.primaryBtnText}>Add to library</Text>
      </TouchableOpacity>

      <Pressable
        style={styles.textLinkWrap8}
        onPress={onScanAgain}
        accessibilityRole="button"
        accessibilityLabel="Scan again"
      >
        <Text style={styles.textLink}>Scan again</Text>
      </Pressable>
    </>
  );
}

function ErrorView({
  onTryAgain,
  onEnterManually,
}: Pick<BarcodeScanBookSheetContentProps, "onTryAgain" | "onEnterManually">) {
  return (
    <>
      <Text style={styles.headerTitle}>Book not found</Text>
      <Text style={styles.headerSubtitle}>Try scanning again or enter details manually</Text>

      <View style={styles.viewfinderWrap}>
        <DarkPanel>
          <View style={styles.errorInner}>
            <Ionicons name="warning-outline" size={24} color="rgba(255,255,255,0.2)" />
            <Text style={styles.errorText}>Could not find this ISBN</Text>
          </View>
        </DarkPanel>
      </View>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={onTryAgain}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.primaryBtnText}>Try again</Text>
      </TouchableOpacity>

      <Pressable
        style={styles.textLinkWrap8}
        onPress={onEnterManually}
        accessibilityRole="button"
        accessibilityLabel="Enter manually"
      >
        <Text style={styles.textLink}>Enter manually</Text>
      </Pressable>
    </>
  );
}

export function BarcodeScanBookSheetContent(props: BarcodeScanBookSheetContentProps) {
  const { phase } = props;

  return (
    <View>
      {phase === "scanning" ? <ScanningView {...props} /> : null}
      {phase === "lookingUp" ? <LookingUpView {...props} /> : null}
      {phase === "found" ? <FoundView {...props} /> : null}
      {phase === "error" ? <ErrorView {...props} /> : null}
    </View>
  );
}

export function useBarcodeSheetContentHeight(phase: BarcodeSheetPhase, manualIsbnOpen: boolean) {
  return useMemo(() => {
    const header = 16 + 4 + 12 + 16;
    const viewfinder = VIEWFINDER_HEIGHT + 16;
    const link14 = 14 + 12 + 8;
    const link8 = 8 + 12 + 8;
    const primaryBtn = 14 + 14 + 14 + 14;
    const bookCard = 16 + 12 + 12 + 56 + 12;

    switch (phase) {
      case "scanning":
        return header + (manualIsbnOpen ? 132 + 16 : viewfinder) + link14;
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
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 0,
  },
  viewfinderWrap: {
    marginTop: 16,
    height: VIEWFINDER_HEIGHT,
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
  viewfinderCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scanLineGroup: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "stretch",
  },
  scanTrail: {
    height: SCAN_TRAIL_HEIGHT,
    width: "100%",
  },
  scanLine: {
    height: 2,
    width: "100%",
    backgroundColor: SCAN_BLUE,
    borderRadius: 1,
  },
  scanLineGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 8,
    backgroundColor: "rgba(96,165,250,0.22)",
    shadowColor: SCAN_BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,10,0.92)",
  },
  darkPanel: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
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
  cameraGateBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cameraGateBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
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
  lookupSecondary: {
    fontSize: 10,
    fontWeight: "400",
    color: "rgba(255,255,255,0.25)",
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
  bookAuthor: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 13,
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
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
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
});

export { CROSSFADE_MS, VIEWFINDER_HEIGHT };
