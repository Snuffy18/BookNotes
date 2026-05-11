import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  GestureResponderEvent,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import type { BookItem, ChapterRange, ReadingSession, ScanItem } from "../types/note";
import { HeaderText } from "../components/HeaderText";
import { ReadingTimerBottomSheet } from "../components/ReadingTimerBottomSheet";
import { StreakBadge } from "../components/StreakBadge";
import { useReadingSession } from "../context/ReadingSessionContext";
import { useScanContext } from "../context/ScanContext";
import { extractBookMetadataFromImage, extractChapterRangesFromContentsImage } from "../services/ai";
import { hexWithAlpha } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";
import { FONT_CANELA_TEXT_BOLD, FONT_HELVETICA } from "../theme/fonts";
import { playSoundEffect } from "../utils/soundEffects";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";

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

const CHAPTER_MAP_BG = "#111";

const PAGE_SCAN_SHEET_CORNER_LEN = 22;
const PAGE_SCAN_SHEET_CORNER_INSET = 10;
const PAGE_SCAN_SHEET_STROKE = 2;

/** White L-shaped corner brackets for the page-scan sheet preview (2px stroke). */
function PageScanSheetFrameCorners() {
  const c = {
    position: "absolute" as const,
    width: PAGE_SCAN_SHEET_CORNER_LEN,
    height: PAGE_SCAN_SHEET_CORNER_LEN,
    borderColor: "#ffffff",
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={{
          ...c,
          left: PAGE_SCAN_SHEET_CORNER_INSET,
          top: PAGE_SCAN_SHEET_CORNER_INSET,
          borderLeftWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...c,
          right: PAGE_SCAN_SHEET_CORNER_INSET,
          top: PAGE_SCAN_SHEET_CORNER_INSET,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...c,
          left: PAGE_SCAN_SHEET_CORNER_INSET,
          bottom: PAGE_SCAN_SHEET_CORNER_INSET,
          borderLeftWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...c,
          right: PAGE_SCAN_SHEET_CORNER_INSET,
          bottom: PAGE_SCAN_SHEET_CORNER_INSET,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
    </View>
  );
}

function mergeChapterRanges(existing: ChapterRange[], incoming: ChapterRange[]): ChapterRange[] {
  return [...existing, ...incoming].sort((a, b) => a.startPage - b.startPage);
}

/** Monday 00:00 local time for the calendar week containing `from`. */
function startOfCalendarWeekMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday-indexed flags: index 0 = Monday … 6 = Sunday. Uses session `endedAt` (local calendar day). */
function readingSessionWeekDotsFromSessions(
  sessions: ReadingSession[],
  weekMonday: Date
): boolean[] {
  const flags = [false, false, false, false, false, false, false];
  const weekStartMs = weekMonday.getTime();
  const weekEndMs = weekStartMs + 7 * 86400000;
  for (const s of sessions) {
    const t = new Date(s.endedAt).getTime();
    if (t < weekStartMs || t >= weekEndMs) continue;
    const dayStart = new Date(s.endedAt);
    dayStart.setHours(0, 0, 0, 0);
    const idx = Math.round((dayStart.getTime() - weekStartMs) / 86400000);
    if (idx >= 0 && idx <= 6) flags[idx] = true;
  }
  return flags;
}

function normalizeWidgetHighlightTeaser(raw: string): string {
  let s = stripMarkdownBoldMarkers(raw).replace(/\s+/g, " ").trim();
  if (s.length >= 2) {
    const quotePairs: [string, string][] = [
      ['"', '"'],
      ["\u201c", "\u201d"],
      ["\u2018", "\u2019"],
    ];
    for (const [open, close] of quotePairs) {
      if (s.startsWith(open) && s.endsWith(close)) {
        s = s.slice(1, -1).trim();
        break;
      }
    }
  }
  return s;
}

function formatReadingTimerWidgetSessionTeaser(
  sessions: ReadingSession[],
  books: BookItem[]
): string | null {
  if (sessions.length === 0) return null;
  const last = [...sessions].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  )[0];
  let title = last.bookTitle?.trim() || "";
  if (!title && last.bookId) {
    title = books.find((b) => b.id === last.bookId)?.title?.trim() || "";
  }
  const displayTitle = title ? title.replace(/\s+/g, " ") : "Untitled book";
  const mins = Math.max(1, Math.round(last.durationSeconds / 60));
  const durLabel = mins === 1 ? "1 min" : `${mins} min`;
  return `${displayTitle} · ${durLabel}`;
}

/** Right column: "9 – 22" (spaces around en dash); uses inferred end when `endPage` is missing. */
function formatChapterMapPageRange(startPage: number, displayEnd?: number): string {
  if (displayEnd != null && displayEnd > startPage) {
    return `${startPage} – ${displayEnd}`;
  }
  return String(startPage);
}

function formatRecentScanPageLine(scan: ScanItem): string {
  const raw = (scan.page?.trim() || scan.notes.pageNumber?.trim() || "").trim();
  if (!raw) return "p. —";
  const cleaned = raw.replace(/^p\.?\s*/i, "");
  return `p. ${cleaned}`;
}

function formatRecentScanTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startScan = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startScan) / 86400000);
  if (diffDays === 0) return `Today, ${timePart}`;
  if (diffDays === 1) return `Yesterday, ${timePart}`;
  const dayPart = d.toLocaleDateString([], { weekday: "short" });
  return `${dayPart}, ${timePart}`;
}

function truncateScanSnippet(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, Math.max(0, maxLen - 1))}…`;
}

/** One-line preview for recent scan cards: main idea, else summary, else quote. */
function formatRecentScanSnippet(scan: ScanItem): string {
  const firstIdea = scan.notes.mainIdeas[0];
  if (firstIdea?.trim()) {
    return truncateScanSnippet(stripMarkdownBoldMarkers(firstIdea).trim(), 80);
  }
  const summary = stripMarkdownBoldMarkers(scan.notes.summary).trim();
  if (summary) return truncateScanSnippet(summary, 80);
  const firstQuote = (scan.notes.quotes ?? [])[0]?.trim();
  if (firstQuote) return truncateScanSnippet(stripMarkdownBoldMarkers(firstQuote).trim(), 80);
  return "Scan saved";
}

function formatLastExtractPageLine(scan: ScanItem): string {
  const raw = (scan.page?.trim() || scan.notes.pageNumber?.trim() || "").trim();
  if (!raw) return "Page —";
  const cleaned = raw.replace(/^p\.?\s*/i, "");
  return `p. ${cleaned}`;
}

type LibraryPromoKind = "idea" | "quote" | "summary";

type LibraryPromoSlide = {
  kind: LibraryPromoKind;
  text: string;
  scan: ScanItem;
  chapterLabel: string | null;
  pageLabel: string;
};

function buildLibraryPromoSlides(scansFiltered: ScanItem[]): LibraryPromoSlide[] {
  const sorted = [...scansFiltered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const out: LibraryPromoSlide[] = [];
  for (const scan of sorted) {
    const chapterLabel = scan.chapter?.trim() || null;
    const pageLabel = formatRecentScanPageLine(scan);
    for (const raw of scan.notes.mainIdeas) {
      const text = stripMarkdownBoldMarkers(raw).trim();
      if (text) {
        out.push({ kind: "idea", text, scan, chapterLabel, pageLabel });
      }
    }
    for (const raw of scan.notes.quotes ?? []) {
      const text = stripMarkdownBoldMarkers(raw).trim();
      if (text) {
        out.push({ kind: "quote", text, scan, chapterLabel, pageLabel });
      }
    }
    const summary = stripMarkdownBoldMarkers(scan.notes.summary).trim();
    if (summary) {
      out.push({ kind: "summary", text: summary, scan, chapterLabel, pageLabel });
    }
  }
  return out;
}

function libraryPromoKindLabel(kind: LibraryPromoKind): string {
  switch (kind) {
    case "idea":
      return "Idea";
    case "quote":
      return "Quote";
    case "summary":
      return "Summary";
  }
}

const LIBRARY_PROMO_DOT_COUNT_CAP = 7;
const FROM_LIBRARY_MODAL_HORIZONTAL_PAD = 18;
/** Next card visible by at least this many pixels when paging. */
const FROM_LIBRARY_CARD_PEEK_PX = 12;
const FROM_LIBRARY_CARD_WIDTH_RATIO = 0.9;
const FROM_LIBRARY_MODAL_CARD_MIN_HEIGHT = 312;
const FROM_LIBRARY_PILLS_TO_CAROUSEL_GAP = 16;
const FROM_LIBRARY_CARD_TO_DOTS_GAP = 8;
const FROM_LIBRARY_MODAL_SHEET_MAX_HEIGHT_RATIO = 0.78;
const FROM_LIBRARY_OPEN_REPORT_HOLD_MS = 1000;
const FROM_LIBRARY_SWIPE_HINT_STORAGE_KEY = "@booknotes/fromLibrarySwipeHintDismissed";

function libraryPromoDotsLayoutForIndex(total: number, slideIndex: number): {
  dotCount: number;
  activeDot: number;
} {
  if (total === 0) return { dotCount: 0, activeDot: 0 };
  const dotCount = Math.min(total, LIBRARY_PROMO_DOT_COUNT_CAP);
  if (total <= LIBRARY_PROMO_DOT_COUNT_CAP) {
    return { dotCount: total, activeDot: slideIndex };
  }
  const activeDot = Math.round(
    (slideIndex / Math.max(1, total - 1)) * (dotCount - 1)
  );
  return { dotCount, activeDot };
}

const FROM_LIBRARY_CARD_HORIZONTAL_PADDING = 36;

function FromLibraryPromoHoldCard({
  slide,
  darkMode,
  accentColor,
  cardWidth,
  minHeight,
  onHoldComplete,
}: {
  slide: LibraryPromoSlide;
  darkMode: boolean;
  accentColor: string;
  cardWidth: number;
  minHeight: number;
  onHoldComplete: (s: LibraryPromoSlide) => void;
}) {
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const midHoldHapticRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillMaxW = Math.max(4, cardWidth - FROM_LIBRARY_CARD_HORIZONTAL_PADDING);

  useEffect(() => {
    return () => {
      holdAnimRef.current?.stop?.();
      if (midHoldHapticRef.current) {
        clearTimeout(midHoldHapticRef.current);
      }
    };
  }, []);

  const onPressIn = useCallback(() => {
    holdAnimRef.current?.stop?.();
    if (midHoldHapticRef.current) {
      clearTimeout(midHoldHapticRef.current);
      midHoldHapticRef.current = null;
    }
    holdProgress.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    midHoldHapticRef.current = setTimeout(() => {
      midHoldHapticRef.current = null;
      Haptics.selectionAsync().catch(() => {});
    }, Math.floor(FROM_LIBRARY_OPEN_REPORT_HOLD_MS / 2));
    const anim = Animated.timing(holdProgress, {
      toValue: 1,
      duration: FROM_LIBRARY_OPEN_REPORT_HOLD_MS,
      useNativeDriver: false,
    });
    holdAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) onHoldComplete(slide);
    });
  }, [holdProgress, onHoldComplete, slide]);

  const onPressOut = useCallback(() => {
    if (midHoldHapticRef.current) {
      clearTimeout(midHoldHapticRef.current);
      midHoldHapticRef.current = null;
    }
    holdAnimRef.current?.stop?.();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [holdProgress]);

  const barWidth = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, fillMaxW],
  });

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.fromLibraryModalCardPressable,
        pressed && styles.fromLibraryCardPressed,
      ]}
      accessibilityRole="button"
      accessibilityHint="Hold for one second to open the full report. A bar at the top of the card shows progress."
    >
      <View
        style={[
          styles.fromLibraryCard,
          !darkMode && styles.fromLibraryCardLight,
          styles.fromLibraryModalCardInPager,
          { width: cardWidth, minHeight },
        ]}
      >
        <View
          style={[
            styles.fromLibraryHoldProgressTrack,
            darkMode ? null : styles.fromLibraryHoldProgressTrackLight,
          ]}
        >
          <Animated.View
            style={[
              styles.fromLibraryHoldProgressFill,
              { width: barWidth, backgroundColor: accentColor },
            ]}
          />
        </View>
        <Text
          style={[styles.fromLibraryCardKind, !darkMode && styles.fromLibraryCardKindLight]}
        >
          {libraryPromoKindLabel(slide.kind)}
        </Text>
        <Text style={[styles.fromLibraryCardBody, !darkMode && styles.fromLibraryCardBodyLight]}>
          {slide.text}
        </Text>
        <View style={[styles.fromLibraryDivider, !darkMode && styles.fromLibraryDividerLight]} />
        <View style={styles.fromLibraryFooterRow}>
          <Text
            style={[styles.fromLibraryFooterChapter, !darkMode && styles.fromLibraryFooterMutedLight]}
            numberOfLines={1}
          >
            {slide.chapterLabel || "—"}
          </Text>
          <Text
            style={[styles.fromLibraryFooterPage, !darkMode && styles.fromLibraryFooterMutedLight]}
            numberOfLines={1}
          >
            {slide.pageLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ScanCameraScreen({ navigation, route }: Props) {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const libraryPromoPagerWidth = windowWidth - FROM_LIBRARY_MODAL_HORIZONTAL_PAD * 2;
  const libraryPromoCardWidth = Math.round(libraryPromoPagerWidth * FROM_LIBRARY_CARD_WIDTH_RATIO);
  const libraryPromoItemStride = libraryPromoCardWidth + FROM_LIBRARY_CARD_PEEK_PX;
  const libraryPromoCarouselHeight =
    FROM_LIBRARY_MODAL_CARD_MIN_HEIGHT + FROM_LIBRARY_CARD_TO_DOTS_GAP + 18;
  const libraryModalSheetMaxHeight = Math.round(windowHeight * FROM_LIBRARY_MODAL_SHEET_MAX_HEIGHT_RATIO);

  /** Vertical gap between scan page sections (title, picker, camera, CTA, etc.). */
  const SCAN_PAGE_SECTION_GAP = 12;

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

  const {
    books,
    scans,
    activeBookId,
    setActiveBookId,
    addOrActivateBook,
    updateBookChapterRanges,
    setIsCoverProcessing,
  } = useScanContext();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const contentsCameraRef = useRef<CameraView | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  /** Keeps Modal mounted until close animation finishes. */
  const [bookPickerMounted, setBookPickerMounted] = useState(false);
  const bookPickerBackdropOp = useRef(new Animated.Value(0)).current;
  const bookPickerSheetTranslate = useRef(new Animated.Value(0)).current;
  const bookPickerWasOpenRef = useRef(false);
  /** Lifts the book sheet above the keyboard (transparent Modal + bottom sheet). */
  const [bookPickerKeyboardPad, setBookPickerKeyboardPad] = useState(0);
  const [lastExtractPreviewExpanded, setLastExtractPreviewExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  /** True while adding a book from Library (or auto-open): capture → crop → metadata, not page scan. */
  const [addingAnotherBookCover, setAddingAnotherBookCover] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  /** Page scan: camera + capture live in a bottom sheet instead of inline. */
  const [pageScanSheetVisible, setPageScanSheetVisible] = useState(false);
  /** Same sheet UI for page scans vs add-another-book (Library). */
  const [pageScanSheetPurpose, setPageScanSheetPurpose] = useState<"page" | "bookCover">("page");
  const [pageScanSheetCameraReady, setPageScanSheetCameraReady] = useState(false);
  const pageScanSheetY = useRef(new Animated.Value(480)).current;
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
  const [isGalleryOpening, setIsGalleryOpening] = useState(false);
  const [showGalleryDropTarget, setShowGalleryDropTarget] = useState(false);
  const [isDraggingTowardGallery, setIsDraggingTowardGallery] = useState(false);
  const [isGalleryDropArmed, setIsGalleryDropArmed] = useState(false);
  const [lockScrollForAddGesture, setLockScrollForAddGesture] = useState(false);
  const [isContentsScannerOpen, setIsContentsScannerOpen] = useState(false);
  const [isChapterOverviewOpen, setIsChapterOverviewOpen] = useState(false);
  const [contentsScanAppend, setContentsScanAppend] = useState(false);
  const [contentsExtracting, setContentsExtracting] = useState(false);
  const [contentsExtractError, setContentsExtractError] = useState<string | null>(null);
  const [chapterEditVisible, setChapterEditVisible] = useState(false);
  const [chapterEditSortedIndex, setChapterEditSortedIndex] = useState<number | null>(null);
  const [chapterEditTitle, setChapterEditTitle] = useState("");
  const [chapterEditStart, setChapterEditStart] = useState("");
  const [chapterEditEnd, setChapterEditEnd] = useState("");
  const chapterEditSheetY = useRef(new Animated.Value(360)).current;
  const chapterMapBookPickerY = useRef(new Animated.Value(420)).current;
  const [chapterMapBookPickerVisible, setChapterMapBookPickerVisible] = useState(false);
  const [readingTimerModalVisible, setReadingTimerModalVisible] = useState(false);
  /** `null` = All books with scans. */
  const [libraryPromoFilterBookId, setLibraryPromoFilterBookId] = useState<string | null>(null);
  const [libraryPromoModalVisible, setLibraryPromoModalVisible] = useState(false);
  const [libraryPromoSwipeHintVisible, setLibraryPromoSwipeHintVisible] = useState(false);
  const [libraryWidgetHighlightTeaser, setLibraryWidgetHighlightTeaser] = useState<string | null>(null);
  const libraryPromoListRef = useRef<FlatList<LibraryPromoSlide> | null>(null);
  /** Last snapped carousel index; `null` until first settle after modal open (avoids sound on open). */
  const libraryPromoSnapIndexRef = useRef<number | null>(null);
  const libraryModalSheetTranslateY = useRef(new Animated.Value(0)).current;
  const addGestureStartYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsFirstBook = books.length === 0;
  const { sessions: readingTimerSessions } = useReadingSession();

  const { readingSessionsThisWeekCount, readingTimerWeekDotFlags } = useMemo(() => {
    const monday = startOfCalendarWeekMonday(new Date());
    const weekStart = monday.getTime();
    const weekEnd = weekStart + 7 * 86400000;
    const count = readingTimerSessions.filter((s) => {
      const t = new Date(s.endedAt).getTime();
      return t >= weekStart && t < weekEnd;
    }).length;
    const flags = readingSessionWeekDotsFromSessions(readingTimerSessions, monday);
    return { readingSessionsThisWeekCount: count, readingTimerWeekDotFlags: flags };
  }, [readingTimerSessions]);

  const readingTimerLastSessionTeaser = useMemo(
    () => formatReadingTimerWidgetSessionTeaser(readingTimerSessions, books),
    [readingTimerSessions, books]
  );

  const bookPickerHideShift = useMemo(() => Math.ceil(windowHeight * 0.65), [windowHeight]);

  useEffect(() => {
    if (isBookModalOpen) {
      bookPickerWasOpenRef.current = true;
      setBookPickerMounted(true);
      bookPickerBackdropOp.setValue(0);
      bookPickerSheetTranslate.setValue(bookPickerHideShift);
      const id = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(bookPickerBackdropOp, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(bookPickerSheetTranslate, {
            toValue: 0,
            friction: 9,
            tension: 70,
            useNativeDriver: true,
          }),
        ]).start();
      });
      return () => cancelAnimationFrame(id);
    }
    if (!bookPickerWasOpenRef.current) {
      return;
    }
    bookPickerWasOpenRef.current = false;
    Animated.parallel([
      Animated.timing(bookPickerBackdropOp, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bookPickerSheetTranslate, {
        toValue: bookPickerHideShift,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setBookPickerMounted(false);
      }
    });
  }, [isBookModalOpen, bookPickerHideShift, bookPickerBackdropOp, bookPickerSheetTranslate]);

  useEffect(() => {
    if (!bookPickerMounted) {
      setBookPickerKeyboardPad(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: { endCoordinates: { height: number } }) => {
      setBookPickerKeyboardPad(e.endCoordinates.height);
    };
    const onHide = () => setBookPickerKeyboardPad(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [bookPickerMounted]);

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
      setIsCoverProcessing(true);
      setCoverExtracting(true);
      setCoverExtractError(null);
      try {
        const metadata = await extractBookMetadataFromImage(coverUri);
        addOrActivateBook({
          title: metadata.title,
          author: metadata.author,
          coverUri,
        });
        setAddingAnotherBookCover(false);
        setIsCameraOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read the cover.";
        setCoverExtractError(message);
      } finally {
        setIsCoverProcessing(false);
        setCoverExtracting(false);
      }
    },
    [addOrActivateBook, setIsCoverProcessing]
  );

  const activeBook = books.find((book) => book.id === activeBookId) ?? null;
  const savedChapterRangeCount = activeBook?.chapterRanges?.length ?? 0;

  const lastExtractedScan = useMemo((): ScanItem | null => {
    if (books.length === 0) return null;
    const sorted = [...scans].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (activeBookId) {
      const forActive = sorted.find((s) => s.bookId === activeBookId);
      if (forActive) return forActive;
    }
    return sorted[0] ?? null;
  }, [scans, activeBookId, books.length]);

  const lastExtractMainIdeas = useMemo(() => {
    if (!lastExtractedScan) return [];
    return lastExtractedScan.notes.mainIdeas
      .map((s) => stripMarkdownBoldMarkers(s).trim())
      .filter(Boolean);
  }, [lastExtractedScan]);

  const lastExtractSummaryFallback = useMemo(() => {
    if (!lastExtractedScan || lastExtractMainIdeas.length > 0) return null;
    const s = stripMarkdownBoldMarkers(lastExtractedScan.notes.summary).trim();
    return s || null;
  }, [lastExtractedScan, lastExtractMainIdeas.length]);

  useEffect(() => {
    setLastExtractPreviewExpanded(false);
  }, [lastExtractedScan?.id]);

  const recentScanSlots = useMemo((): ScanItem[] => {
    if (!activeBookId) return [];
    return scans
      .filter((s) => s.bookId === activeBookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [scans, activeBookId]);

  const pagesScannedThisWeek = useMemo(() => {
    const startMs = startOfCalendarWeekMonday(new Date()).getTime();
    return scans.filter((s) => new Date(s.createdAt).getTime() >= startMs).length;
  }, [scans]);

  const lastExtractChapterLabel = useMemo(() => {
    if (!lastExtractedScan) return null;
    const c = lastExtractedScan.chapter?.trim();
    return c || null;
  }, [lastExtractedScan]);

  const onRecentSeeAll = useCallback(() => {
    if (!activeBookId) return;
    Haptics.selectionAsync().catch(() => {});
    navigation.getParent()?.navigate("Library", {
      screen: "BookReports",
      params: { bookId: activeBookId },
    });
  }, [navigation, activeBookId]);

  const onRecentScanCardPress = useCallback(
    (scan: ScanItem) => {
      Haptics.selectionAsync().catch(() => {});
      navigation.navigate("ReportDetails", { item: scan });
    },
    [navigation]
  );

  const onOpenLastExtractFullReport = useCallback(() => {
    if (!lastExtractedScan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate("ReportDetails", { item: lastExtractedScan });
  }, [navigation, lastExtractedScan]);

  const bookIdsWithScans = useMemo(() => {
    const set = new Set<string>();
    for (const s of scans) {
      if (s.bookId) set.add(s.bookId);
    }
    return set;
  }, [scans]);

  const scannedBooksForPromo = useMemo(
    () => books.filter((b) => bookIdsWithScans.has(b.id)),
    [books, bookIdsWithScans]
  );

  const libraryPromoBaseScans = useMemo(
    () => scans.filter((s) => s.bookId && bookIdsWithScans.has(s.bookId)),
    [scans, bookIdsWithScans]
  );

  const libraryPromoFilteredScans = useMemo(() => {
    if (!libraryPromoFilterBookId) {
      return libraryPromoBaseScans;
    }
    return scans.filter((s) => s.bookId === libraryPromoFilterBookId);
  }, [scans, libraryPromoFilterBookId, libraryPromoBaseScans]);

  const libraryPromoSlides = useMemo(
    () => buildLibraryPromoSlides(libraryPromoFilteredScans),
    [libraryPromoFilteredScans]
  );

  const onLibraryPromoMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (libraryPromoSlides.length <= 1) return;
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / libraryPromoItemStride);
      const clamped = Math.max(0, Math.min(idx, libraryPromoSlides.length - 1));
      const prev = libraryPromoSnapIndexRef.current;
      if (prev !== null && prev !== clamped) {
        playSoundEffect("swipeBetweenFromYourLibraryCards");
      }
      libraryPromoSnapIndexRef.current = clamped;
    },
    [libraryPromoItemStride, libraryPromoSlides.length]
  );

  useEffect(() => {
    if (libraryPromoModalVisible) {
      libraryPromoSnapIndexRef.current = null;
    }
  }, [libraryPromoModalVisible]);

  useFocusEffect(
    useCallback(() => {
      if (libraryPromoSlides.length === 0) {
        setLibraryWidgetHighlightTeaser(null);
        return;
      }
      const slide = libraryPromoSlides[Math.floor(Math.random() * libraryPromoSlides.length)];
      const t = normalizeWidgetHighlightTeaser(slide.text);
      setLibraryWidgetHighlightTeaser(t.length > 0 ? t : null);
    }, [libraryPromoSlides])
  );

  const libraryWidgetBookCount = useMemo(
    () =>
      new Set(libraryPromoBaseScans.map((s) => s.bookId).filter((id): id is string => Boolean(id))).size,
    [libraryPromoBaseScans]
  );

  useEffect(() => {
    if (!libraryPromoModalVisible) return;
    const id = requestAnimationFrame(() => {
      libraryPromoListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [libraryPromoModalVisible, libraryPromoFilterBookId]);

  useEffect(() => {
    if (!libraryPromoModalVisible) return;
    libraryModalSheetTranslateY.setValue(0);
    let cancelled = false;
    AsyncStorage.getItem(FROM_LIBRARY_SWIPE_HINT_STORAGE_KEY).then((raw) => {
      if (!cancelled) setLibraryPromoSwipeHintVisible(raw !== "1");
    });
    return () => {
      cancelled = true;
    };
  }, [libraryPromoModalVisible, libraryModalSheetTranslateY]);

  const dismissLibraryPromoSwipeHint = useCallback(() => {
    setLibraryPromoSwipeHintVisible(false);
    AsyncStorage.setItem(FROM_LIBRARY_SWIPE_HINT_STORAGE_KEY, "1").catch(() => {});
  }, []);

  const libraryModalPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) libraryModalSheetTranslateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 64 || g.vy > 1.1) {
            setLibraryPromoModalVisible(false);
            libraryModalSheetTranslateY.setValue(0);
            return;
          }
          Animated.spring(libraryModalSheetTranslateY, {
            toValue: 0,
            friction: 9,
            tension: 80,
            useNativeDriver: true,
          }).start();
        },
      }),
    [libraryModalSheetTranslateY]
  );

  const onLibraryPromoLongPressOpenReport = useCallback(
    (slide: LibraryPromoSlide) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setLibraryPromoModalVisible(false);
      navigation.navigate("ReportDetails", { item: slide.scan });
    },
    [navigation]
  );

  const chapterMapRows = useMemo(() => {
    if (!isChapterOverviewOpen || !activeBook?.chapterRanges?.length) return [];
    const sorted = [...activeBook.chapterRanges].sort((a, b) => a.startPage - b.startPage);
    return sorted.map((range, index) => {
      const next = sorted[index + 1];
      const displayEnd =
        range.endPage ??
        (next && next.startPage > range.startPage ? next.startPage - 1 : undefined);
      return { range, displayEnd };
    });
  }, [isChapterOverviewOpen, activeBook?.chapterRanges]);

  /** Row index (sorted) gets a warning when the previous chapter’s effective end ≥ this chapter’s start. */
  const chapterMapOverlapWarningIndices = useMemo(() => {
    if (!isChapterOverviewOpen || !activeBook?.chapterRanges?.length) {
      return new Set<number>();
    }
    const sorted = [...activeBook.chapterRanges].sort((a, b) => a.startPage - b.startPage);
    const warn = new Set<number>();
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const inferredEnd =
        curr.endPage ??
        (next.startPage > curr.startPage ? next.startPage - 1 : undefined);
      const effectiveEnd = inferredEnd ?? curr.startPage;
      if (effectiveEnd >= next.startPage) {
        warn.add(i + 1);
      }
    }
    return warn;
  }, [isChapterOverviewOpen, activeBook?.chapterRanges]);

  const openChapterOverview = () => {
    if (!activeBook) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsChapterOverviewOpen(true);
  };

  const dismissChapterEditSheet = useCallback(() => {
    Animated.timing(chapterEditSheetY, {
      toValue: 360,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setChapterEditVisible(false);
        setChapterEditSortedIndex(null);
      }
    });
  }, [chapterEditSheetY]);

  const openChapterEditSheet = useCallback((sortedIndex: number, range: ChapterRange) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setChapterEditSortedIndex(sortedIndex);
    setChapterEditTitle(range.title);
    setChapterEditStart(String(range.startPage));
    setChapterEditEnd(range.endPage != null ? String(range.endPage) : "");
    setChapterEditVisible(true);
  }, []);

  useEffect(() => {
    if (!chapterEditVisible) {
      return;
    }
    chapterEditSheetY.setValue(360);
    Animated.spring(chapterEditSheetY, {
      toValue: 0,
      friction: 9,
      tension: 64,
      useNativeDriver: true,
    }).start();
  }, [chapterEditVisible, chapterEditSheetY]);

  useEffect(() => {
    if (!isChapterOverviewOpen) {
      setChapterEditVisible(false);
      setChapterEditSortedIndex(null);
      chapterEditSheetY.setValue(360);
      setChapterMapBookPickerVisible(false);
      chapterMapBookPickerY.setValue(420);
    }
  }, [isChapterOverviewOpen, chapterEditSheetY, chapterMapBookPickerY]);

  const dismissChapterMapBookPicker = useCallback(() => {
    Animated.timing(chapterMapBookPickerY, {
      toValue: 420,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setChapterMapBookPickerVisible(false);
      }
    });
  }, [chapterMapBookPickerY]);

  const openChapterMapBookPicker = useCallback(() => {
    if (books.length < 2 || chapterEditVisible) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setChapterMapBookPickerVisible(true);
  }, [books.length, chapterEditVisible]);

  useEffect(() => {
    if (!chapterMapBookPickerVisible) {
      return;
    }
    chapterMapBookPickerY.setValue(420);
    Animated.spring(chapterMapBookPickerY, {
      toValue: 0,
      friction: 9,
      tension: 64,
      useNativeDriver: true,
    }).start();
  }, [chapterMapBookPickerVisible, chapterMapBookPickerY]);

  const saveChapterEdit = useCallback(() => {
    if (!activeBook || chapterEditSortedIndex === null) return;
    const start = parseInt(chapterEditStart.replace(/\D/g, ""), 10);
    if (!Number.isFinite(start) || start < 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    const endDigits = chapterEditEnd.replace(/\D/g, "");
    let endPage: number | undefined;
    if (endDigits) {
      const e = parseInt(endDigits, 10);
      if (!Number.isFinite(e) || e < 1) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }
      if (e < start) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }
      endPage = e;
    }
    const sorted = [...(activeBook.chapterRanges ?? [])].sort((a, b) => a.startPage - b.startPage);
    const updated: ChapterRange = {
      title: chapterEditTitle.trim() || "Untitled",
      startPage: start,
      ...(endPage !== undefined ? { endPage } : {}),
    };
    const next = sorted.map((r, i) => (i === chapterEditSortedIndex ? updated : r));
    updateBookChapterRanges(activeBook.id, next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    dismissChapterEditSheet();
  }, [
    activeBook,
    chapterEditEnd,
    chapterEditSortedIndex,
    chapterEditStart,
    chapterEditTitle,
    dismissChapterEditSheet,
    updateBookChapterRanges,
  ]);
  const filteredBooks = useMemo(() => {
    const scannable = books.filter((b) => !b.isRead);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return scannable;
    return scannable.filter((book) => {
      const title = book.title.toLowerCase();
      const author = book.author.toLowerCase();
      return title.includes(query) || author.includes(query);
    });
  }, [books, searchQuery]);

  const bookPickerEmptyMessage = useMemo(() => {
    const hasScannable = books.some((b) => !b.isRead);
    if (!hasScannable) {
      return "All books are marked as read. Unmark a book in the Library to scan into it.";
    }
    return "No books match your search.";
  }, [books]);

  useEffect(() => {
    setTipIndex(0);
  }, [needsFirstBook]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((current) => (current + 1) % frameTips.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [frameTips.length]);

  const dismissPageScanSheet = useCallback(() => {
    const wasBookCover = pageScanSheetPurpose === "bookCover";
    Animated.timing(pageScanSheetY, {
      toValue: 480,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPageScanSheetVisible(false);
        setPageScanSheetPurpose("page");
        if (wasBookCover) {
          setAddingAnotherBookCover(false);
        }
      }
    });
  }, [pageScanSheetPurpose, pageScanSheetY]);

  useEffect(() => {
    if (!pageScanSheetVisible) {
      setPageScanSheetCameraReady(false);
      return;
    }
    setPageScanSheetCameraReady(false);
    pageScanSheetY.setValue(480);
    Animated.spring(pageScanSheetY, {
      toValue: 0,
      friction: 9,
      tension: 64,
      useNativeDriver: true,
    }).start();
  }, [pageScanSheetVisible, pageScanSheetY]);

  const navigateToExtractionOptions = useCallback(
    (imageUri: string) => {
      setIsCameraOpen(false);
      setPageScanSheetVisible(false);
      navigation.navigate("CropPhoto", { imageUri });
    },
    [navigation]
  );

  const navigateToBookCoverCrop = useCallback(
    (imageUri: string) => {
      setIsCameraOpen(false);
      setPageScanSheetVisible(false);
      navigation.navigate("CropPhoto", { imageUri, purpose: "bookCover" });
    },
    [navigation]
  );

  useEffect(() => {
    if (!route.params?.autoOpenCoverCamera || books.length === 0) return;
    setCoverExtractError(null);
    setAddingAnotherBookCover(true);
    setIsCameraOpen(false);
    setPageScanSheetPurpose("bookCover");
    setPageScanSheetVisible(true);
    navigation.setParams({ autoOpenCoverCamera: undefined });
  }, [books.length, navigation, route.params?.autoOpenCoverCamera]);

  useEffect(() => {
    const uri = route.params?.bookCoverCropResultUri;
    if (!uri) return;
    navigation.setParams({ bookCoverCropResultUri: undefined });
    void processCoverFromUri(uri);
  }, [navigation, processCoverFromUri, route.params?.bookCoverCropResultUri]);

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

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsCameraOpen(false);
        setPageScanSheetVisible(false);
        pageScanSheetY.setValue(480);
        const state = navigation.getState();
        const top = state.routes[state.index];
        if (top?.name !== "CropPhoto") {
          setAddingAnotherBookCover(false);
        }
      };
    }, [navigation, pageScanSheetY])
  );

  const onPickFromGallery = async () => {
    if (coverExtracting) return;
    setIsGalleryOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isCameraOpen) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setScanPillActive("gallery");
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: !addingAnotherBookCover,
        quality: 0.9,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (needsFirstBook) {
          await processCoverFromUri(uri);
        } else if (addingAnotherBookCover) {
          setPageScanSheetVisible(false);
          navigateToBookCoverCrop(uri);
        } else {
          setPageScanSheetVisible(false);
          navigateToExtractionOptions(uri);
        }
      } else if (isCameraOpen) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setScanPillActive("lens");
      }
    } finally {
      setIsGalleryOpening(false);
    }
  };

  useEffect(() => {
    if (isCameraOpen) {
      setIsGalleryOpening(false);
    }
  }, [isCameraOpen]);

  const onAddBookLongPress = () => {
    if (!needsFirstBook || isCameraOpen || coverExtracting) return;
    setShowGalleryDropTarget(true);
    void ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  const onAddBookTouchStart = (event: GestureResponderEvent) => {
    if (!needsFirstBook || isCameraOpen || coverExtracting) return;
    addGestureStartYRef.current = event.nativeEvent.pageY;
    setLockScrollForAddGesture(true);
    setIsGalleryDropArmed(false);
    setIsDraggingTowardGallery(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      onAddBookLongPress();
    }, 160);
  };

  const onAddBookTouchMove = (event: GestureResponderEvent) => {
    if (!showGalleryDropTarget || !needsFirstBook || isCameraOpen) return;
    const dragDistance = event.nativeEvent.pageY - addGestureStartYRef.current;
    setIsDraggingTowardGallery(dragDistance >= 12);
    setIsGalleryDropArmed(dragDistance >= 28);
  };

  const onAddBookTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const shouldOpenGallery = showGalleryDropTarget && isGalleryDropArmed && needsFirstBook && !isCameraOpen;
    setShowGalleryDropTarget(false);
    setIsDraggingTowardGallery(false);
    setIsGalleryDropArmed(false);
    setLockScrollForAddGesture(false);
    if (shouldOpenGallery) {
      void onPickFromGallery();
    }
  };

  const onCapture = async () => {
    setIsGalleryOpening(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (needsFirstBook) {
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
      playSoundEffect("takePhoto");
      await processCoverFromUri(photo.uri);
      return;
    }

    if (addingAnotherBookCover) {
      if (pageScanSheetVisible) {
        return;
      }
      setCoverExtractError(null);
      setIsCameraOpen(false);
      setPageScanSheetPurpose("bookCover");
      setPageScanSheetVisible(true);
      return;
    }

    if (pageScanSheetVisible) {
      return;
    }
    setCoverExtractError(null);
    setIsCameraOpen(false);
    setPageScanSheetPurpose("page");
    setPageScanSheetVisible(true);
  };

  const onCapturePageFromSheet = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.9,
      skipProcessing: true,
    });
    if (!photo?.uri) return;
    playSoundEffect("takePhoto");
    if (pageScanSheetPurpose === "bookCover") {
      navigateToBookCoverCrop(photo.uri);
      return;
    }
    navigateToExtractionOptions(photo.uri);
  };

  const selectedLens = useMemo(() => {
    if (Platform.OS !== "ios") return undefined;
    const { ultraWide, wide } = iosLensRoles;
    if (lensMode === "0.5x") {
      return ultraWide ?? wide ?? undefined;
    }
    return wide ?? ultraWide ?? undefined;
  }, [lensMode, iosLensRoles]);

  const onOpenContentsScanner = (opts?: { append?: boolean }) => {
    if (!activeBook) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setContentsExtractError(null);
    setIsCameraOpen(false);
    setContentsScanAppend(opts?.append ?? false);
    setIsContentsScannerOpen(true);
  };

  const onOpenContentsScannerFromOverview = () => {
    const append = (activeBook?.chapterRanges?.length ?? 0) > 0;
    setIsChapterOverviewOpen(false);
    onOpenContentsScanner({ append });
  };

  const onCaptureContents = async () => {
    if (!activeBook || contentsExtracting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setContentsExtracting(true);
    setContentsExtractError(null);
    try {
      const photo = await contentsCameraRef.current?.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
      });
      if (!photo?.uri) return;
      playSoundEffect("takePhoto");
      const extracted = await extractChapterRangesFromContentsImage(photo.uri);
      const existing = activeBook.chapterRanges ?? [];
      const next =
        contentsScanAppend && existing.length > 0
          ? mergeChapterRanges(existing, extracted)
          : extracted;
      updateBookChapterRanges(activeBook.id, next);
      setContentsScanAppend(false);
      setIsContentsScannerOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not read the contents page.";
      setContentsExtractError(message);
    } finally {
      setContentsExtracting(false);
    }
  };

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
        contentContainerStyle={[
          styles.scrollContent,
          styles.scrollContentFlex,
          { gap: SCAN_PAGE_SECTION_GAP },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showGalleryDropTarget && !lockScrollForAddGesture}
      >
        <View style={styles.scanPageTitleWrap}>
          <HeaderText
            title={
              needsFirstBook ? "Add your first book" : addingAnotherBookCover ? "Add another book" : "Scan Page"
            }
            subtitle={
              needsFirstBook
                ? "Scan the cover to add title and author. Then you can scan pages."
                : addingAnotherBookCover
                  ? "Photograph the front cover. You can crop before title and author are read."
                  : undefined
            }
            style={styles.scanPageHeaderBlock}
            titleStyle={{ fontFamily: FONT_CANELA_TEXT_BOLD, fontWeight: "400" }}
            trailing={<StreakBadge />}
            belowTitle={
              !needsFirstBook && !addingAnotherBookCover ? (
                <Text style={[styles.pagesScannedThisWeekLine, darkMode && styles.pagesScannedThisWeekLineDark]}>
                  {pagesScannedThisWeek === 1
                    ? "1 page scanned this week"
                    : `${pagesScannedThisWeek} pages scanned this week`}
                </Text>
              ) : undefined
            }
          />
        </View>

        {books.length > 0 ? (
          <TouchableOpacity
            style={[styles.scanIntoBookRow, darkMode && styles.scanIntoBookRowDark]}
            onPress={() => setIsBookModalOpen(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Choose book to scan into"
          >
            <View style={styles.scanIntoBookRowLeft}>
              <View style={[styles.scanIntoBookDot, { backgroundColor: accentColor }]} />
              <View style={styles.scanIntoBookTextCol}>
                <Text style={[styles.scanIntoBookLabel, darkMode && styles.scanIntoBookLabelDark]}>
                  Scanning into
                </Text>
                <Text
                  style={[styles.scanIntoBookTitle, darkMode && styles.scanIntoBookTitleDark]}
                  numberOfLines={1}
                >
                  {activeBook?.title ?? "Select a book"}
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-down"
              size={16}
              color={darkMode ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.25)"}
            />
          </TouchableOpacity>
        ) : null}

        {needsFirstBook ? (
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
                      <Ionicons
                        name={isGalleryOpening ? "images-outline" : "camera-outline"}
                        size={44}
                        color={accentColor}
                      />
                      <Text style={[styles.cameraClosedTitle, darkMode && styles.cameraClosedTitleDark]}>
                        {isGalleryOpening
                          ? "Gallery is opening"
                          : needsFirstBook
                            ? "Add your first book"
                            : "Add another book"}
                      </Text>
                      <Text style={[styles.cameraClosedHint, darkMode && styles.cameraClosedHintDark]}>
                        {isGalleryOpening
                          ? "Please wait while we open your photo library."
                          : needsFirstBook
                            ? "Tap Add your first book below, then photograph the front cover."
                            : "Open the camera below, then frame the cover. You can crop the photo next."}
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
        ) : null}

        <View style={[styles.sectionBlock, darkMode && styles.sectionBlockDark]}>
          {coverExtractError ? (
            <Text style={[styles.coverExtractError, darkMode && styles.coverExtractErrorDark]}>{coverExtractError}</Text>
          ) : null}
          <View style={styles.primaryButtonGroup}>
            <Pressable
              style={styles.primaryButtonWrap}
              onPress={onCapture}
              onTouchStart={onAddBookTouchStart}
              onTouchMove={onAddBookTouchMove}
              onTouchEnd={onAddBookTouchEnd}
              onTouchCancel={onAddBookTouchEnd}
              disabled={coverExtracting}
            >
              {needsFirstBook || addingAnotherBookCover || coverExtracting ? (
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
                        : "Open camera"}
                  </Text>
                </LinearGradient>
              ) : darkMode ? (
                <View
                  style={[
                    styles.primaryButtonGradient,
                    styles.primaryButtonScanWhite,
                    coverExtracting && styles.primaryButtonGradientDisabled,
                  ]}
                >
                  <Ionicons name="camera" size={22} color="#0f172a" />
                  <Text style={styles.primaryButtonTextOnWhite}>Open camera</Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.primaryButtonGradient,
                    styles.primaryButtonScanDark,
                    coverExtracting && styles.primaryButtonGradientDisabled,
                  ]}
                >
                  <Ionicons name="camera" size={22} color="#ffffff" />
                  <Text style={styles.primaryButtonTextLightOnDark}>Open camera</Text>
                </View>
              )}
            </Pressable>
            {showGalleryDropTarget && needsFirstBook && !isCameraOpen ? (
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
        </View>

        {!needsFirstBook &&
        lastExtractedScan &&
        (lastExtractMainIdeas.length > 0 || lastExtractSummaryFallback) ? (
          <View style={[styles.lastExtractCard, darkMode && styles.lastExtractCardDark]}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setLastExtractPreviewExpanded((v) => !v);
              }}
              style={({ pressed }) => [
                styles.lastExtractHeaderPressable,
                pressed && styles.lastExtractHeaderPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                lastExtractPreviewExpanded ? "Collapse last extracted preview" : "Expand last extracted preview"
              }
            >
              <View style={styles.lastExtractHeaderText}>
                <Text style={[styles.lastExtractEyebrow, darkMode && styles.lastExtractEyebrowDark]}>
                  Last extracted
                </Text>
                <View style={styles.lastExtractTitleRow}>
                  <Text
                    style={[styles.lastExtractBookTitle, darkMode && styles.lastExtractBookTitleDark]}
                    numberOfLines={1}
                  >
                    {books.find((b) => b.id === lastExtractedScan.bookId)?.title ??
                      lastExtractedScan.book?.trim() ??
                      "Book"}
                  </Text>
                  <Text
                    style={[styles.lastExtractPage, darkMode && styles.lastExtractPageDark]}
                    numberOfLines={1}
                  >
                    {formatLastExtractPageLine(lastExtractedScan)}
                  </Text>
                </View>
                {lastExtractChapterLabel ? (
                  <Text
                    style={[styles.lastExtractChapter, darkMode && styles.lastExtractChapterDark]}
                    numberOfLines={1}
                  >
                    {lastExtractChapterLabel}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name={lastExtractPreviewExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={darkMode ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.4)"}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                if (lastExtractPreviewExpanded) return;
                Haptics.selectionAsync().catch(() => {});
                setLastExtractPreviewExpanded(true);
              }}
              style={styles.lastExtractBody}
              accessibilityRole={lastExtractPreviewExpanded ? undefined : "button"}
              accessibilityLabel={
                lastExtractPreviewExpanded ? undefined : "Expand last extracted preview"
              }
            >
              {lastExtractMainIdeas.length > 0 ? (
                (lastExtractPreviewExpanded ? lastExtractMainIdeas : lastExtractMainIdeas.slice(0, 2)).map(
                  (line, i) => (
                    <View key={`${lastExtractedScan.id}-idea-${i}`} style={styles.lastExtractBulletRow}>
                      <Text style={[styles.lastExtractBulletDot, darkMode && styles.lastExtractBulletDotDark]}>
                        •
                      </Text>
                      <Text
                        style={[styles.lastExtractBulletText, darkMode && styles.lastExtractBulletTextDark]}
                        numberOfLines={lastExtractPreviewExpanded ? undefined : 3}
                      >
                        {line}
                      </Text>
                    </View>
                  )
                )
              ) : lastExtractSummaryFallback ? (
                <Text
                  style={[styles.lastExtractBulletText, darkMode && styles.lastExtractBulletTextDark]}
                  numberOfLines={lastExtractPreviewExpanded ? undefined : 4}
                >
                  {lastExtractPreviewExpanded
                    ? lastExtractSummaryFallback
                    : lastExtractSummaryFallback.length > 160
                      ? `${lastExtractSummaryFallback.slice(0, 157)}…`
                      : lastExtractSummaryFallback}
                </Text>
              ) : null}

              {!lastExtractPreviewExpanded &&
              lastExtractMainIdeas.length > 2 &&
              lastExtractMainIdeas.length > 0 ? (
                <Text style={[styles.lastExtractMoreHint, darkMode && styles.lastExtractMoreHintDark]}>
                  +{lastExtractMainIdeas.length - 2} more — tap to expand
                </Text>
              ) : null}
            </Pressable>

            {lastExtractPreviewExpanded ? (
              <Pressable
                onPress={onOpenLastExtractFullReport}
                style={({ pressed }) => [
                  styles.lastExtractFullReportBtn,
                  { backgroundColor: hexWithAlpha(accentColor, pressed ? 0.22 : 0.14) },
                ]}
                accessibilityRole="button"
                accessibilityLabel="View full report for this scan"
              >
                <Text style={[styles.lastExtractFullReportBtnText, { color: accentColor }]}>
                  View full report
                </Text>
                <Ionicons name="arrow-forward" size={16} color={accentColor} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!needsFirstBook ? (
          savedChapterRangeCount > 0 ? (
            <TouchableOpacity
              style={[styles.chapterAssistCompact, darkMode && styles.chapterAssistCompactDark]}
              onPress={openChapterOverview}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Chapter ranges saved, open chapter map"
            >
              <Ionicons name="checkmark-circle" size={15} color={accentColor} />
              <Text
                style={[styles.chapterAssistCompactText, darkMode && styles.chapterAssistCompactTextDark]}
                numberOfLines={1}
              >
                {savedChapterRangeCount} chapter range{savedChapterRangeCount === 1 ? "" : "s"} saved
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={darkMode ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.35)"}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.chapterAssistCard, darkMode && styles.chapterAssistCardDark]}
              onPress={openChapterOverview}
              activeOpacity={0.86}
            >
              <View style={[styles.chapterAssistIcon, { backgroundColor: hexWithAlpha(accentColor, 0.14) }]}>
                <Ionicons name="book-outline" size={20} color={accentColor} />
              </View>
              <View style={styles.chapterAssistCopy}>
                <Text style={[styles.chapterAssistTitle, darkMode && styles.chapterAssistTitleDark]}>
                  Chapter-aware reports
                </Text>
                <Text style={[styles.chapterAssistText, darkMode && styles.chapterAssistTextDark]}>
                  Snap a picture of your book's contents so AI can log chapter page ranges for reports.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={darkMode ? darkColors.textSecondary : lightColors.textMuted} />
            </TouchableOpacity>
          )
        ) : null}

        {!needsFirstBook && books.length > 0 && recentScanSlots.length > 0 ? (
          <View style={styles.recentScansSection}>
            <View style={styles.recentScansHeaderRow}>
              <Text style={[styles.recentScansHeaderLabel, darkMode && styles.recentScansHeaderLabelDark]}>
                Recent scans
              </Text>
              <TouchableOpacity
                onPress={onRecentSeeAll}
                activeOpacity={0.85}
                disabled={!activeBookId}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.recentScansSeeAll,
                    {
                      color: activeBookId
                        ? accentColor
                        : darkMode
                          ? "rgba(255,255,255,0.35)"
                          : "rgba(15,23,42,0.35)",
                    },
                  ]}
                >
                  See all
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentScansCardsRow}>
              {recentScanSlots.map((scan) => (
                <Pressable
                  key={scan.id}
                  style={({ pressed }) => [
                    styles.recentScanCard,
                    pressed && styles.recentScanCardPressed,
                  ]}
                  onPress={() => onRecentScanCardPress(scan)}
                >
                  <View style={styles.recentScanCardInner}>
                    <View style={styles.recentScanCardForeground}>
                      <View style={styles.recentScanCardTop}>
                        <Text style={styles.recentScanPage} numberOfLines={1}>
                          {formatRecentScanPageLine(scan)}
                        </Text>
                        <Text style={styles.recentScanSnippet} numberOfLines={2}>
                          {formatRecentScanSnippet(scan)}
                        </Text>
                      </View>
                      <Text style={styles.recentScanTime} numberOfLines={1}>
                        {formatRecentScanTimestamp(scan.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {!needsFirstBook && books.length > 0 ? (
          !needsFirstBook && scannedBooksForPromo.length > 0 && libraryPromoSlides.length > 0 ? (
            <View style={styles.scanWidgetsGridRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.scanWidgetTile,
                  styles.scanWidgetTileHalf,
                  pressed && styles.scanWidgetTilePressed,
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setReadingTimerModalVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open reading timer, ${readingSessionsThisWeekCount} sessions this week`}
              >
                <View style={styles.scanWidgetTileInner}>
                  <Ionicons
                    name="timer-outline"
                    size={88}
                    color={hexWithAlpha("#f59e0b", 0.08)}
                    style={styles.scanWidgetWatermarkIcon}
                    pointerEvents="none"
                    importantForAccessibility="no"
                  />
                  <View style={styles.scanWidgetTileForeground}>
                    <View>
                      <Text style={styles.scanWidgetBigNumberAmber}>{readingSessionsThisWeekCount}</Text>
                      <Text style={styles.scanWidgetTileCaption}>sessions this week</Text>
                      {readingTimerLastSessionTeaser ? (
                        <Text
                          style={styles.scanWidgetSessionTeaser}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {readingTimerLastSessionTeaser}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.scanWidgetWeekDotsRow}>
                      {readingTimerWeekDotFlags.map((on, i) => (
                        <View
                          key={i}
                          style={[
                            styles.scanWidgetWeekDot,
                            on ? styles.scanWidgetWeekDotOn : styles.scanWidgetWeekDotOff,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.scanWidgetTile,
                  styles.scanWidgetTileHalf,
                  pressed && styles.scanWidgetTilePressed,
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setLibraryPromoModalVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`From your library, ${libraryPromoSlides.length} highlights`}
                accessibilityHint="Opens highlights from your scans"
              >
                <View style={styles.scanWidgetTileInner}>
                  <Ionicons
                    name="library-outline"
                    size={88}
                    color={hexWithAlpha("#a855f7", 0.08)}
                    style={styles.scanWidgetWatermarkIcon}
                    pointerEvents="none"
                    importantForAccessibility="no"
                  />
                  <View style={[styles.scanWidgetTileForeground, styles.scanWidgetLibraryForeground]}>
                    <View>
                      <Text style={styles.scanWidgetBigNumberPurple}>{libraryPromoSlides.length}</Text>
                      <Text style={styles.scanWidgetTileCaption}>
                        {`highlights · ${libraryWidgetBookCount} book${libraryWidgetBookCount === 1 ? "" : "s"}`}
                      </Text>
                    </View>
                    <View style={styles.scanWidgetLibraryTeaserSpacer} />
                    {libraryWidgetHighlightTeaser ? (
                      <Text
                        style={styles.scanWidgetHighlightTeaser}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {libraryWidgetHighlightTeaser}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.scanWidgetTile,
                styles.scanWidgetTileFull,
                pressed && styles.scanWidgetTilePressed,
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setReadingTimerModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open reading timer, ${readingSessionsThisWeekCount} sessions this week`}
            >
              <View style={styles.scanWidgetTileInner}>
                <Ionicons
                  name="timer-outline"
                  size={88}
                  color={hexWithAlpha("#f59e0b", 0.08)}
                  style={styles.scanWidgetWatermarkIcon}
                  pointerEvents="none"
                  importantForAccessibility="no"
                />
                <View style={styles.scanWidgetTileForeground}>
                  <View>
                    <Text style={styles.scanWidgetBigNumberAmber}>{readingSessionsThisWeekCount}</Text>
                    <Text style={styles.scanWidgetTileCaption}>sessions this week</Text>
                    {readingTimerLastSessionTeaser ? (
                      <Text
                        style={styles.scanWidgetSessionTeaser}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {readingTimerLastSessionTeaser}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.scanWidgetWeekDotsRow}>
                    {readingTimerWeekDotFlags.map((on, i) => (
                      <View
                        key={i}
                        style={[
                          styles.scanWidgetWeekDot,
                          on ? styles.scanWidgetWeekDotOn : styles.scanWidgetWeekDotOff,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </Pressable>
          )
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

      <Modal
        visible={isChapterOverviewOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (chapterMapBookPickerVisible) {
            dismissChapterMapBookPicker();
            return;
          }
          if (chapterEditVisible) {
            dismissChapterEditSheet();
            return;
          }
          setIsChapterOverviewOpen(false);
        }}
      >
        <View style={styles.chapterMapRoot}>
          <StatusBar barStyle="light-content" backgroundColor={CHAPTER_MAP_BG} />
          <View style={styles.chapterMapColumn}>
            <View style={[styles.chapterMapHeader, { paddingTop: Math.max(insets.top, 8) }]}>
              <View style={styles.chapterMapHeaderTopRow}>
                <Pressable
                  onPress={() => {
                    if (chapterMapBookPickerVisible) {
                      dismissChapterMapBookPicker();
                      return;
                    }
                    if (chapterEditVisible) {
                      dismissChapterEditSheet();
                      return;
                    }
                    setIsChapterOverviewOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.chapterMapCloseHit,
                    pressed && styles.chapterMapClosePressed,
                  ]}
                  hitSlop={12}
                >
                  <Text style={styles.chapterMapCloseGlyph}>×</Text>
                </Pressable>
                <Text style={styles.chapterMapHeaderLabel} pointerEvents="none">
                  Chapter map
                </Text>
                <View style={styles.chapterMapHeaderBalance} />
              </View>
              {activeBook ? (
                books.length > 1 ? (
                  <Pressable
                    onPress={openChapterMapBookPicker}
                    style={({ pressed }) => [
                      styles.chapterMapBookHeaderTappable,
                      pressed && styles.chapterMapBookHeaderTappablePressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Choose book for chapter map"
                  >
                    <View style={styles.chapterMapBookTitleRow}>
                      <Text
                        style={[styles.chapterMapBookTitle, styles.chapterMapBookTitleWithChevron]}
                        numberOfLines={2}
                      >
                        {activeBook.title}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.4)" />
                    </View>
                    <Text style={styles.chapterMapBookAuthor} numberOfLines={1}>
                      {activeBook.author}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Text style={styles.chapterMapBookTitle} numberOfLines={2}>
                      {activeBook.title}
                    </Text>
                    <Text style={styles.chapterMapBookAuthor} numberOfLines={1}>
                      {activeBook.author}
                    </Text>
                  </>
                )
              ) : null}
            </View>
            <View style={styles.chapterMapDivider} />
            <ScrollView
              style={styles.chapterMapList}
              contentContainerStyle={styles.chapterMapListContent}
              showsVerticalScrollIndicator={false}
            >
              {activeBook && chapterMapRows.length > 0
                ? chapterMapRows.map(({ range, displayEnd }, index) => {
                    const endForLabel = range.endPage ?? displayEnd;
                    const pageLabel = formatChapterMapPageRange(range.startPage, endForLabel);
                    const showOverlapWarn = chapterMapOverlapWarningIndices.has(index);
                    return (
                      <Pressable
                        key={`${range.startPage}-${range.title}-${index}`}
                        onPress={() => openChapterEditSheet(index, range)}
                        android_ripple={{ color: "rgba(255,255,255,0.08)" }}
                        style={({ pressed }) => [
                          styles.chapterMapRow,
                          index > 0 && styles.chapterMapRowBorder,
                          Platform.OS === "ios" && pressed && styles.chapterMapRowPressed,
                        ]}
                      >
                        <View style={styles.chapterMapRowLeft}>
                          <Text style={styles.chapterMapRowTitle} numberOfLines={2}>
                            {(range.title || "Untitled").trim()}
                          </Text>
                          {showOverlapWarn ? (
                            <Text style={styles.chapterMapRowWarn}>
                              Previous chapter ends on or after this start page — adjust pages.
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.chapterMapRowPages}>{pageLabel}</Text>
                      </Pressable>
                    );
                  })
                : null}
              {activeBook && chapterMapRows.length === 0 ? (
                <View style={styles.chapterMapEmptyWrap}>
                  <Text style={styles.chapterMapEmptyTitle}>No chapters yet</Text>
                  <Text style={styles.chapterMapEmptyBody}>
                    Scan the table of contents (or chapter list) from your book. The app records each chapter name and
                    the page where it starts.
                  </Text>
                  <Text style={styles.chapterMapEmptyBody}>
                    Once that map exists, you only need to tell us the printed page number on a scan—we’ll infer the
                    chapter automatically, so your notes and reports stay chapter-aware without extra work.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={[styles.chapterMapFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable
                onPress={onOpenContentsScannerFromOverview}
                disabled={!activeBook}
                style={({ pressed }) => [
                  styles.chapterMapFooterButton,
                  !activeBook && styles.chapterMapFooterButtonDisabled,
                  pressed && activeBook && styles.chapterMapFooterButtonPressed,
                ]}
              >
                <Text style={styles.chapterMapFooterButtonText}>
                  {chapterMapRows.length > 0 ? "Add another page" : "Scan contents page"}
                </Text>
              </Pressable>
            </View>
          </View>

          {chapterEditVisible ? (
            <View style={styles.chapterEditOverlay} pointerEvents="box-none">
              <Pressable style={styles.chapterEditBackdrop} onPress={dismissChapterEditSheet} />
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.chapterEditSheetKeyboard}
                pointerEvents="box-none"
              >
                <Animated.View
                  style={[
                    styles.chapterEditSheet,
                    {
                      paddingBottom: Math.max(insets.bottom, 16),
                      transform: [{ translateY: chapterEditSheetY }],
                    },
                  ]}
                >
                  <View style={styles.chapterEditGrabber} />
                  <Text style={styles.chapterEditSheetTitle}>Edit chapter</Text>
                  <Text style={styles.chapterEditLabel}>Name</Text>
                  <TextInput
                    value={chapterEditTitle}
                    onChangeText={setChapterEditTitle}
                    placeholder="Chapter title"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={styles.chapterEditInput}
                    multiline
                  />
                  <Text style={styles.chapterEditLabel}>Pages</Text>
                  <View style={styles.chapterEditPagesRow}>
                    <TextInput
                      value={chapterEditStart}
                      onChangeText={setChapterEditStart}
                      keyboardType="number-pad"
                      placeholder="Start"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={styles.chapterEditPageInput}
                    />
                    <Text style={styles.chapterEditPageDash}>–</Text>
                    <TextInput
                      value={chapterEditEnd}
                      onChangeText={setChapterEditEnd}
                      keyboardType="number-pad"
                      placeholder="End"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={styles.chapterEditPageInput}
                    />
                  </View>
                  <Text style={styles.chapterEditHint}>Leave end empty to infer from the next chapter.</Text>
                  <Pressable
                    onPress={saveChapterEdit}
                    style={({ pressed }) => [
                      styles.chapterEditSave,
                      pressed && styles.chapterEditSavePressed,
                    ]}
                  >
                    <Text style={styles.chapterEditSaveText}>Save</Text>
                  </Pressable>
                  <Pressable onPress={dismissChapterEditSheet} style={styles.chapterEditCancelWrap}>
                    <Text style={styles.chapterEditCancel}>Cancel</Text>
                  </Pressable>
                </Animated.View>
              </KeyboardAvoidingView>
            </View>
          ) : null}

          {chapterMapBookPickerVisible ? (
            <View style={styles.chapterMapBookPickerOverlay} pointerEvents="box-none">
              <Pressable style={styles.chapterMapBookPickerBackdrop} onPress={dismissChapterMapBookPicker} />
              <View style={styles.chapterMapBookPickerSheetWrap} pointerEvents="box-none">
                <Animated.View
                  style={[
                    styles.chapterMapBookPickerSheet,
                    {
                      paddingBottom: Math.max(insets.bottom, 16),
                      transform: [{ translateY: chapterMapBookPickerY }],
                    },
                  ]}
                >
                  <View style={styles.chapterMapBookPickerGrabber} />
                  <Text style={styles.chapterMapBookPickerSheetTitle}>Choose book</Text>
                  <FlatList
                    data={books}
                    keyExtractor={(item) => item.id}
                    style={styles.chapterMapBookPickerList}
                    keyboardShouldPersistTaps="handled"
                    ItemSeparatorComponent={() => <View style={styles.chapterMapBookPickerSeparator} />}
                    renderItem={({ item }) => {
                      const isActive = item.id === activeBookId;
                      return (
                        <Pressable
                          onPress={() => {
                            setActiveBookId(item.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            dismissChapterMapBookPicker();
                          }}
                          style={({ pressed }) => [
                            styles.chapterMapBookPickerRow,
                            pressed && styles.chapterMapBookPickerRowPressed,
                          ]}
                        >
                          <View style={styles.chapterMapBookPickerRowText}>
                            <Text style={styles.chapterMapBookPickerRowTitle} numberOfLines={2}>
                              {item.title}
                            </Text>
                            <Text style={styles.chapterMapBookPickerRowAuthor} numberOfLines={1}>
                              {item.author}
                            </Text>
                          </View>
                          {isActive ? (
                            <Ionicons name="checkmark-circle" size={20} color="rgba(255,255,255,0.88)" />
                          ) : null}
                        </Pressable>
                      );
                    }}
                  />
                </Animated.View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={pageScanSheetVisible}
        transparent
        animationType="none"
        onRequestClose={dismissPageScanSheet}
        statusBarTranslucent
      >
        <View style={styles.pageScanSheetRoot}>
          <Pressable style={styles.pageScanSheetDim} onPress={dismissPageScanSheet} accessibilityRole="button" />
          <Animated.View
            style={[
              styles.pageScanSheetPanel,
              pageScanSheetPurpose === "bookCover" && styles.pageScanSheetPanelFixed,
              {
                paddingBottom: 16 + insets.bottom,
                ...(pageScanSheetPurpose === "bookCover" ? { height: windowHeight * 0.8 } : null),
                transform: [{ translateY: pageScanSheetY }],
              },
            ]}
          >
            <View style={styles.pageScanSheetGrabber} />
            <Text style={styles.pageScanSheetTitle}>
              {pageScanSheetPurpose === "bookCover" ? "Add another book" : "Scan a page"}
            </Text>
            <Text style={styles.pageScanSheetSubtitle}>
              {pageScanSheetPurpose === "bookCover"
                ? "Point your camera at the front cover. You can crop before we read the title."
                : "Point your camera at the page you want to scan"}
            </Text>
            <View
              style={[
                styles.pageScanPreviewWrap,
                pageScanSheetPurpose === "bookCover"
                  ? styles.pageScanPreviewWrapFill
                  : styles.pageScanPreviewWrapSized,
              ]}
            >
              <CameraView
                ref={cameraRef}
                style={styles.pageScanPreviewCamera}
                facing="back"
                selectedLens={selectedLens}
                zoom={0}
                flash={flashEnabled ? "on" : "off"}
                enableTorch={flashEnabled}
                {...(Platform.OS === "android"
                  ? { ratio: "4:3" as const, videoQuality: "4:3" as const }
                  : {})}
                onCameraReady={() => {
                  setPageScanSheetCameraReady(true);
                  void cameraRef.current?.getAvailableLensesAsync().then((names) => applyAvailableLenses(names));
                }}
                onAvailableLensesChanged={({ lenses }) => applyAvailableLenses(lenses)}
              >
                <PageScanSheetFrameCorners />
                {!pageScanSheetCameraReady ? (
                  <View style={styles.pageScanPreviewPlaceholder} pointerEvents="none">
                    <Ionicons name="camera-outline" size={32} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.pageScanPreviewPlaceholderText}>Camera preview</Text>
                  </View>
                ) : null}
              </CameraView>
            </View>
            <TouchableOpacity
              style={[styles.pageScanTakePhotoBtn, { backgroundColor: accentColor }]}
              onPress={() => void onCapturePageFromSheet()}
              activeOpacity={0.88}
            >
              <Ionicons name="camera" size={20} color="#ffffff" />
              <Text style={styles.pageScanTakePhotoBtnText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pageScanGalleryBtn}
              onPress={() => void onPickFromGallery()}
              disabled={isGalleryOpening || coverExtracting}
              activeOpacity={0.85}
            >
              <Ionicons name="images-outline" size={17} color="rgba(255,255,255,0.75)" />
              <Text style={styles.pageScanGalleryBtnText}>
                {isGalleryOpening ? "Opening gallery…" : "Choose from gallery"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pageScanCancelBtn}
              onPress={dismissPageScanSheet}
              activeOpacity={0.85}
            >
              <Text style={styles.pageScanCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={isContentsScannerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (!contentsExtracting) {
            setContentsScanAppend(false);
            setIsContentsScannerOpen(false);
          }
        }}
      >
        <View style={styles.contentsModalScreen}>
          <CameraView
            ref={contentsCameraRef}
            style={styles.contentsCamera}
            facing="back"
            selectedLens={selectedLens}
            zoom={0}
          >
            <View style={styles.contentsOverlay}>
              <View style={styles.contentsTopBar}>
                <TouchableOpacity
                  style={styles.contentsCloseButton}
                  onPress={() => {
                    setContentsScanAppend(false);
                    setIsContentsScannerOpen(false);
                  }}
                  disabled={contentsExtracting}
                  activeOpacity={0.82}
                >
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.contentsFrame}>
                <Text style={styles.contentsFrameTitle}>
                  {contentsScanAppend ? "Add another contents page" : "Scan the contents page"}
                </Text>
                <Text style={styles.contentsFrameText}>
                  {contentsScanAppend
                    ? "Capture the next part of your table of contents. New chapters will be merged with what you already have."
                    : "Fit the chapter list and page numbers inside the frame."}
                </Text>
              </View>

              {contentsExtractError ? (
                <View style={styles.contentsErrorBox}>
                  <Text style={styles.contentsErrorText}>{contentsExtractError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.contentsCaptureButton}
                onPress={onCaptureContents}
                disabled={contentsExtracting}
                activeOpacity={0.9}
              >
                {contentsExtracting ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Ionicons name="scan-outline" size={22} color="#0f172a" />
                )}
                <Text style={styles.contentsCaptureText}>
                  {contentsExtracting ? "Reading contents..." : "Scan contents"}
                </Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>

      <Modal
        visible={bookPickerMounted}
        transparent
        animationType="none"
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsBookModalOpen(false);
          setSearchQuery("");
        }}
      >
        <View style={styles.bookPickerModalRoot}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: darkColors.overlay, opacity: bookPickerBackdropOp },
            ]}
          />
          <View style={styles.bookPickerModalContent}>
            <Pressable
              style={styles.bookPickerModalBackdrop}
              onPress={() => {
                Keyboard.dismiss();
                setIsBookModalOpen(false);
                setSearchQuery("");
              }}
            />
            <Animated.View
              style={[
                styles.bookPickerSheet,
                darkMode && styles.bookPickerSheetDark,
                {
                  paddingBottom: Math.max(insets.bottom, 14),
                  marginBottom: bookPickerKeyboardPad,
                },
                { transform: [{ translateY: bookPickerSheetTranslate }] },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Select Book</Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsBookModalOpen(false);
                    setSearchQuery("");
                  }}
                >
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
                style={[styles.bookPickerList, { maxHeight: windowHeight * 0.62 }]}
                renderItem={({ item }) => {
                  const isActive = item.id === activeBookId;
                  return (
                    <TouchableOpacity
                      style={[styles.bookRow, darkMode && styles.bookRowDark]}
                      onPress={() => {
                        Keyboard.dismiss();
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
                    {bookPickerEmptyMessage}
                  </Text>
                }
              />
            </Animated.View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={libraryPromoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLibraryPromoModalVisible(false)}
      >
        <View style={styles.fromLibraryModalRoot}>
          <Pressable
            style={styles.fromLibraryModalBackdrop}
            onPress={() => setLibraryPromoModalVisible(false)}
            accessibilityLabel="Dismiss"
          />
          <Animated.View
            style={{ transform: [{ translateY: libraryModalSheetTranslateY }] }}
          >
            <View
              style={[
                styles.fromLibraryModalSheet,
                darkMode && styles.fromLibraryModalSheetDark,
                {
                  maxHeight: libraryModalSheetMaxHeight,
                  paddingBottom: Math.max(insets.bottom, 16),
                  paddingHorizontal: FROM_LIBRARY_MODAL_HORIZONTAL_PAD,
                },
              ]}
            >
              <View
                style={styles.fromLibraryModalHandleZone}
                {...libraryModalPanResponder.panHandlers}
                accessibilityLabel="Sheet handle"
                accessibilityHint="Drag down to close"
              >
                <View
                  style={[
                    styles.fromLibraryModalHandle,
                    darkMode && styles.fromLibraryModalHandleDark,
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.fromLibraryModalTitleCentered,
                  darkMode && styles.fromLibraryModalTitleCenteredDark,
                ]}
                accessibilityRole="header"
              >
                From your library
              </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{
                marginBottom:
                  libraryPromoSwipeHintVisible && libraryPromoSlides.length > 1 ? 6 : FROM_LIBRARY_PILLS_TO_CAROUSEL_GAP,
              }}
              contentContainerStyle={styles.fromLibraryPillsRow}
            >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setLibraryPromoFilterBookId(null);
                }}
                style={({ pressed }) => [
                  styles.fromLibraryPill,
                  libraryPromoFilterBookId === null
                    ? styles.fromLibraryPillSelected
                    : [
                        styles.fromLibraryPillUnselected,
                        !darkMode && styles.fromLibraryPillUnselectedLight,
                      ],
                  pressed && styles.fromLibraryPillPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: libraryPromoFilterBookId === null }}
                accessibilityLabel="All books"
              >
                <Text
                  style={[
                    styles.fromLibraryPillText,
                    libraryPromoFilterBookId === null
                      ? styles.fromLibraryPillTextSelected
                      : [
                          styles.fromLibraryPillTextUnselected,
                          !darkMode && styles.fromLibraryPillTextUnselectedLight,
                        ],
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {scannedBooksForPromo.map((b) => {
                const selected = libraryPromoFilterBookId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setLibraryPromoFilterBookId(b.id);
                    }}
                    style={({ pressed }) => [
                      styles.fromLibraryPill,
                      selected
                        ? styles.fromLibraryPillSelected
                        : [
                            styles.fromLibraryPillUnselected,
                            !darkMode && styles.fromLibraryPillUnselectedLight,
                          ],
                      pressed && styles.fromLibraryPillPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Filter: ${b.title}`}
                  >
                    <Text
                      style={[
                        styles.fromLibraryPillText,
                        selected
                          ? styles.fromLibraryPillTextSelected
                          : [
                              styles.fromLibraryPillTextUnselected,
                              !darkMode && styles.fromLibraryPillTextUnselectedLight,
                            ],
                      ]}
                      numberOfLines={1}
                    >
                      {b.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {libraryPromoSwipeHintVisible && libraryPromoSlides.length > 1 ? (
              <Text
                style={[
                  styles.fromLibraryModalSwipeHint,
                  darkMode && styles.fromLibraryModalSwipeHintDark,
                ]}
              >
                Swipe card to browse
              </Text>
            ) : null}

            <View
              style={[
                styles.fromLibraryModalPagerWrap,
                {
                  marginTop:
                    libraryPromoSwipeHintVisible && libraryPromoSlides.length > 1
                      ? 6
                      : 0,
                  height: libraryPromoCarouselHeight,
                },
              ]}
            >
              <FlatList
                ref={libraryPromoListRef}
                data={libraryPromoSlides}
                horizontal
                snapToInterval={libraryPromoItemStride}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `${item.scan.id}-${item.kind}-${index}`}
                getItemLayout={(_, index) => ({
                  length: libraryPromoItemStride,
                  offset: libraryPromoItemStride * index,
                  index,
                })}
                onScrollBeginDrag={dismissLibraryPromoSwipeHint}
                onMomentumScrollEnd={onLibraryPromoMomentumScrollEnd}
                style={[styles.fromLibraryModalPager, { height: libraryPromoCarouselHeight }]}
                contentContainerStyle={styles.fromLibraryModalPagerContent}
                renderItem={({ item, index }) => {
                  const dotLayout = libraryPromoDotsLayoutForIndex(libraryPromoSlides.length, index);
                  return (
                    <View
                      style={{
                        width: libraryPromoItemStride,
                        height: libraryPromoCarouselHeight,
                      }}
                    >
                      <FromLibraryPromoHoldCard
                        slide={item}
                        darkMode={darkMode}
                        accentColor={accentColor}
                        cardWidth={libraryPromoCardWidth}
                        minHeight={FROM_LIBRARY_MODAL_CARD_MIN_HEIGHT}
                        onHoldComplete={onLibraryPromoLongPressOpenReport}
                      />
                      {dotLayout.dotCount > 0 ? (
                        <View
                          style={[
                            styles.fromLibraryDotsRow,
                            styles.fromLibraryDotsBelowCard,
                          ]}
                        >
                          {Array.from({ length: dotLayout.dotCount }, (_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.fromLibraryDot,
                                i === dotLayout.activeDot
                                  ? [
                                      styles.fromLibraryDotActive,
                                      !darkMode && styles.fromLibraryDotActiveLight,
                                    ]
                                  : [
                                      styles.fromLibraryDotInactive,
                                      !darkMode && styles.fromLibraryDotInactiveLight,
                                    ],
                              ]}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                }}
              />
            </View>

            <Text
              style={[styles.fromLibraryModalHoldHint, darkMode && styles.fromLibraryModalHoldHintDark]}
            >
              Hold a card for 1 second to open the full report. The bar at the top of the card fills as you
              hold.
            </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <ReadingTimerBottomSheet
        visible={readingTimerModalVisible}
        onDismiss={() => setReadingTimerModalVisible(false)}
      />
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
    paddingTop: 50,
    paddingBottom: 100,
  },
  /** Scroll content fills at least the viewport height when content is short. */
  scrollContentFlex: {
    flexGrow: 1,
  },
  scanPageTitleWrap: {
    marginTop: 0,
  },
  scanPageHeaderBlock: {
    marginBottom: 0,
  },
  pagesScannedThisWeekLine: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: "rgba(15,23,42,0.35)",
    alignSelf: "flex-start",
  },
  pagesScannedThisWeekLineDark: {
    color: "rgba(255,255,255,0.35)",
  },
  sectionBlock: {
    gap: 10,
    width: "100%",
  },
  sectionBlockDark: {},
  cameraShell: {
    borderRadius: 16,
    marginBottom: 8,
    minHeight: 500,
    maxHeight: "84%",
    width: "100%",
    overflow: "hidden",
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
    gap: 8,
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
  scanIntoBookRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderColor: "rgba(0,0,0,0.1)",
  },
  scanIntoBookRowDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  scanIntoBookRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  scanIntoBookDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scanIntoBookTextCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  scanIntoBookLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(15,23,42,0.35)",
  },
  scanIntoBookLabelDark: {
    color: "rgba(255,255,255,0.35)",
  },
  scanIntoBookTitle: {
    fontSize: 14,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: lightColors.textPrimary,
  },
  scanIntoBookTitleDark: {
    color: "#ffffff",
  },
  recentScansSection: {
    width: "100%",
    gap: 10,
  },
  recentScansHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentScansHeaderLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.77,
    color: "rgba(15,23,42,0.3)",
  },
  recentScansHeaderLabelDark: {
    color: "rgba(255,255,255,0.3)",
  },
  recentScansSeeAll: {
    fontSize: 11,
    fontWeight: "600",
  },
  recentScansCardsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    alignItems: "stretch",
  },
  recentScanCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  recentScanCardPressed: {
    opacity: 0.92,
  },
  recentScanCardInner: {
    flex: 1,
    minHeight: 120,
    padding: 12,
  },
  recentScanCardForeground: {
    flex: 1,
    justifyContent: "space-between",
  },
  recentScanCardTop: {
    gap: 4,
  },
  recentScanPage: {
    fontSize: 28,
    fontWeight: "600",
    color: "#ffffff",
  },
  recentScanSnippet: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15,
    color: "rgba(255,255,255,0.45)",
  },
  recentScanTime: {
    fontSize: 10,
    fontWeight: "400",
    color: "rgba(255,255,255,0.3)",
    marginTop: 8,
  },
  scanWidgetsGridRow: {
    marginTop: 14,
    width: "100%",
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  scanWidgetTile: {
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    minHeight: 130,
    overflow: "hidden",
  },
  scanWidgetTileHalf: {
    flex: 1,
    minWidth: 0,
  },
  scanWidgetTileFull: {
    marginTop: 14,
    width: "100%",
    alignSelf: "stretch",
  },
  scanWidgetTilePressed: {
    opacity: 0.92,
  },
  scanWidgetTileInner: {
    flex: 1,
    minHeight: 130,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    position: "relative",
  },
  scanWidgetWatermarkIcon: {
    position: "absolute",
    bottom: -12,
    right: -12,
    zIndex: 0,
  },
  scanWidgetTileForeground: {
    flex: 1,
    justifyContent: "space-between",
    zIndex: 1,
  },
  scanWidgetLibraryForeground: {
    justifyContent: "flex-start",
  },
  scanWidgetBigNumberAmber: {
    fontSize: 36,
    fontWeight: "600",
    color: "#f59e0b",
  },
  scanWidgetBigNumberPurple: {
    fontSize: 36,
    fontWeight: "600",
    color: "#a855f7",
  },
  scanWidgetTileCaption: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
  },
  scanWidgetSessionTeaser: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
  },
  scanWidgetLibraryTeaserSpacer: {
    flex: 1,
    marginTop: 8,
    minHeight: 0,
  },
  scanWidgetHighlightTeaser: {
    fontSize: 11,
    fontStyle: "italic",
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
  },
  scanWidgetWeekDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  scanWidgetWeekDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  scanWidgetWeekDotOn: {
    backgroundColor: "#f59e0b",
  },
  scanWidgetWeekDotOff: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  fromLibraryModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  fromLibraryModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  fromLibraryModalSheet: {
    width: "100%",
    alignSelf: "center",
    flexDirection: "column",
    backgroundColor: lightColors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: lightColors.border,
  },
  fromLibraryModalSheetDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  fromLibraryModalHandleZone: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 10,
  },
  fromLibraryModalHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(15,23,42,0.12)",
  },
  fromLibraryModalHandleDark: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  fromLibraryModalTitleCentered: {
    fontSize: 17,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    textAlign: "center",
    color: lightColors.textPrimary,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  fromLibraryModalTitleCenteredDark: {
    color: "#ffffff",
  },
  fromLibraryModalSwipeHint: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    color: "rgba(15,23,42,0.38)",
    marginBottom: 10,
  },
  fromLibraryModalSwipeHintDark: {
    color: "rgba(255,255,255,0.35)",
  },
  fromLibraryModalPagerWrap: {
    width: "100%",
    alignSelf: "stretch",
  },
  fromLibraryModalPager: {
    width: "100%",
  },
  fromLibraryModalPagerContent: {
    alignItems: "stretch",
  },
  fromLibraryModalCardPressable: {
    alignSelf: "flex-start",
  },
  fromLibraryModalCardInPager: {
    flexGrow: 1,
  },
  fromLibraryCardPressed: {
    opacity: 0.92,
  },
  fromLibraryModalHoldHint: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    color: lightColors.textMuted,
    marginTop: 10,
    paddingHorizontal: 8,
    lineHeight: 17,
  },
  fromLibraryModalHoldHintDark: {
    color: darkColors.textSecondary,
  },
  fromLibraryPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
    flexGrow: 0,
  },
  fromLibraryPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  fromLibraryPillUnselected: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  fromLibraryPillUnselectedLight: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderColor: "rgba(0,0,0,0.1)",
  },
  fromLibraryPillSelected: {
    backgroundColor: "rgba(59,130,246,0.15)",
    borderColor: "rgba(59,130,246,0.3)",
  },
  fromLibraryPillPressed: {
    opacity: 0.9,
  },
  fromLibraryPillText: {
    fontSize: 11,
    fontWeight: "500",
    maxWidth: 200,
  },
  fromLibraryPillTextUnselected: {
    color: "rgba(255,255,255,0.45)",
  },
  fromLibraryPillTextUnselectedLight: {
    color: "rgba(15,23,42,0.45)",
  },
  fromLibraryPillTextSelected: {
    color: "#60a5fa",
  },
  fromLibraryCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  fromLibraryCardLight: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderColor: "rgba(0,0,0,0.08)",
  },
  fromLibraryHoldProgressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    marginBottom: 12,
  },
  fromLibraryHoldProgressTrackLight: {
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  fromLibraryHoldProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  fromLibraryCardKind: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.77,
    color: "rgba(255,255,255,0.3)",
    marginBottom: 8,
  },
  fromLibraryCardKindLight: {
    color: "rgba(15,23,42,0.3)",
  },
  fromLibraryCardBody: {
    fontSize: 14,
    fontWeight: "400",
    color: "#ffffff",
    lineHeight: 22.4,
  },
  fromLibraryCardBodyLight: {
    color: lightColors.textPrimary,
  },
  fromLibraryDivider: {
    marginTop: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  fromLibraryDividerLight: {
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  fromLibraryFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  fromLibraryFooterChapter: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
  },
  fromLibraryFooterPage: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    flexShrink: 0,
  },
  fromLibraryFooterMutedLight: {
    color: "rgba(15,23,42,0.4)",
  },
  fromLibraryDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  fromLibraryDotsBelowCard: {
    marginTop: FROM_LIBRARY_CARD_TO_DOTS_GAP,
  },
  fromLibraryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  fromLibraryDotActive: {
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  fromLibraryDotActiveLight: {
    backgroundColor: "rgba(15,23,42,0.8)",
  },
  fromLibraryDotInactive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  fromLibraryDotInactiveLight: {
    backgroundColor: "rgba(15,23,42,0.2)",
  },
  lastExtractCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderColor: "rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  lastExtractCardDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  lastExtractHeaderPressable: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  lastExtractHeaderPressed: {
    opacity: 0.92,
  },
  lastExtractHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  lastExtractEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.65,
    color: "rgba(15,23,42,0.4)",
  },
  lastExtractEyebrowDark: {
    color: "rgba(255,255,255,0.38)",
  },
  lastExtractTitleRow: {
    gap: 4,
  },
  lastExtractBookTitle: {
    fontSize: 16,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: lightColors.textPrimary,
  },
  lastExtractBookTitleDark: {
    color: "#ffffff",
  },
  lastExtractPage: {
    fontSize: 13,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: "rgba(15,23,42,0.45)",
  },
  lastExtractPageDark: {
    color: "rgba(255,255,255,0.45)",
  },
  lastExtractChapter: {
    marginTop: 4,
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "400",
    color: "rgba(15,23,42,0.4)",
  },
  lastExtractChapterDark: {
    color: "rgba(255,255,255,0.4)",
  },
  lastExtractBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  lastExtractBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  lastExtractBulletDot: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(15,23,42,0.35)",
    lineHeight: 20,
    marginTop: 1,
  },
  lastExtractBulletDotDark: {
    color: "rgba(255,255,255,0.35)",
  },
  lastExtractBulletText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    color: lightColors.textPrimary,
  },
  lastExtractBulletTextDark: {
    color: "rgba(255,255,255,0.88)",
  },
  lastExtractMoreHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(15,23,42,0.45)",
    marginTop: 2,
  },
  lastExtractMoreHintDark: {
    color: "rgba(255,255,255,0.4)",
  },
  lastExtractFullReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 10,
  },
  lastExtractFullReportBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  chapterAssistCard: {
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chapterAssistCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  chapterAssistIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterAssistCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  chapterAssistTitle: {
    color: lightColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  chapterAssistTitleDark: {
    color: darkColors.textPrimary,
  },
  chapterAssistText: {
    color: lightColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  chapterAssistTextDark: {
    color: darkColors.textSecondary,
  },
  chapterAssistCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderColor: "rgba(0,0,0,0.08)",
  },
  chapterAssistCompactDark: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  chapterAssistCompactText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: lightColors.textSecondary,
  },
  chapterAssistCompactTextDark: {
    color: "rgba(255,255,255,0.55)",
  },
  /** Full-bleed behind the column so wide phones / tablets never show seams at the sides. */
  chapterMapRoot: {
    flex: 1,
    width: "100%",
    backgroundColor: CHAPTER_MAP_BG,
  },
  chapterMapColumn: {
    flex: 1,
    width: "100%",
    maxWidth: 390,
    alignSelf: "center",
    backgroundColor: CHAPTER_MAP_BG,
  },
  chapterMapHeader: {
    paddingHorizontal: 0,
  },
  chapterMapHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    minHeight: 44,
  },
  chapterMapCloseHit: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  chapterMapClosePressed: {
    opacity: 0.55,
  },
  chapterMapCloseGlyph: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "400",
    lineHeight: 28,
    marginTop: -2,
  },
  chapterMapHeaderLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 19,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: "#ffffff",
  },
  chapterMapHeaderBalance: {
    width: 44,
    height: 44,
  },
  chapterMapBookHeaderTappable: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  chapterMapBookHeaderTappablePressed: {
    opacity: 0.78,
  },
  chapterMapBookTitleRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    alignSelf: "stretch",
    maxWidth: "100%",
  },
  chapterMapBookTitle: {
    marginTop: 6,
    paddingHorizontal: 20,
    fontSize: 17,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: "#ffffff",
    textAlign: "center",
  },
  chapterMapBookTitleWithChevron: {
    marginTop: 0,
    paddingHorizontal: 0,
    flexShrink: 1,
  },
  chapterMapBookAuthor: {
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 20,
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
  chapterMapDivider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chapterMapList: {
    flex: 1,
    backgroundColor: CHAPTER_MAP_BG,
  },
  chapterMapListContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  chapterMapRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  chapterMapRowLeft: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  chapterMapRowBorder: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  chapterMapRowPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chapterMapRowTitle: {
    fontSize: 13,
    fontFamily: FONT_CANELA_TEXT_BOLD,
    fontWeight: "400",
    color: "#ffffff",
  },
  chapterMapRowWarn: {
    fontSize: 10,
    fontWeight: "500",
    lineHeight: 14,
    color: "rgba(255, 200, 130, 0.92)",
  },
  chapterMapRowPages: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.35)",
    flexShrink: 0,
    marginTop: 2,
  },
  chapterMapEmptyWrap: {
    paddingVertical: 28,
    paddingHorizontal: 22,
    gap: 12,
  },
  chapterMapEmptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  chapterMapEmptyBody: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 21,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  chapterMapFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  chapterMapFooterButton: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    overflow: "hidden",
  },
  chapterMapFooterButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chapterMapFooterButtonDisabled: {
    opacity: 0.35,
  },
  chapterMapFooterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
  },
  chapterMapBookPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    justifyContent: "flex-end",
  },
  chapterMapBookPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  chapterMapBookPickerSheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 31,
  },
  chapterMapBookPickerSheet: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  chapterMapBookPickerGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 14,
  },
  chapterMapBookPickerSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  chapterMapBookPickerList: {
    maxHeight: 320,
  },
  chapterMapBookPickerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chapterMapBookPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  chapterMapBookPickerRowPressed: {
    opacity: 0.82,
  },
  chapterMapBookPickerRowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  chapterMapBookPickerRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  chapterMapBookPickerRowAuthor: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
  },
  chapterEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 24,
    justifyContent: "flex-end",
  },
  chapterEditBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  chapterEditSheetKeyboard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 25,
  },
  chapterEditSheet: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  chapterEditGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 14,
  },
  chapterEditSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 16,
  },
  chapterEditLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 6,
  },
  chapterEditInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
    marginBottom: 16,
    minHeight: 48,
  },
  chapterEditPagesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  chapterEditPageInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
    textAlign: "center",
  },
  chapterEditPageDash: {
    fontSize: 16,
    fontWeight: "400",
    color: "rgba(255,255,255,0.35)",
  },
  chapterEditHint: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.35)",
    marginBottom: 18,
  },
  chapterEditSave: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chapterEditSavePressed: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  chapterEditSaveText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  chapterEditCancelWrap: {
    paddingVertical: 14,
    alignItems: "center",
  },
  chapterEditCancel: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.55)",
  },
  pageScanSheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  pageScanSheetDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  pageScanSheetPanel: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pageScanSheetPanelFixed: {
    flexDirection: "column",
    overflow: "hidden",
  },
  pageScanSheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 10,
  },
  pageScanSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  pageScanSheetSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 10,
  },
  pageScanPreviewWrap: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 10,
  },
  pageScanPreviewWrapSized: {
    width: "82%",
    aspectRatio: 0.7,
    alignSelf: "center",
  },
  pageScanPreviewWrapFill: {
    flex: 1,
    minHeight: 0,
    alignSelf: "stretch",
    width: "100%",
  },
  pageScanPreviewCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  pageScanPreviewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(10,10,10,0.92)",
  },
  pageScanPreviewPlaceholderText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
  },
  pageScanTakePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  pageScanTakePhotoBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  pageScanGalleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  pageScanGalleryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
  },
  pageScanCancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingVertical: 10,
  },
  pageScanCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
  },
  contentsModalScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  contentsCamera: {
    flex: 1,
  },
  contentsOverlay: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 58,
    paddingBottom: 32,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  contentsTopBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  contentsCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  contentsFrame: {
    minHeight: 360,
    borderWidth: 2,
    borderColor: "#fff",
    borderStyle: "dashed",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(15,23,42,0.12)",
  },
  contentsFrameTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  contentsFrameText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  contentsErrorBox: {
    backgroundColor: "rgba(127,29,29,0.92)",
    borderRadius: 12,
    padding: 10,
  },
  contentsErrorText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "600",
  },
  contentsCaptureButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contentsCaptureText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  bookPickerModalRoot: {
    flex: 1,
  },
  bookPickerModalContent: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bookPickerModalBackdrop: {
    flex: 1,
    width: "100%",
  },
  bookPickerSheet: {
    backgroundColor: lightColors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 18,
    gap: 10,
    maxHeight: "90%",
    width: "100%",
  },
  bookPickerSheetDark: {
    backgroundColor: darkColors.card,
  },
  bookPickerList: {
    flexGrow: 1,
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
  primaryButtonGroup: {
    width: "100%",
    gap: 6,
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
    fontFamily: FONT_HELVETICA,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.22)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  /** Scan page (dark): dominant white CTA — no accent gradient. */
  primaryButtonScanWhite: {
    backgroundColor: "#ffffff",
  },
  /** Scan page (light): dominant dark CTA — no accent gradient. */
  primaryButtonScanDark: {
    backgroundColor: "#0f172a",
  },
  primaryButtonTextOnWhite: {
    color: "#0f172a",
    fontFamily: FONT_HELVETICA,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  primaryButtonTextLightOnDark: {
    color: "#ffffff",
    fontFamily: FONT_HELVETICA,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  galleryDropTarget: {
    alignSelf: "stretch",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryDropTargetDark: {
    borderColor: darkColors.border,
    backgroundColor: darkColors.card,
  },
  galleryDropTargetText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  galleryDropTargetTextDark: {
    color: darkColors.textPrimary,
  },
  galleryDropTargetTextActive: {
    color: "#ffffff",
  },
});
