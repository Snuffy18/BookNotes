import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAddBookSheet } from "../context/AddBookSheetContext";
import { useBarcodeScanBookSheet } from "../context/BarcodeScanBookSheetContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING } from "../navigation/rootTabLayout";
import type { LibraryStackParamList } from "../navigation/types";
import type { BookItem, ScanItem } from "../types/note";
import { LibraryEmptyState } from "../components/LibraryEmptyState";
import { darkColors, lightColors } from "../theme/colors";
import { FONT_CANELA_TEXT_BOLD } from "../theme/fonts";
import { pagesScannedPercent } from "../utils/bookReadingProgress";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";

type FilterId = "all" | "recent" | "mostReports";

function hasBookCover(book: BookItem): boolean {
  return Boolean(book.coverUri?.trim());
}

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
  const { books, scans, isCoverProcessing } = useScanContext();
  const { closeAddBookSheet, openAddBookSheet, pickBookCoverFromGallery, isOpen: isAddBookSheetOpen } =
    useAddBookSheet();
  const {
    openBarcodeScanBookSheet,
    closeBarcodeScanBookSheet,
    isOpen: isBarcodeScanBookSheetOpen,
  } = useBarcodeScanBookSheet();
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParamList, "LibraryHome">>();
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
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("blur", () => {
      if (Date.now() - bookCaptureOpenedAtRef.current < 450) return;
      if (isAddBookSheetOpen) closeAddBookSheet();
      if (isBarcodeScanBookSheetOpen) closeBarcodeScanBookSheet();
    });
    return unsub;
  }, [
    navigation,
    closeAddBookSheet,
    closeBarcodeScanBookSheet,
    isAddBookSheetOpen,
    isBarcodeScanBookSheetOpen,
  ]);

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

  const onAddBookPress = () => {
    if (books.length === 0 && skipNextAddPress) {
      setSkipNextAddPress(false);
      return;
    }
    bookCaptureOpenedAtRef.current = Date.now();
    openBarcodeScanBookSheet();
  };

  const onTakePhotoFromEmpty = () => {
    bookCaptureOpenedAtRef.current = Date.now();
    openAddBookSheet();
  };

  const isLibraryEmpty = books.length === 0;

  const captureCoverForBook = useCallback(
    async (book: BookItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      navigation.navigate("CropPhoto", {
        imageUri: result.assets[0].uri,
        purpose: "libraryBookCover",
        bookId: book.id,
      });
    },
    [navigation]
  );

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
      void pickBookCoverFromGallery();
    }
  };

  const t = darkMode ? theme.dark : theme.light;

  return (
    <View style={styles.libraryRoot}>
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark, isLibraryEmpty && styles.screenEmpty]}>
      {isLibraryEmpty ? (
        <View style={styles.emptyPage}>
          <View style={styles.emptyTopBlock}>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.libraryTitle,
                  styles.libraryTitleEmpty,
                  { color: darkMode ? "#ffffff" : lightColors.textPrimary },
                ]}
                numberOfLines={1}
              >
                Library
              </Text>
              <Pressable
                style={[styles.headerAddButton, { backgroundColor: t.addButtonBg }]}
                onPress={onAddBookPress}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add book"
              >
                <Ionicons name="add" size={18} color="#111" />
              </Pressable>
            </View>

            <View
              style={[
                styles.searchBar,
                styles.searchBarInactive,
                { backgroundColor: t.searchBg, borderColor: t.searchBorder },
              ]}
              pointerEvents="none"
            >
              <Ionicons name="search-outline" size={15} color={t.searchIcon} style={styles.searchIcon} />
              <Text style={[styles.searchPlaceholderInactive, { color: t.searchPlaceholder }]}>
                Search books...
              </Text>
            </View>
          </View>

          {isCoverProcessing && !isAddBookSheetOpen ? (
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
          ) : (
            <LibraryEmptyState
              onScanBarcode={onAddBookPress}
              onTakePhoto={onTakePhotoFromEmpty}
            />
          )}
        </View>
      ) : (
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

        {isCoverProcessing && !isAddBookSheetOpen ? (
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

        {books.length === 0 ? null : filteredBooks.length === 0 ? (
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
                      {hasBookCover(book) ? (
                        <Image source={{ uri: book.coverUri }} style={styles.coverImage} />
                      ) : (
                        <Pressable
                          style={styles.coverPlaceholderPress}
                          onPress={() => void captureCoverForBook(book)}
                          accessibilityRole="button"
                          accessibilityLabel={`Add cover photo for ${book.title}`}
                        >
                          <Ionicons name="camera-outline" size={20} color={t.coverIconMuted} />
                        </Pressable>
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
      )}
    </SafeAreaView>
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
  screenEmpty: {
    paddingHorizontal: 20,
  },
  emptyPage: {
    flex: 1,
  },
  emptyTopBlock: {
    gap: 16,
    paddingTop: 4,
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
  libraryTitleEmpty: {
    fontSize: 22,
    fontWeight: "600",
    fontFamily: undefined,
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
  searchBarInactive: {
    opacity: 0.4,
  },
  searchPlaceholderInactive: {
    flex: 1,
    fontSize: 13,
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
  coverPlaceholderPress: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
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
