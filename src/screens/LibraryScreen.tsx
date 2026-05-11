import { useCallback, useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  ActivityIndicator,
  Easing,
  GestureResponderEvent,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderText } from "../components/HeaderText";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { LibraryStackParamList, RootTabParamList } from "../navigation/types";
import { extractBookMetadataFromImage } from "../services/ai";
import { darkColors, lightColors } from "../theme/colors";
import { FONT_CANELA_TEXT_BOLD } from "../theme/fonts";

export function LibraryScreen() {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const { height: windowHeight } = useWindowDimensions();
  const { books, scans, activeBook, addOrActivateBook, isCoverProcessing, setIsCoverProcessing } = useScanContext();
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParamList, "LibraryHome">>();
  const [bookTitle, setBookTitle] = useState(activeBook?.title ?? "");
  const [bookAuthor, setBookAuthor] = useState(activeBook?.author ?? "");
  const [bookCoverUri, setBookCoverUri] = useState<string | null>(activeBook?.coverUri ?? null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  /** Capture card only after the user taps Add book — not by default on an empty library. */
  const [showBookCapture, setShowBookCapture] = useState(false);
  const [showGalleryDropTarget, setShowGalleryDropTarget] = useState(false);
  const [isDraggingTowardGallery, setIsDraggingTowardGallery] = useState(false);
  const [isGalleryDropArmed, setIsGalleryDropArmed] = useState(false);
  const [skipNextAddPress, setSkipNextAddPress] = useState(false);
  const [lockScrollForAddGesture, setLockScrollForAddGesture] = useState(false);
  const addGestureStartYRef = useRef(0);
  const galleryTriggerRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    setBookTitle(activeBook?.title ?? "");
    setBookAuthor(activeBook?.author ?? "");
    setBookCoverUri(activeBook?.coverUri ?? null);
  }, [activeBook, books.length]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowBookCapture(false);
      };
    }, [])
  );

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCoverProcessing) {
      shimmerX.setValue(-1);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      shimmerX.setValue(-1);
    };
  }, [isCoverProcessing, shimmerX]);

  const processBookCover = async (coverUri: string) => {
    setBookCoverUri(coverUri);
    setExtractError(null);
    setIsCoverProcessing(true);
    setExtracting(true);
    try {
      const metadata = await extractBookMetadataFromImage(coverUri);
      setBookTitle(metadata.title);
      setBookAuthor(metadata.author);
      addOrActivateBook({
        title: metadata.title,
        author: metadata.author,
        coverUri,
      });
      setShowBookCapture(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to extract title and author.";
      setExtractError(message);
    } finally {
      setIsCoverProcessing(false);
      setExtracting(false);
    }
  };

  const onCaptureBook = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled) return;

    await processBookCover(result.assets[0].uri);
  };

  const onPickBookFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled) return;

    await processBookCover(result.assets[0].uri);
  };

  const onAddBookPress = () => {
    if (books.length === 0 && skipNextAddPress) {
      setSkipNextAddPress(false);
      return;
    }
    if (books.length > 0) {
      const tabNav = navigation.getParent<NavigationProp<RootTabParamList>>();
      tabNav?.navigate("ScanFlow", {
        screen: "ScanCamera",
        params: { autoOpenCoverCamera: true },
      });
      return;
    }
    setBookTitle("");
    setBookAuthor("");
    setBookCoverUri(null);
    setExtractError(null);
    setShowBookCapture(true);
  };

  const onAddBookLongPress = () => {
    if (books.length !== 0) return;
    setShowGalleryDropTarget(true);
    setSkipNextAddPress(true);
    void ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  const onAddBookPressMove = async (event: { nativeEvent: { locationY: number } }) => {
    if (!showGalleryDropTarget || books.length !== 0) return;
    if (event.nativeEvent.locationY < 52) return;

    setShowGalleryDropTarget(false);
    setSkipNextAddPress(true);
    await onPickBookFromGallery();
  };

  const onAddBookPressOut = () => {
    setShowGalleryDropTarget(false);
    setIsDraggingTowardGallery(false);
    setIsGalleryDropArmed(false);
  };

  const onAddBookTouchStart = (event: GestureResponderEvent) => {
    if (books.length !== 0) return;
    addGestureStartYRef.current = event.nativeEvent.pageY;
    galleryTriggerRef.current = false;
    setLockScrollForAddGesture(true);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      onAddBookLongPress();
    }, 160);
  };

  const onAddBookTouchMove = (event: GestureResponderEvent) => {
    if (books.length !== 0 || !showGalleryDropTarget || galleryTriggerRef.current) return;
    const dragDistance = event.nativeEvent.pageY - addGestureStartYRef.current;
    setIsDraggingTowardGallery(dragDistance >= 12);
    setIsGalleryDropArmed(dragDistance >= 28);
  };

  const onAddBookTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const shouldOpenGallery = showGalleryDropTarget && isGalleryDropArmed && books.length === 0;
    setShowGalleryDropTarget(false);
    setIsDraggingTowardGallery(false);
    setIsGalleryDropArmed(false);
    setLockScrollForAddGesture(false);
    if (shouldOpenGallery) {
      galleryTriggerRef.current = true;
      setSkipNextAddPress(true);
      void onPickBookFromGallery();
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <HeaderText
        title="Library"
        subtitle="Take a book photo, then AI extracts title and author."
        titleStyle={{ fontFamily: FONT_CANELA_TEXT_BOLD, fontWeight: "400" }}
      />

      <ScrollView
        style={styles.scrollView}
        scrollEnabled={!showGalleryDropTarget && !lockScrollForAddGesture}
        contentContainerStyle={[
          styles.scrollContent,
          books.length === 0 && styles.scrollContentEmpty,
        ]}
      >
        <View style={styles.addBookButtonGroup}>
          <Pressable
            style={styles.addBookButtonWrap}
            onPress={onAddBookPress}
            onTouchStart={onAddBookTouchStart}
            onTouchMove={onAddBookTouchMove}
            onTouchEnd={onAddBookTouchEnd}
            onTouchCancel={onAddBookTouchEnd}
            onPressOut={onAddBookPressOut}
          >
            <LinearGradient
              colors={accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addBookButtonGradient}
            >
              <Text style={styles.addBookButtonText}>
                {books.length === 0 ? "Add your first book" : "+ Add another book"}
              </Text>
            </LinearGradient>
          </Pressable>
          {showGalleryDropTarget && books.length === 0 ? (
            <View
              style={[
                styles.galleryDropTarget,
                darkMode && styles.galleryDropTargetDark,
                isDraggingTowardGallery && { borderColor: accentColor, backgroundColor: accentColor },
              ]}
            >
              <Text
                style={[
                  styles.galleryDropTargetText,
                  darkMode && styles.galleryDropTargetTextDark,
                  isDraggingTowardGallery && styles.galleryDropTargetTextActive,
                ]}
              >
                Gallery
              </Text>
            </View>
          ) : null}
        </View>
        {extractError ? <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{extractError}</Text> : null}

        {isCoverProcessing ? (
          <View style={styles.loadingSkeletonBlock}>
            <View style={[styles.loadingSkeletonCard, darkMode && styles.loadingSkeletonCardDark]}>
              <View style={styles.loadingSkeletonCover} />
              <View style={styles.loadingSkeletonMeta}>
                <View style={styles.loadingSkeletonLineLg} />
                <View style={styles.loadingSkeletonLineMd} />
                <View style={styles.loadingSkeletonLineSm} />
                <View style={styles.loadingSkeletonLineSm} />
              </View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.loadingSkeletonShimmer,
                  {
                    transform: [
                      {
                        translateX: shimmerX.interpolate({
                          inputRange: [-1, 1],
                          outputRange: [-220, 220],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={["transparent", "rgba(255,255,255,0.32)", "transparent"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.loadingSkeletonShimmerInner}
                />
              </Animated.View>
            </View>
            <Text style={[styles.loadingSkeletonCaption, darkMode && styles.loadingSkeletonCaptionDark]}>
              Reading cover with AI…
            </Text>
          </View>
        ) : null}

        {books.length === 0 ? (
          <View
            style={[
              styles.emptyStateFill,
              { minHeight: Math.max(200, windowHeight * 0.38) },
            ]}
          >
            <View style={styles.emptyStateInner}>
              <Ionicons name="library-outline" size={42} color={accentColor} />
              <Text style={[styles.emptyTitle, darkMode && styles.emptyTitleDark]}>Add your first book</Text>
              <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                Tap Add your first book, then scan a cover to extract the title and author.
              </Text>
            </View>
          </View>
        ) : (
          books.map((book) => {
            const bookScans = scans.filter((scan) => scan.bookId === book.id);
            const pageCount = bookScans.length;
            const addedOn = new Date(book.createdAt).toLocaleDateString([], {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const lastScanned = bookScans[0]
              ? new Date(bookScans[0].createdAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Not scanned yet";
            return (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.bookContainer,
                  darkMode && styles.bookContainerDark,
                  book.isRead && styles.bookContainerRead,
                  book.isRead && { borderColor: accentColor },
                ]}
                onPress={() => navigation.navigate("BookReports", { bookId: book.id })}
                activeOpacity={0.85}
              >
                <Image source={{ uri: book.coverUri }} style={styles.coverThumb} />
                <View style={styles.bookMeta}>
                  <Text style={[styles.bookTitle, darkMode && styles.bookTitleDark]}>{book.title}</Text>
                  <Text style={[styles.bookAuthor, darkMode && styles.bookAuthorDark]}>{book.author}</Text>
                  <Text style={[styles.bookPages, darkMode && styles.bookPagesDark]}>{pageCount} report(s)</Text>
                  <Text style={[styles.bookMetaInfo, darkMode && styles.bookMetaInfoDark]}>
                    Added: {addedOn}
                  </Text>
                  <Text style={[styles.bookMetaInfo, darkMode && styles.bookMetaInfoDark]}>
                    Last scanned: {lastScanned}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showBookCapture} transparent animationType="fade" onRequestClose={() => setShowBookCapture(false)}>
        <View style={styles.captureModalBackdrop}>
          <View style={[styles.captureModalCard, darkMode && styles.captureModalCardDark]}>
            <TouchableOpacity
              style={styles.deleteDraftButton}
              onPress={() => {
                setBookTitle("");
                setBookAuthor("");
                setBookCoverUri(null);
                setExtractError(null);
                setShowBookCapture(false);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.coverPicker, darkMode && styles.coverPickerDark]} onPress={onCaptureBook} disabled={extracting}>
              {bookCoverUri ? (
                <Image source={{ uri: bookCoverUri }} style={styles.coverImage} />
              ) : (
                <Text style={[styles.coverPlaceholder, darkMode && styles.coverPlaceholderDark]}>Scan Cover</Text>
              )}
            </TouchableOpacity>

            <View style={styles.bookFields}>
              {extracting ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={accentColor} />
                  <Text style={styles.loadingText}>Reading cover with AI...</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.aiLabel, darkMode && styles.aiLabelDark]}>Title</Text>
                  <Text style={[styles.aiValue, darkMode && styles.aiValueDark]}>{bookTitle || "-"}</Text>
                  <Text style={[styles.aiLabel, darkMode && styles.aiLabelDark]}>Author</Text>
                  <Text style={[styles.aiValue, darkMode && styles.aiValueDark]}>{bookAuthor || "-"}</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
    gap: 12,
  },
  scrollContentEmpty: {
    flexGrow: 1,
  },
  bookCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 10,
    marginBottom: 2,
    paddingTop: 30,
  },
  bookCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  captureModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  captureModalCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 10,
    paddingTop: 30,
  },
  captureModalCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  loadingSkeletonBlock: {
    gap: 8,
    alignSelf: "stretch",
  },
  loadingSkeletonCaption: {
    fontSize: 13,
    fontWeight: "600",
    color: lightColors.textMuted,
    textAlign: "center",
  },
  loadingSkeletonCaptionDark: {
    color: darkColors.textSecondary,
  },
  loadingSkeletonCard: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  loadingSkeletonCardDark: {
    borderColor: darkColors.border,
    backgroundColor: darkColors.card,
  },
  loadingSkeletonCover: {
    width: 62,
    height: 82,
    borderRadius: 8,
    backgroundColor: "rgba(148,163,184,0.35)",
  },
  loadingSkeletonMeta: {
    flex: 1,
    gap: 8,
  },
  loadingSkeletonLineLg: {
    width: "80%",
    height: 14,
    borderRadius: 6,
    backgroundColor: "rgba(148,163,184,0.35)",
  },
  loadingSkeletonLineMd: {
    width: "56%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(148,163,184,0.3)",
  },
  loadingSkeletonLineSm: {
    width: "44%",
    height: 10,
    borderRadius: 6,
    backgroundColor: "rgba(148,163,184,0.28)",
  },
  loadingSkeletonShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 120,
  },
  loadingSkeletonShimmerInner: {
    flex: 1,
  },
  deleteDraftButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  coverPicker: {
    width: 72,
    height: 92,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverPickerDark: {
    backgroundColor: darkColors.card,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 12,
  },
  coverPlaceholderDark: {
    color: darkColors.textSecondary,
  },
  bookFields: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  aiLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  aiLabelDark: {
    color: darkColors.textSecondary,
  },
  aiValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  aiValueDark: {
    color: darkColors.textPrimary,
  },
  addBookButtonWrap: {
    alignSelf: "flex-start",
    borderRadius: 10,
    overflow: "hidden",
  },
  addBookButtonGroup: {
    alignSelf: "flex-start",
    gap: 8,
  },
  addBookButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addBookButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  galleryDropTarget: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  galleryDropTargetDark: {
    borderColor: darkColors.border,
    backgroundColor: darkColors.card,
  },
  galleryDropTargetText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  galleryDropTargetTextDark: {
    color: darkColors.textPrimary,
  },
  galleryDropTargetTextActive: {
    color: "#ffffff",
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 13,
  },
  errorText: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorTextDark: {
    backgroundColor: "#7f1d1d",
    borderColor: "#991b1b",
    color: "#fee2e2",
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 20,
    fontSize: 14,
  },
  emptyTextDark: {
    color: darkColors.textSecondary,
  },
  emptyStateFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: {
    color: lightColors.textSecondary,
    fontSize: 18,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    textAlign: "center",
  },
  emptyTitleDark: {
    color: darkColors.textPrimary,
  },
  bookContainer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  bookContainerDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  bookContainerRead: {
    borderWidth: 2,
  },
  coverThumb: {
    width: 62,
    height: 82,
    borderRadius: 8,
    backgroundColor: "#cbd5e1",
  },
  bookMeta: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  bookTitleDark: {
    color: darkColors.textPrimary,
  },
  bookAuthor: {
    color: "#334155",
    fontSize: 14,
  },
  bookAuthorDark: {
    color: darkColors.textSecondary,
  },
  bookPages: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 12,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
  },
  bookPagesDark: {
    color: darkColors.textSecondary,
  },
  bookMetaInfo: {
    color: lightColors.textMuted,
    fontSize: 11,
  },
  bookMetaInfoDark: {
    color: darkColors.textSecondary,
  },
});
