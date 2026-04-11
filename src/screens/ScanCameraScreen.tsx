import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { HeaderText } from "../components/HeaderText";
import { ReadingTimerCard } from "../components/ReadingTimerCard";
import { StreakBadge } from "../components/StreakBadge";
import { useScanContext } from "../context/ScanContext";
import { extractBookMetadataFromImage } from "../services/ai";
import { hexWithAlpha } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<ScanStackParamList, "ScanCamera">;

/**
 * expo-camera iOS matches `selectedLens` to `AVCaptureDevice.localizedName`, not
 * device-type strings like `builtInWideAngleCamera`. We map roles from the names
 * returned by `getAvailableLensesAsync` / `onAvailableLensesChanged`.
 */
function resolveIosLensRoles(names: string[]): {
  ultraWide: string | null;
  wide: string | null;
} {
  if (names.length === 0) {
    return { ultraWide: null, wide: null };
  }
  const lower = (s: string) => s.toLowerCase();
  const ultraWide = names.find((n) => lower(n).includes("ultra")) ?? null;
  const isTelephoto = (n: string) => {
    const l = lower(n);
    return l.includes("telephoto") || l.includes("periscope");
  };
  const wide =
    names.find((n) => !lower(n).includes("ultra") && !isTelephoto(n)) ?? null;
  return {
    ultraWide,
    wide: wide ?? names[0] ?? null,
  };
}

export function ScanCameraScreen({ navigation }: Props) {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const insets = useSafeAreaInsets();

  /** Explicit top spacer — tighter than full safe-area padding, still clears status / notch. */
  const artificialTopSpacer = useMemo(() => {
    if (Platform.OS === "android") {
      return (StatusBar.currentHeight ?? 24) + 2;
    }
    return Math.max(10, Math.round(insets.top * 0.4) + 2);
  }, [insets.top]);

  /** Top scrim: solid white / black fading to transparent so scrolling content soft-fades under the edge. */
  const topFadeColors = useMemo(
    () =>
      darkMode
        ? (["#000000", hexWithAlpha("#000000", 0)] as const)
        : (["#ffffff", hexWithAlpha("#ffffff", 0)] as const),
    [darkMode]
  );
  const topFadeHeight = artificialTopSpacer + 36;

  const { books, activeBookId, setActiveBookId, addOrActivateBook } = useScanContext();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [lensMode, setLensMode] = useState<"0.5x" | "1x">("1x");
  /** Resolved `localizedName` values for iOS lens switching (see `resolveIosLensRoles`). */
  const [iosLensRoles, setIosLensRoles] = useState<{
    ultraWide: string | null;
    wide: string | null;
  }>({ ultraWide: null, wide: null });
  /** Which segment shows the nested white "active" chip while the camera is open. */
  const [scanPillActive, setScanPillActive] = useState<"lens" | "gallery">("lens");
  const [coverExtracting, setCoverExtracting] = useState(false);
  const [coverExtractError, setCoverExtractError] = useState<string | null>(null);

  const needsFirstBook = books.length === 0;

  const applyAvailableLenses = useCallback((names: string[]) => {
    setIosLensRoles(resolveIosLensRoles(names));
  }, []);

  useEffect(() => {
    if (!isCameraOpen) {
      setIosLensRoles({ ultraWide: null, wide: null });
    }
  }, [isCameraOpen]);

  const coverFrameTips = useMemo(
    () => [
      "Fill the frame with the front cover",
      "Keep the title and author readable",
      "Avoid glare on the cover",
      "Hold steady for a sharp photo",
    ],
    []
  );

  const pageFrameTips = useMemo(
    () => [
      "Align your page in the frame",
      "Keep the page flat and fully visible",
      "Avoid shadows over the text",
      "Center the chapter title if possible",
      "Hold still for a sharper scan",
    ],
    []
  );

  const frameTips = needsFirstBook ? coverFrameTips : pageFrameTips;

  const processCoverFromUri = useCallback(
    async (coverUri: string) => {
      setCoverExtracting(true);
      setCoverExtractError(null);
      try {
        const metadata = await extractBookMetadataFromImage(coverUri);
        addOrActivateBook({
          title: metadata.title,
          author: metadata.author,
          coverUri,
        });
        setIsCameraOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read the cover.";
        setCoverExtractError(message);
      } finally {
        setCoverExtracting(false);
      }
    },
    [addOrActivateBook]
  );

  const activeBook = books.find((book) => book.id === activeBookId) ?? null;
  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return books;
    return books.filter((book) => {
      const title = book.title.toLowerCase();
      const author = book.author.toLowerCase();
      return title.includes(query) || author.includes(query);
    });
  }, [books, searchQuery]);

  useEffect(() => {
    setTipIndex(0);
  }, [needsFirstBook]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((current) => (current + 1) % frameTips.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [frameTips.length]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (isCameraOpen) {
      setScanPillActive("lens");
    }
  }, [isCameraOpen]);

  useFocusEffect(
    useMemo(
      () => () => {
        // Stop camera whenever user leaves this screen/tab.
        setIsCameraOpen(false);
      },
      []
    )
  );

  const onPickFromGallery = async () => {
    if (coverExtracting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isCameraOpen) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setScanPillActive("gallery");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (needsFirstBook) {
        await processCoverFromUri(uri);
      } else {
        navigation.navigate("Processing", { imageUri: uri });
      }
    } else if (isCameraOpen) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setScanPillActive("lens");
    }
  };

  const onCapture = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!isCameraOpen) {
      setCoverExtractError(null);
      setIsCameraOpen(true);
      return;
    }
    if (coverExtracting) return;
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.9,
      skipProcessing: true,
    });
    if (!photo?.uri) return;
    if (needsFirstBook) {
      await processCoverFromUri(photo.uri);
      return;
    }
    navigation.navigate("Processing", { imageUri: photo.uri });
  };

  const selectedLens = useMemo(() => {
    if (Platform.OS !== "ios") return undefined;
    const { ultraWide, wide } = iosLensRoles;
    if (lensMode === "0.5x") {
      return ultraWide ?? wide ?? undefined;
    }
    return wide ?? ultraWide ?? undefined;
  }, [lensMode, iosLensRoles]);

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, darkMode && styles.screenDark]}>
        <View style={{ height: artificialTopSpacer }} />
        <View
          style={{
            flex: 1,
            paddingLeft: 18 + insets.left,
            paddingRight: 18 + insets.right,
          }}
        >
          <HeaderText title="Camera Permission Needed" />
          <TouchableOpacity style={styles.primaryButtonWrap} onPress={requestPermission} activeOpacity={0.9}>
            <LinearGradient
              colors={accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            >
              <Ionicons name="camera" size={22} color="#fff" />
              <Text style={styles.primaryButtonText}>Enable Camera</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <LinearGradient
          colors={[...topFadeColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={[styles.topContentFade, { height: topFadeHeight }]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={{ height: artificialTopSpacer }} />
      <View
        style={{
          flex: 1,
          paddingLeft: 18 + insets.left,
          paddingRight: 18 + insets.right,
        }}
      >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, styles.scrollContentFlex]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scanPageTitleWrap}>
          <HeaderText
            title={needsFirstBook ? "Add your first book" : "Scan Page"}
            subtitle={
              needsFirstBook
                ? "Scan the cover to add title and author. Then you can scan pages."
                : undefined
            }
            style={styles.scanPageHeaderBlock}
            trailing={<StreakBadge />}
          />
        </View>

        {books.length > 0 && books.length < 4 ? (
          <View style={[styles.sectionBlock, darkMode && styles.sectionBlockDark]}>
            <Text style={styles.bookPickerLabel}>Scan into</Text>
            <View style={styles.bookPillRow}>
              {books.map((book) => {
                const isActive = activeBookId === book.id;
                return (
                  <TouchableOpacity
                    key={book.id}
                    style={[
                      styles.bookPill,
                      darkMode && styles.bookPillDarkBase,
                      isActive && {
                        backgroundColor: hexWithAlpha(accentColor, 0.16),
                        borderColor: hexWithAlpha(accentColor, 0.45),
                      },
                    ]}
                    onPress={() => setActiveBookId(book.id)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.bookPillText,
                        darkMode && styles.bookPillTextDarkBase,
                        isActive && { color: accentColor, fontWeight: "700" as const },
                      ]}
                      numberOfLines={1}
                    >
                      {book.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {books.length >= 4 ? (
          <View style={[styles.sectionBlock, darkMode && styles.sectionBlockDark]}>
            <Text style={styles.bookPickerLabel}>Scan into</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setIsBookModalOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dropdownTriggerText, darkMode && styles.dropdownTriggerTextDark]}>
                {activeBook ? `${activeBook.title} - ${activeBook.author}` : "Select a book"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={darkMode ? "#94a3b8" : "#475569"} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.sectionBlock, darkMode && styles.sectionBlockDark]}>
          <View style={styles.cameraShell}>
          <View style={[styles.cameraWrapper, darkMode && styles.cameraWrapperDark]}>
            {isCameraOpen ? (
              <CameraView
                ref={cameraRef}
                style={styles.cameraView}
                facing="back"
                selectedLens={selectedLens}
                zoom={0}
                flash={flashEnabled ? "on" : "off"}
                enableTorch={flashEnabled}
                onCameraReady={() => {
                  void cameraRef.current
                    ?.getAvailableLensesAsync()
                    .then((names) => applyAvailableLenses(names));
                }}
                onAvailableLensesChanged={({ lenses }) => applyAvailableLenses(lenses)}
              >
                <View style={styles.overlayBox}>
                  <Text style={styles.cameraHint}>{frameTips[tipIndex]}</Text>
                </View>
                {coverExtracting ? (
                  <View style={styles.coverExtractingOverlay} pointerEvents="auto">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.coverExtractingLabel}>Reading cover…</Text>
                  </View>
                ) : null}
              </CameraView>
            ) : (
              <View style={styles.cameraClosedOuter}>
                <View style={[styles.cameraClosedCard, darkMode && styles.cameraClosedCardDark]}>
                  <Ionicons name="camera-outline" size={44} color={accentColor} />
                  <Text style={[styles.cameraClosedTitle, darkMode && styles.cameraClosedTitleDark]}>
                    {needsFirstBook ? "Add your first book" : "Ready to scan"}
                  </Text>
                  <Text style={[styles.cameraClosedHint, darkMode && styles.cameraClosedHintDark]}>
                    {needsFirstBook
                      ? "Tap Add your first book below, then photograph the front cover."
                      : "Start scanning your page — tap Open camera below."}
                  </Text>
                </View>
              </View>
            )}

            {isCameraOpen ? (
              <View style={styles.scanOptionsOverlay} pointerEvents="box-none">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scanOptionsOuterScroll}
                  bounces={false}
                >
                  <View style={styles.scanOptionsOuterPill}>
                    <TouchableOpacity
                      style={styles.scanOptionSegmentWrap}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setScanPillActive("lens");
                        setLensMode((current) => (current === "1x" ? "0.5x" : "1x"));
                      }}
                      activeOpacity={0.85}
                      disabled={coverExtracting}
                    >
                      {scanPillActive === "lens" ? (
                        <View style={styles.scanOptionInnerActive}>
                          <Text style={styles.scanOptionInnerActiveText}>{lensMode}</Text>
                        </View>
                      ) : (
                        <View style={styles.scanOptionIconInactiveWrap}>
                          <Text style={styles.scanOptionLensInactiveText}>{lensMode}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.scanOptionOuterDivider} />
                    <TouchableOpacity
                      style={styles.scanOptionSegmentWrap}
                      onPress={() => setFlashEnabled((v) => !v)}
                      activeOpacity={0.85}
                      disabled={coverExtracting}
                    >
                      {flashEnabled ? (
                        <View style={styles.scanOptionInnerActive}>
                          <Ionicons name="flash" size={18} color="#0f172a" />
                        </View>
                      ) : (
                        <View style={styles.scanOptionIconInactiveWrap}>
                          <Ionicons name="flash-off" size={18} color="#64748b" />
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.scanOptionOuterDivider} />
                    <TouchableOpacity
                      style={styles.scanOptionSegmentWrap}
                      onPress={onPickFromGallery}
                      activeOpacity={0.85}
                      disabled={coverExtracting}
                    >
                      {scanPillActive === "gallery" ? (
                        <View style={[styles.scanOptionInnerActive, styles.scanOptionInnerActiveGallery]}>
                          <View style={styles.scanOptionGalleryActiveRow}>
                            <Ionicons name="images-outline" size={18} color="#0f172a" />
                            <Text style={styles.scanOptionInnerActiveText}>Gallery</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.scanOptionIconInactiveWrap}>
                          <Ionicons name="images-outline" size={18} color="#64748b" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>
        </View>

        <View style={[styles.sectionBlock, darkMode && styles.sectionBlockDark]}>
          {coverExtractError ? (
            <Text style={[styles.coverExtractError, darkMode && styles.coverExtractErrorDark]}>{coverExtractError}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.primaryButtonWrap}
            onPress={onCapture}
            activeOpacity={0.9}
            disabled={coverExtracting}
          >
            <LinearGradient
              colors={accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.primaryButtonGradient, coverExtracting && styles.primaryButtonGradientDisabled]}
            >
              <Ionicons name="camera" size={22} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {coverExtracting
                  ? "Reading cover…"
                  : needsFirstBook
                    ? isCameraOpen
                      ? "Scan cover"
                      : "Add your first book"
                    : isCameraOpen
                      ? "Capture page"
                      : "Open camera"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {books.length > 0 ? (
          <>
            <View style={styles.readingTimerSpacer} />
            <ReadingTimerCard />
          </>
        ) : null}
      </ScrollView>
      </View>

      <LinearGradient
        colors={[...topFadeColors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={[styles.topContentFade, { height: topFadeHeight }]}
      />

      <Modal visible={isBookModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, darkMode && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Select Book</Text>
              <TouchableOpacity onPress={() => setIsBookModalOpen(false)}>
                <Ionicons name="close" size={20} color={darkMode ? "#e2e8f0" : "#0f172a"} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title or author"
              placeholderTextColor="#94a3b8"
              style={[styles.searchInput, darkMode && styles.searchInputDark]}
            />

            <FlatList
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isActive = item.id === activeBookId;
                return (
                  <TouchableOpacity
                    style={[styles.bookRow, darkMode && styles.bookRowDark]}
                    onPress={() => {
                      setActiveBookId(item.id);
                      setIsBookModalOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <View style={styles.bookRowTextWrap}>
                      <Text style={[styles.bookRowTitle, darkMode && styles.bookRowTitleDark]}>{item.title}</Text>
                      <Text style={[styles.bookRowAuthor, darkMode && styles.bookRowAuthorDark]}>{item.author}</Text>
                    </View>
                    {isActive ? <Ionicons name="checkmark-circle" size={18} color={darkMode ? "#e2e8f0" : "#0f172a"} /> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptySearchText, darkMode && styles.emptySearchTextDark]}>
                  No books match your search.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  topContentFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    elevation: 4,
  },
  scrollContent: {
    paddingBottom: 110,
    gap: 8,
  },
  /** Lets the reading timer sit at the bottom when the scroll view is taller than content. */
  scrollContentFlex: {
    flexGrow: 1,
  },
  readingTimerSpacer: {
    flexGrow: 1,
    minHeight: 12,
  },
  scanPageTitleWrap: {
    marginTop: 40,
  },
  scanPageHeaderBlock: {
    marginBottom: 4,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionBlockDark: {},
  cameraShell: {
    borderRadius: 16,
    marginBottom: 8,
    minHeight: 500,
    maxHeight: "84%",
  },
  cameraWrapper: {
    position: "relative",
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  cameraWrapperDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  cameraClosedOuter: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  cameraClosedCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: lightColors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cameraClosedCardDark: {
    backgroundColor: darkColors.card,
  },
  cameraClosedTitle: {
    color: lightColors.textPrimary,
    fontWeight: "700",
    fontSize: 18,
  },
  cameraClosedTitleDark: {
    color: darkColors.textPrimary,
  },
  cameraClosedHint: {
    fontSize: 12,
    color: lightColors.textMuted,
    textAlign: "center",
    lineHeight: 17,
    opacity: 0.85,
  },
  cameraClosedHintDark: {
    color: darkColors.textSecondary,
  },
  bookPickerWrap: {
    marginBottom: 0,
  },
  bookPickerLabel: {
    color: lightColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 0,
  },
  dropdownTrigger: {
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownTriggerTextDark: {
    color: darkColors.textPrimary,
  },
  bookPillRow: {
    flexDirection: "row",
    gap: 2,
  },
  bookPill: {
    flex: 1,
    backgroundColor: lightColors.chipBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  bookPillDarkBase: {
    backgroundColor: darkColors.chipBg,
  },
  bookPillText: {
    color: lightColors.textSecondary,
    fontWeight: "600",
    fontSize: 12,
  },
  bookPillTextDarkBase: {
    color: darkColors.textSecondary,
  },
  dropdownTriggerText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 13,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: darkColors.overlay,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    maxHeight: "70%",
    padding: 12,
    gap: 10,
  },
  modalCardDark: {
    backgroundColor: darkColors.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: lightColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  modalTitleDark: {
    color: darkColors.textPrimary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: lightColors.textPrimary,
  },
  searchInputDark: {
    borderColor: darkColors.borderStrong,
    color: darkColors.textPrimary,
    backgroundColor: darkColors.background,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  bookRowDark: {
    borderBottomColor: darkColors.border,
  },
  bookRowTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  bookRowTitle: {
    color: "#0f172a",
    fontWeight: "600",
  },
  bookRowTitleDark: {
    color: darkColors.textPrimary,
  },
  bookRowAuthor: {
    color: "#64748b",
    fontSize: 12,
  },
  bookRowAuthorDark: {
    color: darkColors.textSecondary,
  },
  emptySearchText: {
    color: "#64748b",
    textAlign: "center",
    paddingVertical: 14,
  },
  emptySearchTextDark: {
    color: darkColors.textSecondary,
  },
  cameraView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayBox: {
    width: "84%",
    height: "82%",
    borderWidth: 2,
    marginBottom: 50,
    borderColor: "#ffffff",
    borderStyle: "dashed",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.15)",
  },
  cameraHint: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  coverExtractingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
    gap: 12,
  },
  coverExtractingLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  coverExtractError: {
    color: "#b91c1c",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 20,
  },
  coverExtractErrorDark: {
    color: "#fca5a5",
  },
  primaryButtonGradientDisabled: {
    opacity: 0.75,
  },
  scanOptionsOverlay: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    alignItems: "center",
  },
  scanOptionsOuterScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    flexGrow: 1,
    justifyContent: "center",
  },
  /** Frosted light capsule — active controls sit in nested white chips (see ref. Scanner UI). */
  scanOptionsOuterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  scanOptionSegmentWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  scanOptionInnerActive: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  scanOptionInnerActiveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  scanOptionInnerActiveGallery: {
    paddingHorizontal: 12,
    minWidth: 96,
  },
  scanOptionGalleryActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scanOptionLensInactiveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  scanOptionIconInactiveWrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 36,
    minHeight: 30,
  },
  scanOptionOuterDivider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    marginHorizontal: 2,
    backgroundColor: "rgba(15, 23, 42, 0.1)",
  },
  primaryButtonWrap: {
    borderRadius: 14,
    overflow: "hidden",
    width: "100%",
  },
  primaryButtonGradient: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.22)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
