import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  ActivityIndicator,
  BackHandler,
  Easing,
  GestureResponderEvent,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING } from "../navigation/rootTabLayout";
import type { LibraryStackParamList } from "../navigation/types";
import { extractBookMetadataFromImage } from "../services/ai";
import type { BookItem, ScanItem } from "../types/note";
import { darkColors, lightColors } from "../theme/colors";
import { FONT_CANELA_TEXT_BOLD } from "../theme/fonts";
import { pagesScannedPercent } from "../utils/bookReadingProgress";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";

type FilterId = "all" | "recent" | "mostReports";

function formatRelativeScanTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "Just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86400_000;
  if (d.getTime() >= startYesterday && d.getTime() < startToday) return "Yesterday";
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function snippetFromLatestScan(latest: ScanItem | undefined): string {
  if (!latest) return "";
  const raw =
    latest.notes.summary?.trim() ||
    latest.notes.mainIdeas?.find((x: string) => x.trim())?.trim() ||
    latest.notes.detailedNotes?.trim() ||
    "";
  return stripMarkdownBoldMarkers(raw).replace(/\s+/g, " ").trim();
}

export function LibraryScreen() {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { books, scans, activeBook, addOrActivateBook, isCoverProcessing, setIsCoverProcessing } = useScanContext();
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParamList, "LibraryHome">>();
  const [bookTitle, setBookTitle] = useState(activeBook?.title ?? "");
  const [bookAuthor, setBookAuthor] = useState(activeBook?.author ?? "");
  const [bookCoverUri, setBookCoverUri] = useState<string | null>(activeBook?.coverUri ?? null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showBookCapture, setShowBookCapture] = useState(false);
  const [showGalleryDropTarget, setShowGalleryDropTarget] = useState(false);
  const [isDraggingTowardGallery, setIsDraggingTowardGallery] = useState(false);
  const [isGalleryDropArmed, setIsGalleryDropArmed] = useState(false);
  const [skipNextAddPress, setSkipNextAddPress] = useState(false);
  const [lockScrollForAddGesture, setLockScrollForAddGesture] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const addGestureStartYRef = useRef(0);
  const galleryTriggerRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ignore navigation blur briefly after opening add-book (RN can emit blur when Modal mounts). */
  const bookCaptureOpenedAtRef = useRef(0);
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (showBookCapture) return;
    setBookTitle(activeBook?.title ?? "");
    setBookAuthor(activeBook?.author ?? "");
    setBookCoverUri(activeBook?.coverUri ?? null);
  }, [activeBook, books.length, showBookCapture]);

  useEffect(() => {
    const unsub = navigation.addListener("blur", () => {
      if (Date.now() - bookCaptureOpenedAtRef.current < 450) return;
      setShowBookCapture(false);
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (!showBookCapture || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (extracting || isCoverProcessing) return false;
      setShowBookCapture(false);
      return true;
    });
    return () => sub.remove();
  }, [showBookCapture, extracting, isCoverProcessing]);

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

  const booksWithMeta = useMemo(() => {
    return books.map((book) => {
      const bookScans = scans.filter((scan) => scan.bookId === book.id);
      const sortedScans = [...bookScans].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return {
        book,
        bookScans: sortedScans,
        latest: sortedScans[0],
        reportCount: bookScans.length,
      };
    });
  }, [books, scans]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = booksWithMeta;
    if (q) {
      rows = rows.filter(
        ({ book }) =>
          book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q)
      );
    }
    if (filter === "recent") {
      rows = [...rows].sort((a, b) => {
        const ta = a.latest ? new Date(a.latest.createdAt).getTime() : 0;
        const tb = b.latest ? new Date(b.latest.createdAt).getTime() : 0;
        return tb - ta;
      });
    } else if (filter === "mostReports") {
      rows = [...rows].sort((a, b) => b.reportCount - a.reportCount);
    } else {
      rows = [...rows].sort((a, b) => {
        const ia = books.findIndex((x) => x.id === a.book.id);
        const ib = books.findIndex((x) => x.id === b.book.id);
        return ia - ib;
      });
    }
    return rows;
  }, [booksWithMeta, books, searchQuery, filter]);

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
    setBookTitle("");
    setBookAuthor("");
    setBookCoverUri(null);
    setExtractError(null);
    bookCaptureOpenedAtRef.current = Date.now();
    setShowBookCapture(true);
  };

  const onAddBookLongPress = () => {
    if (books.length !== 0) return;
    setShowGalleryDropTarget(true);
    setSkipNextAddPress(true);
    void ImagePicker.requestMediaLibraryPermissionsAsync();
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

  const t = darkMode ? theme.dark : theme.light;

  const dismissBookCapture = () => {
    if (extracting || isCoverProcessing) return;
    setShowBookCapture(false);
  };

  return (
    <View style={styles.libraryRoot}>
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!showGalleryDropTarget && !lockScrollForAddGesture}
        contentContainerStyle={[
          styles.scrollContent,
          books.length === 0 && filteredBooks.length === 0 && styles.scrollContentEmpty,
        ]}
      >
        <View style={styles.topBlock}>
          <View style={styles.headerRow}>
            <Text
              style={[
                styles.libraryTitle,
                { color: darkMode ? darkColors.textPrimary : lightColors.textPrimary },
              ]}
              numberOfLines={1}
            >
              Library
            </Text>
            <Pressable
              style={[styles.headerAddButton, { backgroundColor: t.addButtonBg }]}
              onPress={onAddBookPress}
              onTouchStart={onAddBookTouchStart}
              onTouchMove={onAddBookTouchMove}
              onTouchEnd={onAddBookTouchEnd}
              onTouchCancel={onAddBookTouchEnd}
              onPressOut={onAddBookPressOut}
              hitSlop={8}
            >
              <Ionicons name="add" size={18} color="#111" />
            </Pressable>
          </View>

          {showGalleryDropTarget && books.length === 0 ? (
            <View
              style={[
                styles.galleryDropTarget,
                { borderColor: t.pillBorderUnselected, backgroundColor: t.galleryBg },
                isDraggingTowardGallery && { borderColor: accentColor, backgroundColor: accentColor },
              ]}
            >
              <Text
                style={[
                  styles.galleryDropTargetText,
                  { color: t.galleryText },
                  isDraggingTowardGallery && styles.galleryDropTargetTextActive,
                ]}
              >
                Gallery
              </Text>
            </View>
          ) : null}

          <View style={[styles.searchBar, { backgroundColor: t.searchBg, borderColor: t.searchBorder }]}>
            <Ionicons name="search-outline" size={16} color={t.searchIcon} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search books..."
              placeholderTextColor={t.searchPlaceholder}
              style={[styles.searchInput, { color: t.primaryText }]}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.pillsRow}>
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "recent" as const, label: "Recent" },
                { id: "mostReports" as const, label: "Most reports" },
              ] as const
            ).map((pill) => {
              const selected = filter === pill.id;
              return (
                <Pressable
                  key={pill.id}
                  onPress={() => setFilter(pill.id)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: selected ? t.pillBgSelected : t.pillBgUnselected,
                      borderColor: selected ? t.pillBorderSelected : t.pillBorderUnselected,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: selected ? t.pillTextSelected : t.pillTextUnselected },
                    ]}
                  >
                    {pill.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {extractError ? (
          <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{extractError}</Text>
        ) : null}

        {isCoverProcessing && !showBookCapture ? (
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
              { minHeight: Math.max(200, windowHeight * 0.32) },
            ]}
          >
            <View style={styles.emptyStateInner}>
              <Ionicons name="library-outline" size={42} color={accentColor} />
              <Text style={[styles.emptyTitle, darkMode && styles.emptyTitleDark]}>Add your first book</Text>
              <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                Tap + in the header, then scan a cover to extract the title and author. Long-press + for gallery.
              </Text>
            </View>
          </View>
        ) : filteredBooks.length === 0 ? (
          <View style={[styles.emptyStateFill, { minHeight: 160 }]}>
            <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No matching books.</Text>
          </View>
        ) : (
          <View style={styles.bookList}>
            {filteredBooks.map(({ book, bookScans, latest, reportCount }) => {
              const pct = pagesScannedPercent(book, bookScans);
              const snippet = snippetFromLatestScan(latest);
              const statMuted = t.statIcon;
              const relTime = latest ? formatRelativeScanTime(latest.createdAt) : "Not scanned yet";

              return (
                <TouchableOpacity
                  key={book.id}
                  style={[
                    styles.bookCard,
                    { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                    book.isRead && styles.bookCardRead,
                    book.isRead && { borderColor: accentColor },
                  ]}
                  onPress={() => navigation.navigate("BookReports", { bookId: book.id })}
                  activeOpacity={0.85}
                >
                  <View style={styles.bookCardTop}>
                    <View style={[styles.coverFrame, { backgroundColor: t.coverPlaceholderBg }]}>
                      {book.coverUri ? (
                        <Image source={{ uri: book.coverUri }} style={styles.coverImage} />
                      ) : (
                        <Ionicons name="book-outline" size={20} color={t.coverIconMuted} />
                      )}
                    </View>
                    <View style={styles.bookInfo}>
                      <Text style={[styles.cardTitle, { color: t.primaryText }]} numberOfLines={3}>
                        {book.title}
                      </Text>
                      <Text style={[styles.cardAuthor, { color: t.authorMuted }]} numberOfLines={1}>
                        {book.author}
                      </Text>
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Ionicons name="document-text-outline" size={11} color={statMuted} />
                          <Text style={[styles.statText, { color: t.statText }]}>
                            {reportCount} {reportCount === 1 ? "report" : "reports"}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons name="time-outline" size={11} color={statMuted} />
                          <Text style={[styles.statText, { color: t.statText }]} numberOfLines={1}>
                            {relTime}
                          </Text>
                        </View>
                      </View>
                      {snippet ? (
                        <Text
                          style={[styles.snippet, { color: t.snippetMuted }]}
                          numberOfLines={2}
                        >
                          {snippet}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.progressStrip}>
                    <View style={styles.progressLabelRow}>
                      <Text style={[styles.progressLabelLeft, { color: t.progressLabelLeft }]}>
                        Pages scanned
                      </Text>
                      <Text style={[styles.progressLabelRight, { color: t.progressLabelRight }]}>
                        {pct}%
                      </Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: t.progressTrackBg }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${pct}%`, backgroundColor: accentColor },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>

      <Modal
        visible={showBookCapture}
        transparent
        animationType="slide"
        onRequestClose={dismissBookCapture}
      >
        <View style={styles.bookCaptureModalRoot}>
          <Pressable
            style={styles.bookCaptureDismissHit}
            onPress={dismissBookCapture}
            accessibilityRole="button"
            accessibilityLabel="Close add book"
          />
          <View
            style={[
              styles.bookCaptureSheet,
              darkMode && styles.bookCaptureSheetDark,
              { paddingBottom: Math.max(insets.bottom, 12) + 16 },
            ]}
          >
            <View style={[styles.bookCaptureHandle, darkMode && styles.bookCaptureHandleDark]} />
            <View style={styles.bookCaptureSheetHeader}>
              <Text style={[styles.bookCaptureSheetTitle, darkMode && styles.bookCaptureSheetTitleDark]}>
                Add book
              </Text>
              <View style={styles.bookCaptureSheetHeaderActions}>
                <Pressable
                  onPress={() => {
                    setBookTitle("");
                    setBookAuthor("");
                    setBookCoverUri(null);
                    setExtractError(null);
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear draft"
                >
                  <Ionicons name="trash-outline" size={20} color="#dc2626" />
                </Pressable>
                <Pressable onPress={dismissBookCapture} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                  <Ionicons name="close" size={26} color={darkMode ? darkColors.textSecondary : "#64748b"} />
                </Pressable>
              </View>
            </View>

            {extractError ? (
              <Text style={[styles.sheetErrorText, darkMode && styles.sheetErrorTextDark]}>{extractError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.sheetCoverCard, darkMode && styles.sheetCoverCardDark]}
              onPress={onCaptureBook}
              activeOpacity={0.85}
              disabled={extracting}
            >
              {bookCoverUri ? (
                <Image source={{ uri: bookCoverUri }} style={styles.sheetCoverImage} resizeMode="cover" />
              ) : (
                <View style={styles.sheetCoverPlaceholder}>
                  <Ionicons name="camera-outline" size={40} color={darkMode ? "rgba(255,255,255,0.35)" : "#94a3b8"} />
                  <Text style={[styles.sheetCoverPlaceholderTitle, darkMode && styles.sheetCoverPlaceholderTitleDark]}>
                    Book cover
                  </Text>
                  <Text style={[styles.sheetCoverPlaceholderHint, darkMode && styles.sheetCoverPlaceholderHintDark]}>
                    Tap to take a photo
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetPrimaryButton, { backgroundColor: accentColor }]}
              onPress={onCaptureBook}
              activeOpacity={0.88}
              disabled={extracting}
            >
              {extracting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="camera" size={20} color="#ffffff" />
                  <Text style={styles.sheetPrimaryButtonLabel}>Take photo</Text>
                </>
              )}
            </TouchableOpacity>

            <Pressable
              onPress={() => void onPickBookFromGallery()}
              disabled={extracting}
              style={({ pressed }) => [styles.sheetSecondaryPress, pressed && styles.sheetSecondaryPressPressed]}
            >
              <Text style={[styles.sheetSecondaryLabel, darkMode && styles.sheetSecondaryLabelDark]}>
                Choose from gallery
              </Text>
            </Pressable>

            {!extracting ? (
              <View style={styles.sheetMetaBlock}>
                <Text style={[styles.aiLabel, darkMode && styles.aiLabelDark]}>Title</Text>
                <Text style={[styles.aiValue, darkMode && styles.aiValueDark]} numberOfLines={2}>
                  {bookTitle || "—"}
                </Text>
                <Text style={[styles.aiLabel, darkMode && styles.aiLabelDark, styles.sheetMetaGap]}>Author</Text>
                <Text style={[styles.aiValue, darkMode && styles.aiValueDark]} numberOfLines={2}>
                  {bookAuthor || "—"}
                </Text>
              </View>
            ) : (
              <View style={styles.sheetExtractingRow}>
                <Text style={[styles.loadingText, darkMode && styles.loadingTextDark]}>Reading cover with AI…</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const theme = {
  dark: {
    addButtonBg: "#ffffff",
    searchBg: "rgba(255,255,255,0.06)",
    searchBorder: "rgba(255,255,255,0.1)",
    searchIcon: "rgba(255,255,255,0.3)",
    searchPlaceholder: "rgba(255,255,255,0.25)",
    primaryText: "#ffffff",
    pillBgSelected: "rgba(255,255,255,0.12)",
    pillBorderSelected: "rgba(255,255,255,0.2)",
    pillTextSelected: "#ffffff",
    pillBgUnselected: "rgba(255,255,255,0.05)",
    pillBorderUnselected: "rgba(255,255,255,0.08)",
    pillTextUnselected: "rgba(255,255,255,0.35)",
    cardBg: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(255,255,255,0.08)",
    coverPlaceholderBg: "rgba(255,255,255,0.08)",
    coverIconMuted: "rgba(255,255,255,0.15)",
    authorMuted: "rgba(255,255,255,0.4)",
    statIcon: "rgba(255,255,255,0.35)",
    statText: "rgba(255,255,255,0.35)",
    snippetMuted: "rgba(255,255,255,0.3)",
    progressLabelLeft: "rgba(255,255,255,0.25)",
    progressLabelRight: "rgba(255,255,255,0.35)",
    progressTrackBg: "rgba(255,255,255,0.08)",
    galleryBg: "rgba(255,255,255,0.05)",
    galleryText: "#ffffff",
  },
  light: {
    addButtonBg: "#ffffff",
    searchBg: "rgba(0,0,0,0.05)",
    searchBorder: "rgba(0,0,0,0.1)",
    searchIcon: "rgba(0,0,0,0.3)",
    searchPlaceholder: "rgba(0,0,0,0.25)",
    primaryText: lightColors.textPrimary,
    pillBgSelected: "rgba(0,0,0,0.08)",
    pillBorderSelected: "rgba(0,0,0,0.2)",
    pillTextSelected: lightColors.textPrimary,
    pillBgUnselected: "rgba(0,0,0,0.04)",
    pillBorderUnselected: "rgba(0,0,0,0.08)",
    pillTextUnselected: "rgba(0,0,0,0.35)",
    cardBg: "rgba(0,0,0,0.03)",
    cardBorder: "rgba(0,0,0,0.08)",
    coverPlaceholderBg: "rgba(0,0,0,0.06)",
    coverIconMuted: "rgba(0,0,0,0.15)",
    authorMuted: "rgba(0,0,0,0.4)",
    statIcon: "rgba(0,0,0,0.35)",
    statText: "rgba(0,0,0,0.35)",
    snippetMuted: "rgba(0,0,0,0.3)",
    progressLabelLeft: "rgba(0,0,0,0.25)",
    progressLabelRight: "rgba(0,0,0,0.35)",
    progressTrackBg: "rgba(0,0,0,0.08)",
    galleryBg: "rgba(0,0,0,0.04)",
    galleryText: lightColors.textPrimary,
  },
} as const;

const styles = StyleSheet.create({
  libraryRoot: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING,
    gap: 16,
  },
  scrollContentEmpty: {
    flexGrow: 1,
  },
  topBlock: {
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 34,
  },
  libraryTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: "400",
    fontFamily: FONT_CANELA_TEXT_BOLD,
    marginRight: 12,
  },
  headerAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryDropTarget: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  galleryDropTargetText: {
    fontSize: 12,
    fontWeight: "700",
  },
  galleryDropTargetTextActive: {
    color: "#ffffff",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
    margin: 0,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "500",
  },
  bookList: {
    gap: 12,
  },
  bookCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  bookCardRead: {
    borderWidth: 2,
  },
  bookCardTop: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  coverFrame: {
    width: 52,
    height: 72,
    borderRadius: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  bookInfo: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18.2,
  },
  cardAuthor: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 14,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 11,
    lineHeight: 14,
  },
  snippet: {
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 15.4,
    marginTop: 6,
  },
  progressStrip: {
    paddingTop: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabelLeft: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  progressLabelRight: {
    fontSize: 10,
    fontWeight: "500",
  },
  progressTrack: {
    height: 2,
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    height: 2,
    borderRadius: 2,
    minWidth: 0,
  },
  bookCaptureModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bookCaptureDismissHit: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bookCaptureSheet: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    elevation: 28,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  bookCaptureSheetDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  bookCaptureHandle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(148,163,184,0.55)",
    marginBottom: 10,
  },
  bookCaptureHandleDark: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  bookCaptureSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  bookCaptureSheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  bookCaptureSheetTitleDark: {
    color: darkColors.textPrimary,
  },
  bookCaptureSheetHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sheetErrorText: {
    marginBottom: 12,
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  sheetErrorTextDark: {
    color: "#fecaca",
  },
  sheetCoverCard: {
    width: "100%",
    minHeight: 208,
    maxHeight: 280,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f1f5f9",
  },
  sheetCoverCardDark: {
    borderColor: darkColors.border,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sheetCoverImage: {
    width: "100%",
    height: 240,
  },
  sheetCoverPlaceholder: {
    flexDirection: "column",
    minHeight: 208,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  sheetCoverPlaceholderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 4,
  },
  sheetCoverPlaceholderTitleDark: {
    color: darkColors.textPrimary,
  },
  sheetCoverPlaceholderHint: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  sheetCoverPlaceholderHintDark: {
    color: darkColors.textSecondary,
  },
  sheetPrimaryButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
  },
  sheetPrimaryButtonLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  sheetSecondaryPress: {
    marginTop: 6,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetSecondaryPressPressed: {
    opacity: 0.65,
  },
  sheetSecondaryLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2563eb",
  },
  sheetSecondaryLabelDark: {
    color: "#93c5fd",
  },
  sheetMetaBlock: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.35)",
  },
  sheetMetaGap: {
    marginTop: 10,
  },
  sheetExtractingRow: {
    marginTop: 14,
    alignItems: "center",
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
  loadingText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 13,
  },
  loadingTextDark: {
    color: darkColors.textSecondary,
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
});
