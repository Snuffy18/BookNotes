import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageScanSheetFrameCorners } from "../components/PageScanSheetFrameCorners";
import { extractBookMetadataFromImage } from "../services/ai";
import { addBookSheetActions } from "./addBookSheetActions";
import { CAMERA_PICTURE_OPTIONS } from "../utils/cameraCapture";
import { useScanContext } from "./ScanContext";

type AddBookSheetContextValue = {
  isOpen: boolean;
  isExtracting: boolean;
  openAddBookSheet: () => void;
  closeAddBookSheet: () => void;
  /** Gallery picker without opening the sheet (Library + long-press shortcut). */
  pickBookCoverFromGallery: () => Promise<void>;
};

const AddBookSheetContext = createContext<AddBookSheetContextValue | undefined>(undefined);

export function AddBookSheetProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { addOrActivateBook, isCoverProcessing, setIsCoverProcessing } = useScanContext();
  const [permission, requestPermission] = useCameraPermissions();

  const addBookSheetHideY = useMemo(() => Math.round(windowHeight * 0.55) + 80, [windowHeight]);
  const addBookSheetY = useRef(new Animated.Value(0)).current;
  const addBookBackdropOp = useRef(new Animated.Value(0)).current;
  const addBookCameraRef = useRef<CameraView | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [addBookSheetCameraReady, setAddBookSheetCameraReady] = useState(false);
  const [isGalleryOpening, setIsGalleryOpening] = useState(false);

  const addBookLivePreviewHeight = useMemo(() => {
    const sheetChrome = 8 + 14 + 24 + 24 + 12 + 52 + 26 + 26 + insets.bottom;
    const maxH = Math.round(windowHeight * 0.9) - sheetChrome;
    return Math.max(300, Math.min(maxH, Math.round(windowHeight * 0.58)));
  }, [windowHeight, insets.bottom]);

  const closeAddBookSheetAnimated = useCallback(() => {
    Animated.parallel([
      Animated.timing(addBookSheetY, {
        toValue: addBookSheetHideY,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(addBookBackdropOp, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setIsOpen(false);
    });
  }, [addBookBackdropOp, addBookSheetHideY, addBookSheetY]);

  const openAddBookSheet = useCallback(() => {
    setExtractError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsOpen(true);
  }, []);

  const closeAddBookSheet = useCallback(() => {
    if (isExtracting || isCoverProcessing) return;
    closeAddBookSheetAnimated();
  }, [closeAddBookSheetAnimated, isCoverProcessing, isExtracting]);

  useEffect(() => {
    addBookSheetActions.open = openAddBookSheet;
    return () => {
      if (addBookSheetActions.open === openAddBookSheet) {
        addBookSheetActions.open = null;
      }
    };
  }, [openAddBookSheet]);

  useEffect(() => {
    if (!isOpen) {
      addBookSheetY.setValue(addBookSheetHideY);
      addBookBackdropOp.setValue(0);
      return;
    }
    addBookSheetY.setValue(addBookSheetHideY);
    addBookBackdropOp.setValue(0);
    Animated.parallel([
      Animated.spring(addBookSheetY, {
        toValue: 0,
        friction: 9,
        tension: 64,
        useNativeDriver: true,
      }),
      Animated.timing(addBookBackdropOp, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, addBookBackdropOp, addBookSheetHideY, addBookSheetY]);

  useEffect(() => {
    if (!isOpen) {
      setAddBookSheetCameraReady(false);
      return;
    }
    setAddBookSheetCameraReady(false);
    void requestPermission();
  }, [isOpen, requestPermission]);

  useEffect(() => {
    if (!isOpen || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isExtracting || isCoverProcessing) return false;
      closeAddBookSheetAnimated();
      return true;
    });
    return () => sub.remove();
  }, [closeAddBookSheetAnimated, isCoverProcessing, isExtracting, isOpen]);

  const processBookCover = useCallback(
    async (coverUri: string) => {
      setExtractError(null);
      setIsCoverProcessing(true);
      setIsExtracting(true);
      try {
        const metadata = await extractBookMetadataFromImage(coverUri);
        addOrActivateBook({
          title: metadata.title,
          author: metadata.author,
          coverUri,
        });
        closeAddBookSheetAnimated();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to extract title and author.";
        setExtractError(message);
      } finally {
        setIsCoverProcessing(false);
        setIsExtracting(false);
      }
    },
    [addOrActivateBook, closeAddBookSheetAnimated, setIsCoverProcessing]
  );

  const onCaptureBookFromSheet = useCallback(async () => {
    if (isExtracting || !permission?.granted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const photo = await addBookCameraRef.current?.takePictureAsync(CAMERA_PICTURE_OPTIONS);
    if (!photo?.uri) return;
    await processBookCover(photo.uri);
  }, [isExtracting, permission?.granted, processBookCover]);

  const pickBookCoverFromGallery = useCallback(async () => {
    if (isExtracting || isGalleryOpening) return;
    setIsGalleryOpening(true);
    try {
      const libPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPermission.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.9,
      });
      if (result.canceled) return;

      await processBookCover(result.assets[0].uri);
    } finally {
      setIsGalleryOpening(false);
    }
  }, [isExtracting, isGalleryOpening, processBookCover]);

  const addBookSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder(_, g) {
          if (isExtracting || isCoverProcessing) return false;
          return g.dy > 12 && g.dy > Math.abs(g.dx) * 0.65;
        },
        onPanResponderGrant: () => {
          addBookSheetY.stopAnimation();
          addBookBackdropOp.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          const y = Math.max(0, Math.min(g.dy, addBookSheetHideY));
          addBookSheetY.setValue(y);
          const hide = Math.max(addBookSheetHideY, 1);
          addBookBackdropOp.setValue(Math.max(0, 1 - y / hide));
        },
        onPanResponderRelease: (_, g) => {
          const y = Math.max(0, Math.min(g.dy, addBookSheetHideY));
          const threshold = Math.min(120, Math.max(72, addBookSheetHideY * 0.22));
          if (y > threshold || g.vy > 0.85) {
            closeAddBookSheetAnimated();
          } else {
            Animated.parallel([
              Animated.spring(addBookSheetY, {
                toValue: 0,
                friction: 9,
                tension: 64,
                useNativeDriver: true,
              }),
              Animated.timing(addBookBackdropOp, {
                toValue: 1,
                duration: 240,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [
      addBookBackdropOp,
      addBookSheetHideY,
      addBookSheetY,
      closeAddBookSheetAnimated,
      isCoverProcessing,
      isExtracting,
    ]
  );

  const value = useMemo(
    () => ({
      isOpen,
      isExtracting,
      openAddBookSheet,
      closeAddBookSheet,
      pickBookCoverFromGallery,
    }),
    [closeAddBookSheet, isExtracting, isOpen, openAddBookSheet, pickBookCoverFromGallery]
  );

  return (
    <AddBookSheetContext.Provider value={value}>
      {children}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeAddBookSheet}
      >
        <View style={styles.addBookSheetRoot}>
          <Animated.View
            pointerEvents="box-none"
            style={[styles.addBookSheetDim, { opacity: addBookBackdropOp }]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeAddBookSheet}
              accessibilityRole="button"
              accessibilityLabel="Close add book"
            />
          </Animated.View>
          <Animated.View
            {...addBookSheetPanResponder.panHandlers}
            style={[
              styles.addBookSheetPanel,
              { paddingBottom: insets.bottom, transform: [{ translateY: addBookSheetY }] },
            ]}
          >
            <View style={styles.addBookSheetGrabber} />
            <Text style={styles.addBookSheetTitle}>Add A Book</Text>
            <Text style={[styles.addBookSheetSubtitle, styles.addBookSheetSubtitleMuted]}>
              Point your camera at the front cover. You can crop before we read the title.
            </Text>
            {extractError ? <Text style={styles.addBookSheetError}>{extractError}</Text> : null}
            <View
              style={[
                styles.addBookPreviewWrap,
                styles.addBookPreviewWrapSized,
                { height: addBookLivePreviewHeight },
              ]}
            >
              {!permission?.granted ? (
                <View style={styles.addBookCameraGate}>
                  <Text style={styles.addBookCameraGateText}>Allow camera access to capture a cover</Text>
                  <TouchableOpacity
                    style={styles.addBookCameraGateBtn}
                    onPress={() => void requestPermission()}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Allow camera"
                  >
                    <Text style={styles.addBookCameraGateBtnText}>Allow camera</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.addBookPreviewCameraSlot}>
                    <CameraView
                      ref={addBookCameraRef}
                      style={styles.addBookPreviewCamera}
                      facing="back"
                      {...(Platform.OS === "android"
                        ? { ratio: "4:3" as const, videoQuality: "4:3" as const }
                        : {})}
                      onCameraReady={() => setAddBookSheetCameraReady(true)}
                    >
                      {!addBookSheetCameraReady ? (
                        <View style={styles.addBookPreviewPlaceholder} pointerEvents="none">
                          <Ionicons name="camera-outline" size={32} color="rgba(255,255,255,0.4)" />
                          <Text style={styles.addBookPreviewPlaceholderText}>Camera preview</Text>
                        </View>
                      ) : null}
                    </CameraView>
                  </View>
                  <View style={styles.addBookPreviewCornersOverlay} pointerEvents="none">
                    <PageScanSheetFrameCorners />
                  </View>
                </>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.addBookTakePhotoBtn,
                (isExtracting || !permission?.granted || !addBookSheetCameraReady) &&
                  styles.addBookTakePhotoBtnDisabled,
              ]}
              onPress={() => void onCaptureBookFromSheet()}
              activeOpacity={0.88}
              disabled={isExtracting || !permission?.granted || !addBookSheetCameraReady}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              {isExtracting ? (
                <ActivityIndicator color="#111111" />
              ) : (
                <>
                  <Ionicons name="camera" size={18} color="#111111" />
                  <Text style={styles.addBookTakePhotoBtnText}>Take photo</Text>
                </>
              )}
            </TouchableOpacity>
            <Pressable
              style={styles.addBookGalleryLinkWrap}
              onPress={() => void pickBookCoverFromGallery()}
              disabled={isExtracting || isGalleryOpening}
              accessibilityRole="button"
              accessibilityLabel="Choose from gallery"
            >
              <Text
                style={[
                  styles.addBookGalleryLinkText,
                  (isExtracting || isGalleryOpening) && styles.addBookGalleryLinkTextDisabled,
                ]}
              >
                {isGalleryOpening ? "Opening gallery…" : "Choose from gallery"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.addBookCancelLinkWrap}
              onPress={closeAddBookSheet}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.addBookCancelLinkText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </AddBookSheetContext.Provider>
  );
}

export function useAddBookSheet() {
  const ctx = useContext(AddBookSheetContext);
  if (!ctx) {
    throw new Error("useAddBookSheet must be used inside AddBookSheetProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  addBookSheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  addBookSheetDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  addBookSheetPanel: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  addBookSheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 10,
  },
  addBookSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  addBookSheetSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginBottom: 10,
  },
  addBookSheetSubtitleMuted: {
    color: "rgba(255,255,255,0.45)",
  },
  addBookSheetError: {
    marginBottom: 10,
    color: "#fecaca",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  addBookPreviewWrap: {
    position: "relative",
    borderRadius: 14,
    backgroundColor: "#0a0a0a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },
  addBookPreviewWrapSized: {
    width: "100%",
    alignSelf: "stretch",
    minHeight: 300,
  },
  addBookPreviewCameraSlot: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    borderRadius: 14,
    overflow: "hidden",
  },
  addBookPreviewCornersOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
  },
  addBookPreviewCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  addBookPreviewPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(10,10,10,0.92)",
  },
  addBookPreviewPlaceholderText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
  },
  addBookCameraGate: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  addBookCameraGateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 20,
  },
  addBookCameraGateBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addBookCameraGateBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  addBookTakePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignSelf: "stretch",
  },
  addBookTakePhotoBtnDisabled: {
    opacity: 0.55,
  },
  addBookTakePhotoBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  addBookGalleryLinkWrap: {
    marginTop: 10,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  addBookGalleryLinkText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },
  addBookGalleryLinkTextDisabled: {
    opacity: 0.4,
  },
  addBookCancelLinkWrap: {
    marginTop: 10,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  addBookCancelLinkText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
  },
});
