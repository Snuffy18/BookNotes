import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  GestureResponderEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
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
import { useAddBookSheet } from "../context/AddBookSheetContext";
import { useBarcodeScanBookSheet } from "../context/BarcodeScanBookSheetContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING } from "../navigation/rootTabLayout";
import type { ScanStackParamList } from "../navigation/types";
import type { BookItem, ChapterRange, ReadingSession, ScanItem } from "../types/note";
import { BookTotalPageNudgeList } from "../components/BookTotalPageNudgeList";
import { ChapterMapEmptyState } from "../components/ChapterMapEmptyState";
import { HeaderText } from "../components/HeaderText";
import { HandTapIcon } from "../components/HandTapIcon";
import { HomeLockedContent, HOME_LOCKED_BG } from "../components/HomeLockedContent";
import { PageScanSheetFrameCorners } from "../components/PageScanSheetFrameCorners";
import { ScanProcessingHomeWidget } from "../components/ScanProcessingHomeWidget";
import { ReadingTimerActiveBanner } from "../components/ReadingTimerActiveBanner";
import { ReadingTimerBottomSheet } from "../components/ReadingTimerBottomSheet";
import { StreakBadge } from "../components/StreakBadge";
import { takePendingOpenReadingTimerModal } from "../reading/pendingReadingTimerModal";
import { takePendingOpenPageScanModal } from "../scan/pendingPageScanModal";
import { useReadingSession } from "../context/ReadingSessionContext";
import { useStreak } from "../context/StreakContext";
import { useScanContext } from "../context/ScanContext";
import { isEligibleReadingLogSession } from "../reading/readingHistoryStats";
import { extractBookMetadataFromImage, extractChapterRangesFromContentsImage } from "../services/ai";
import { hexWithAlpha } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";
import { FONT_CANELA_TEXT_BOLD, FONT_CANELA_TEXT_REGULAR, FONT_HELVETICA } from "../theme/fonts";
import { playSoundEffect } from "../utils/soundEffects";
import { cropImageToViewfinder, type ViewfinderLayout } from "../utils/cropImageToViewfinder";
import { CAMERA_PICTURE_OPTIONS } from "../utils/cameraCapture";
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

type LibraryPromoKind = "idea" | "quote";

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
  }
  return out;
}

function libraryPromoKindLabel(kind: LibraryPromoKind): string {
  switch (kind) {
    case "idea":
      return "Idea";
    case "quote":
      return "Quote";
  }
}

const LIBRARY_PROMO_DOT_COUNT_CAP = 7;
const FROM_LIBRARY_MODAL_HORIZONTAL_PAD = 18;
const CONTENTS_MODAL_HORIZONTAL_PAD = 20;
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

const CHAPTER_MAP_SHIMMER_ROW_COUNT = 6;
const CHAPTER_MAP_SHIMMER_APPEND_COUNT = 4;

function ChapterMapShimmerRows({
  shimmerX,
  count,
  rowOffset = 0,
}: {
  shimmerX: Animated.Value;
  count: number;
  rowOffset?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const index = rowOffset + i;
        const titleWidth = index % 3 === 0 ? "84%" : index % 3 === 1 ? "72%" : "64%";
        return (
          <View
            key={`chapter-map-shimmer-${index}`}
            style={[
              styles.chapterMapRow,
              styles.chapterMapShimmerRow,
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={[styles.chapterMapShimmerBar, styles.chapterMapShimmerBarChapter]} />
            <View style={styles.chapterMapRowContent}>
              <View style={[styles.chapterMapShimmerBar, { width: titleWidth }]} />
              {index % 2 === 0 ? (
                <View style={[styles.chapterMapShimmerBar, styles.chapterMapShimmerBarShort]} />
              ) : null}
            </View>
            <View style={[styles.chapterMapShimmerBar, styles.chapterMapShimmerBarPages]} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.chapterMapShimmerSweep,
                {
                  transform: [
                    {
                      translateX: shimmerX.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-260, 260],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={["transparent", "rgba(255,255,255,0.14)", "transparent"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.chapterMapShimmerSweepInner}
              />
            </Animated.View>
          </View>
        );
      })}
    </>
  );
}

export function ScanCameraScreen({ navigation, route }: Props) {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const { streak } = useStreak();
  const { openAddBookSheet } = useAddBookSheet();
  const { openBarcodeScanBookSheet } = useBarcodeScanBookSheet();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const libraryPromoPagerWidth = windowWidth - FROM_LIBRARY_MODAL_HORIZONTAL_PAD * 2;
  const libraryPromoCardWidth = Math.round(libraryPromoPagerWidth * FROM_LIBRARY_CARD_WIDTH_RATIO);
  const libraryPromoItemStride = libraryPromoCardWidth + FROM_LIBRARY_CARD_PEEK_PX;
  const libraryPromoCarouselHeight =
    FROM_LIBRARY_MODAL_CARD_MIN_HEIGHT + FROM_LIBRARY_CARD_TO_DOTS_GAP + 18;
  const libraryModalSheetMaxHeight = Math.round(windowHeight * FROM_LIBRARY_MODAL_SHEET_MAX_HEIGHT_RATIO);
  const libraryModalSheetHideY = useMemo(() => Math.ceil(windowHeight * 0.45), [windowHeight]);

  const contentsViewfinderWidth = useMemo(() => {
    const maxWidth =
      windowWidth - CONTENTS_MODAL_HORIZONTAL_PAD * 2 - insets.left - insets.right;
    const maxHeight = windowHeight - insets.top - insets.bottom - 300;
    const widthFromHeight = maxHeight * (3 / 4);
    return Math.max(0, Math.floor(Math.min(maxWidth, widthFromHeight)));
  }, [windowHeight, windowWidth, insets.bottom, insets.left, insets.right, insets.top]);

  const contentsViewfinderHeight = useMemo(
    () => Math.floor(contentsViewfinderWidth * (4 / 3)),
    [contentsViewfinderWidth]
  );

  /** Vertical gap between scan page sections (title, picker, camera, CTA, etc.). */
  const SCAN_PAGE_SECTION_GAP = 12;

  /** Explicit top spacer — tighter than full safe-area padding, still clears status / notch. */
  const artificialTopSpacer = useMemo(() => {
    if (Platform.OS === "android") {
      return (StatusBar.currentHeight ?? 24) + 2;
    }
    return Math.max(10, Math.round(insets.top * 0.4) + 2);
  }, [insets.top]);

  const pageScanSheetHideY = useMemo(() => Math.round(windowHeight * 0.55) + 80, [windowHeight]);

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
  const pageScanPreviewLayoutRef = useRef<ViewfinderLayout | null>(null);
  const contentsPreviewLayoutRef = useRef<ViewfinderLayout | null>(null);
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
  const lastExtractExpandAnim = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [contentsFlashEnabled, setContentsFlashEnabled] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  /** True while adding a book from Library (or auto-open): capture → crop → metadata, not page scan. */
  const [addingAnotherBookCover, setAddingAnotherBookCover] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  /** Page scan: camera + capture live in a bottom sheet instead of inline. */
  const [pageScanSheetVisible, setPageScanSheetVisible] = useState(false);
  /** Same sheet UI for page scans vs add-another-book (Library). */
  const [pageScanSheetPurpose, setPageScanSheetPurpose] = useState<"page" | "bookCover">("page");
  const [pageScanSheetCameraReady, setPageScanSheetCameraReady] = useState(false);
  const pageScanSheetY = useRef(new Animated.Value(0)).current;
  const pageScanBackdropOp = useRef(new Animated.Value(0)).current;
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
  const [contentsExtractAppending, setContentsExtractAppending] = useState(false);
  const [contentsExtracting, setContentsExtracting] = useState(false);
  const [contentsExtractError, setContentsExtractError] = useState<string | null>(null);
  const chapterMapShimmerX = useRef(new Animated.Value(-1)).current;
  const chapterMapProgress = useRef(new Animated.Value(0)).current;
  const chapterMapProgressAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [chapterEditVisible, setChapterEditVisible] = useState(false);
  const [chapterEditSortedIndex, setChapterEditSortedIndex] = useState<number | null>(null);
  const [chapterEditTitle, setChapterEditTitle] = useState("");
  const [chapterEditStart, setChapterEditStart] = useState("");
  const [chapterEditEnd, setChapterEditEnd] = useState("");
  const chapterEditSheetY = useRef(new Animated.Value(360)).current;
  const chapterMapBookPickerY = useRef(new Animated.Value(420)).current;
  const chapterMapBookPickerBackdropOp = useRef(new Animated.Value(0)).current;
  const [chapterMapBookPickerVisible, setChapterMapBookPickerVisible] = useState(false);
  const [chapterMapBookPickerMounted, setChapterMapBookPickerMounted] = useState(false);
  const [readingTimerModalVisible, setReadingTimerModalVisible] = useState(false);
  /** `null` = All books with scans. */
  const [libraryPromoFilterBookId, setLibraryPromoFilterBookId] = useState<string | null>(null);
  const [libraryPromoModalVisible, setLibraryPromoModalVisible] = useState(false);
  const [libraryPromoModalMounted, setLibraryPromoModalMounted] = useState(false);
  const [libraryPromoSwipeHintVisible, setLibraryPromoSwipeHintVisible] = useState(false);
  const [libraryWidgetHighlightTeaser, setLibraryWidgetHighlightTeaser] = useState<string | null>(null);
  const libraryPromoListRef = useRef<FlatList<LibraryPromoSlide> | null>(null);
  const libraryModalSheetTranslateY = useRef(new Animated.Value(0)).current;
  const libraryModalBackdropOp = useRef(new Animated.Value(0)).current;
  const libraryPromoModalWasOpenRef = useRef(false);
  const addGestureStartYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsFirstBook = books.length === 0;
  const { sessions: readingTimerSessions } = useReadingSession();

  const eligibleReadingTimerSessions = useMemo(
    () => readingTimerSessions.filter(isEligibleReadingLogSession),
    [readingTimerSessions]
  );

  const { readingSessionsThisWeekCount, readingTimerWeekDotFlags } = useMemo(() => {
    const monday = startOfCalendarWeekMonday(new Date());
    const weekStart = monday.getTime();
    const weekEnd = weekStart + 7 * 86400000;
    const count = eligibleReadingTimerSessions.filter((s) => {
      const t = new Date(s.endedAt).getTime();
      return t >= weekStart && t < weekEnd;
    }).length;
    const flags = readingSessionWeekDotsFromSessions(eligibleReadingTimerSessions, monday);
    return { readingSessionsThisWeekCount: count, readingTimerWeekDotFlags: flags };
  }, [eligibleReadingTimerSessions]);

  const readingTimerLastSessionTeaser = useMemo(
    () => formatReadingTimerWidgetSessionTeaser(eligibleReadingTimerSessions, books),
    [eligibleReadingTimerSessions, books]
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
      "Point at the barcode on the back cover",
      "Hold steady inside the frame",
      "Good lighting helps the scanner read faster",
      "You can enter the ISBN manually if needed",
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
    lastExtractExpandAnim.setValue(0);
  }, [lastExtractedScan?.id, lastExtractExpandAnim]);

  const runLastExtractLayoutAnimation = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 300,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, []);

  const toggleLastExtractPreviewExpanded = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    runLastExtractLayoutAnimation();
    setLastExtractPreviewExpanded((v) => !v);
  }, [runLastExtractLayoutAnimation]);

  useEffect(() => {
    Animated.timing(lastExtractExpandAnim, {
      toValue: lastExtractPreviewExpanded ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [lastExtractPreviewExpanded, lastExtractExpandAnim]);

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
      screen: "LibraryHome",
    });
    navigation.getParent()?.navigate("Library", {
      screen: "BookReports",
      params: { bookId: activeBookId },
    });
  }, [navigation, activeBookId]);

  const onRecentScansSeeAllPress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (needsFirstBook) {
      Alert.alert(
        "Recent scans",
        "Add a book and scan pages first. Short preview cards from your latest saved scans will show here for your selected book.",
      );
      return;
    }
    if (!activeBookId) {
      Alert.alert(
        "Recent scans",
        "Select a book above (your current read). Previews of that book’s latest page scans will appear in this row.",
      );
      return;
    }
    onRecentSeeAll();
  }, [needsFirstBook, activeBookId, onRecentSeeAll]);

  const recentScansEmptyHint = useMemo(() => {
    if (needsFirstBook) {
      return "Add a book, then scan pages. Short preview reports from your latest notes will appear here.";
    }
    if (!activeBookId) {
      return "Select a book above. This row shows short previews of that book’s most recent page scans.";
    }
    return "Scan pages for this book. Snippets from your notes show up here as compact preview cards.";
  }, [needsFirstBook, activeBookId]);

  const openReportFromScanHome = useCallback(
    (scan: ScanItem): boolean => {
      if (!scan.bookId?.trim()) return false;
      navigation.navigate("ReportDetails", {
        item: scan,
        reportNavOrigin: "scan",
      });
      return true;
    },
    [navigation]
  );

  const onRecentScanCardPress = useCallback(
    (scan: ScanItem) => {
      Haptics.selectionAsync().catch(() => {});
      if (!openReportFromScanHome(scan)) {
        Alert.alert(
          "Can’t open full report",
          "This scan isn’t linked to a book yet. Save it to a book from the library, then open it there.",
        );
      }
    },
    [openReportFromScanHome]
  );

  const onOpenLastExtractFullReport = useCallback(() => {
    if (!lastExtractedScan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!openReportFromScanHome(lastExtractedScan)) {
      Alert.alert(
        "Can’t open full report",
        "This scan isn’t linked to a book yet. Save it to a book from the library, then open it there.",
      );
    }
  }, [lastExtractedScan, openReportFromScanHome]);

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

  const onPressReadingTimerWidget = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (needsFirstBook) {
      Alert.alert(
        "Reading timer",
        "Add a book to your library first. Scan a book cover from this screen, then you can track reading sessions here.",
      );
      return;
    }
    setReadingTimerModalVisible(true);
  }, [needsFirstBook]);

  const onPressActiveReadingTimerBanner = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setReadingTimerModalVisible(true);
  }, []);

  const onPressLibraryWidget = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (needsFirstBook) {
      Alert.alert(
        "From your library",
        "Add a book and scan pages to build your library. When you have saved page scans, highlights from your notes will appear here.",
      );
      return;
    }
    if (libraryPromoSlides.length === 0) {
      Alert.alert(
        "From your library",
        "Scan book pages and save them to a book first. Highlights from your saved scans will show here.",
      );
      return;
    }
    setLibraryPromoModalVisible(true);
  }, [needsFirstBook, libraryPromoSlides.length]);

  useEffect(() => {
    if (!libraryPromoModalVisible) return;
    const id = requestAnimationFrame(() => {
      libraryPromoListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [libraryPromoModalVisible, libraryPromoFilterBookId]);

  useEffect(() => {
    if (libraryPromoModalVisible) {
      libraryPromoModalWasOpenRef.current = true;
      setLibraryPromoModalMounted(true);
      libraryModalBackdropOp.stopAnimation();
      libraryModalSheetTranslateY.stopAnimation();
      libraryModalBackdropOp.setValue(0);
      libraryModalSheetTranslateY.setValue(libraryModalSheetHideY);
      const id = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(libraryModalBackdropOp, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(libraryModalSheetTranslateY, {
            toValue: 0,
            friction: 9,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      });
      return () => cancelAnimationFrame(id);
    }
    if (!libraryPromoModalWasOpenRef.current) return;
    libraryPromoModalWasOpenRef.current = false;
    libraryModalBackdropOp.stopAnimation();
    libraryModalSheetTranslateY.stopAnimation((currentY) => {
      const from = typeof currentY === "number" ? currentY : 0;
      const toValue = Math.max(libraryModalSheetHideY, from);
      Animated.parallel([
        Animated.timing(libraryModalBackdropOp, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(libraryModalSheetTranslateY, {
          toValue: toValue,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setLibraryPromoModalMounted(false);
        }
      });
    });
  }, [
    libraryModalBackdropOp,
    libraryModalSheetHideY,
    libraryModalSheetTranslateY,
    libraryPromoModalVisible,
  ]);

  useEffect(() => {
    if (!libraryPromoModalVisible) return;
    let cancelled = false;
    AsyncStorage.getItem(FROM_LIBRARY_SWIPE_HINT_STORAGE_KEY).then((raw) => {
      if (!cancelled) setLibraryPromoSwipeHintVisible(raw !== "1");
    });
    return () => {
      cancelled = true;
    };
  }, [libraryPromoModalVisible]);

  const dismissLibraryPromoSwipeHint = useCallback(() => {
    setLibraryPromoSwipeHintVisible(false);
    AsyncStorage.setItem(FROM_LIBRARY_SWIPE_HINT_STORAGE_KEY, "1").catch(() => {});
  }, []);

  const libraryModalPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
        onPanResponderGrant: () => {
          libraryModalSheetTranslateY.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) {
            libraryModalSheetTranslateY.setValue(
              Math.min(g.dy, libraryModalSheetHideY)
            );
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 64 || g.vy > 1.1) {
            setLibraryPromoModalVisible(false);
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
    [libraryModalSheetHideY, libraryModalSheetTranslateY]
  );

  const onLibraryPromoLongPressOpenReport = useCallback(
    (slide: LibraryPromoSlide) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setLibraryPromoModalVisible(false);
      if (!openReportFromScanHome(slide.scan)) {
        Alert.alert(
          "Can’t open full report",
          "This scan isn’t linked to a book yet. Save it to a book from the library, then open it there.",
        );
      }
    },
    [openReportFromScanHome]
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

  const onChapterAssistPress = useCallback(() => {
    if (needsFirstBook) {
      Haptics.selectionAsync().catch(() => {});
      Alert.alert(
        "Chapter-aware reports",
        "Add a book first, then photograph your table of contents or a contents spread. We pair chapter titles with page numbers for smarter reports.",
      );
      return;
    }
    if (!activeBook) {
      Haptics.selectionAsync().catch(() => {});
      Alert.alert(
        "Chapter-aware reports",
        "Choose which book you’re scanning into, then snap a contents page to build your chapter map.",
      );
      return;
    }
    openChapterOverview();
  }, [needsFirstBook, activeBook]);

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
      setChapterMapBookPickerMounted(false);
      chapterMapBookPickerY.setValue(420);
      chapterMapBookPickerBackdropOp.setValue(0);
    }
  }, [isChapterOverviewOpen, chapterEditSheetY, chapterMapBookPickerY, chapterMapBookPickerBackdropOp]);

  const dismissChapterMapBookPicker = useCallback(() => {
    Animated.parallel([
      Animated.timing(chapterMapBookPickerBackdropOp, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(chapterMapBookPickerY, {
        toValue: 420,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setChapterMapBookPickerVisible(false);
        setChapterMapBookPickerMounted(false);
      }
    });
  }, [chapterMapBookPickerBackdropOp, chapterMapBookPickerY]);

  const openChapterMapBookPicker = useCallback(() => {
    if (books.length < 2 || chapterEditVisible) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setChapterMapBookPickerMounted(true);
    setChapterMapBookPickerVisible(true);
  }, [books.length, chapterEditVisible]);

  useEffect(() => {
    if (!chapterMapBookPickerVisible) {
      return;
    }
    chapterMapBookPickerBackdropOp.setValue(0);
    chapterMapBookPickerY.setValue(420);
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(chapterMapBookPickerBackdropOp, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(chapterMapBookPickerY, {
          toValue: 0,
          friction: 9,
          tension: 64,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [chapterMapBookPickerVisible, chapterMapBookPickerBackdropOp, chapterMapBookPickerY]);

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
    Animated.parallel([
      Animated.timing(pageScanSheetY, {
        toValue: pageScanSheetHideY,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pageScanBackdropOp, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setPageScanSheetVisible(false);
        setPageScanSheetPurpose("page");
        setFlashEnabled(false);
        if (wasBookCover) {
          setAddingAnotherBookCover(false);
        }
      }
    });
  }, [pageScanBackdropOp, pageScanSheetHideY, pageScanSheetPurpose, pageScanSheetY]);

  const openAddBookFromPicker = useCallback(() => {
    Keyboard.dismiss();
    setSearchQuery("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // iOS cannot present a second Modal while the book picker is still mounted.
    bookPickerBackdropOp.stopAnimation();
    bookPickerSheetTranslate.stopAnimation();
    bookPickerWasOpenRef.current = false;
    setBookPickerMounted(false);
    setIsBookModalOpen(false);
    bookPickerBackdropOp.setValue(0);
    bookPickerSheetTranslate.setValue(bookPickerHideShift);

    requestAnimationFrame(() => {
      openBarcodeScanBookSheet();
    });
  }, [
    bookPickerBackdropOp,
    bookPickerHideShift,
    bookPickerSheetTranslate,
    openBarcodeScanBookSheet,
  ]);

  useEffect(() => {
    if (!pageScanSheetVisible) {
      setPageScanSheetCameraReady(false);
      pageScanSheetY.setValue(pageScanSheetHideY);
      pageScanBackdropOp.setValue(0);
      return;
    }
    setPageScanSheetCameraReady(false);
    pageScanSheetY.setValue(pageScanSheetHideY);
    pageScanBackdropOp.setValue(0);
    Animated.parallel([
      Animated.spring(pageScanSheetY, {
        toValue: 0,
        friction: 9,
        tension: 64,
        useNativeDriver: true,
      }),
      Animated.timing(pageScanBackdropOp, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pageScanBackdropOp, pageScanSheetHideY, pageScanSheetVisible, pageScanSheetY]);

  const pageScanSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder(_, g) {
          if (coverExtracting || isGalleryOpening) return false;
          return g.dy > 12 && g.dy > Math.abs(g.dx) * 0.65;
        },
        onPanResponderGrant: () => {
          pageScanSheetY.stopAnimation();
          pageScanBackdropOp.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          const y = Math.max(0, Math.min(g.dy, pageScanSheetHideY));
          pageScanSheetY.setValue(y);
          const hide = Math.max(pageScanSheetHideY, 1);
          pageScanBackdropOp.setValue(Math.max(0, 1 - y / hide));
        },
        onPanResponderRelease: (_, g) => {
          const y = Math.max(0, Math.min(g.dy, pageScanSheetHideY));
          const threshold = Math.min(120, Math.max(72, pageScanSheetHideY * 0.22));
          if (y > threshold || g.vy > 0.85) {
            dismissPageScanSheet();
          } else {
            Animated.parallel([
              Animated.spring(pageScanSheetY, {
                toValue: 0,
                friction: 9,
                tension: 64,
                useNativeDriver: true,
              }),
              Animated.timing(pageScanBackdropOp, {
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
      coverExtracting,
      dismissPageScanSheet,
      isGalleryOpening,
      pageScanBackdropOp,
      pageScanSheetHideY,
      pageScanSheetY,
    ]
  );

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

  const navigateToContentsCrop = useCallback(
    (imageUri: string, append: boolean) => {
      setContentsFlashEnabled(false);
      setIsContentsScannerOpen(false);
      navigation.push("CropPhoto", {
        imageUri,
        purpose: "contents",
        contentsScanAppend: append,
      });
    },
    [navigation]
  );

  const startChapterMapProgress = useCallback(() => {
    chapterMapProgressAnimRef.current?.stop();
    chapterMapProgress.setValue(0);
    chapterMapProgressAnimRef.current = Animated.timing(chapterMapProgress, {
      toValue: 0.95,
      duration: 36000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    chapterMapProgressAnimRef.current.start();
  }, [chapterMapProgress]);

  const finishChapterMapProgress = useCallback(() => {
    return new Promise<void>((resolve) => {
      chapterMapProgressAnimRef.current?.stop();
      Animated.timing(chapterMapProgress, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => resolve());
    });
  }, [chapterMapProgress]);

  const processContentsFromUri = useCallback(
    async (uri: string, append: boolean) => {
      if (!activeBook) return;
      setContentsExtractAppending(append);
      setContentsExtractError(null);
      setContentsFlashEnabled(false);
      setIsContentsScannerOpen(false);
      setIsChapterOverviewOpen(true);
      setContentsExtracting(true);
      startChapterMapProgress();
      try {
        const extracted = await extractChapterRangesFromContentsImage(uri);
        const existing = activeBook.chapterRanges ?? [];
        const next =
          append && existing.length > 0 ? mergeChapterRanges(existing, extracted) : extracted;
        updateBookChapterRanges(activeBook.id, next);
        setContentsScanAppend(false);
        await finishChapterMapProgress();
        await new Promise((resolve) => setTimeout(resolve, 280));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (error) {
        chapterMapProgressAnimRef.current?.stop();
        chapterMapProgress.setValue(0);
        const message =
          error instanceof Error ? error.message : "Could not read the contents page.";
        setContentsExtractError(message);
        setIsChapterOverviewOpen(false);
        setIsContentsScannerOpen(true);
      } finally {
        setContentsExtracting(false);
        setContentsExtractAppending(false);
        chapterMapProgress.setValue(0);
      }
    },
    [activeBook, finishChapterMapProgress, startChapterMapProgress, updateBookChapterRanges]
  );

  useEffect(() => {
    if (!contentsExtracting || !isChapterOverviewOpen) {
      chapterMapShimmerX.setValue(-1);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(chapterMapShimmerX, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      chapterMapShimmerX.setValue(-1);
    };
  }, [chapterMapShimmerX, contentsExtracting, isChapterOverviewOpen]);

  useEffect(() => {
    if (!route.params?.autoOpenCoverCamera || books.length === 0) return;
    setCoverExtractError(null);
    setAddingAnotherBookCover(true);
    setIsCameraOpen(false);
    setPageScanSheetPurpose("bookCover");
    setPageScanSheetVisible(true);
    navigation.setParams({ autoOpenCoverCamera: undefined });
  }, [books.length, navigation, route.params?.autoOpenCoverCamera]);

  const tryOpenReadingTimerModal = useCallback(() => {
    if (needsFirstBook) {
      Alert.alert(
        "Reading timer",
        "Add a book to your library first. Scan a book cover from this screen, then you can track reading sessions here."
      );
      return;
    }
    setReadingTimerModalVisible(true);
  }, [needsFirstBook]);

  useEffect(() => {
    if (!route.params?.openReadingTimer) return;
    navigation.setParams({ openReadingTimer: undefined });
    tryOpenReadingTimerModal();
  }, [navigation, route.params?.openReadingTimer, tryOpenReadingTimerModal]);

  useFocusEffect(
    useCallback(() => {
      if (!takePendingOpenReadingTimerModal()) return;
      tryOpenReadingTimerModal();
    }, [tryOpenReadingTimerModal])
  );

  useFocusEffect(
    useCallback(() => {
      const pendingBookId = takePendingOpenPageScanModal();
      if (!pendingBookId) return;
      setActiveBookId(pendingBookId);
      setCoverExtractError(null);
      setIsCameraOpen(false);
      setAddingAnotherBookCover(false);
      setPageScanSheetPurpose("page");
      setPageScanSheetVisible(true);
    }, [setActiveBookId])
  );

  useEffect(() => {
    const uri = route.params?.bookCoverCropResultUri;
    if (!uri) return;
    navigation.setParams({ bookCoverCropResultUri: undefined });
    void processCoverFromUri(uri);
  }, [navigation, processCoverFromUri, route.params?.bookCoverCropResultUri]);

  useEffect(() => {
    const uri = route.params?.contentsCropResultUri;
    if (!uri) return;
    const append = route.params?.contentsScanAppend ?? false;
    navigation.setParams({ contentsCropResultUri: undefined, contentsScanAppend: undefined });
    void processContentsFromUri(uri, append);
  }, [
    navigation,
    processContentsFromUri,
    route.params?.contentsCropResultUri,
    route.params?.contentsScanAppend,
  ]);

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
        pageScanSheetY.setValue(pageScanSheetHideY);
        pageScanBackdropOp.setValue(0);
        const state = navigation.getState();
        const top = state.routes[state.index];
        if (top?.name !== "CropPhoto") {
          setAddingAnotherBookCover(false);
        }
      };
    }, [navigation, pageScanBackdropOp, pageScanSheetHideY, pageScanSheetY])
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
      if (coverExtracting) return;
      openAddBookSheet();
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
    const photo = await cameraRef.current?.takePictureAsync(CAMERA_PICTURE_OPTIONS);
    if (!photo?.uri) return;
    playSoundEffect("takePhoto");

    let imageUri = photo.uri;
    const viewfinder = pageScanPreviewLayoutRef.current;
    if (viewfinder && viewfinder.width > 0 && viewfinder.height > 0) {
      try {
        imageUri = await cropImageToViewfinder(photo.uri, viewfinder);
      } catch {
        imageUri = photo.uri;
      }
    }

    if (pageScanSheetPurpose === "bookCover") {
      navigateToBookCoverCrop(imageUri);
      return;
    }
    navigateToExtractionOptions(imageUri);
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
    setContentsFlashEnabled(false);
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
    setContentsExtractError(null);
    try {
      const photo = await contentsCameraRef.current?.takePictureAsync(CAMERA_PICTURE_OPTIONS);
      if (!photo?.uri) return;
      playSoundEffect("takePhoto");

      let imageUri = photo.uri;
      const viewfinder = contentsPreviewLayoutRef.current;
      if (viewfinder && viewfinder.width > 0 && viewfinder.height > 0) {
        try {
          imageUri = await cropImageToViewfinder(photo.uri, viewfinder);
        } catch {
          imageUri = photo.uri;
        }
      }

      navigateToContentsCrop(imageUri, contentsScanAppend);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not capture the contents page.";
      setContentsExtractError(message);
    }
  };

  const onLockedAddBook = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    openBarcodeScanBookSheet();
  }, [openBarcodeScanBookSheet]);

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
    <View style={[styles.screen, needsFirstBook ? styles.screenLocked : darkMode && styles.screenDark]}>
      <View style={{ height: artificialTopSpacer }} />
      <View
        style={{
          flex: 1,
          paddingLeft: (needsFirstBook ? 20 : 18) + insets.left,
          paddingRight: (needsFirstBook ? 20 : 18) + insets.right,
        }}
      >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          needsFirstBook && styles.scrollContentLocked,
          !needsFirstBook && styles.scrollContentFlex,
          { gap: needsFirstBook ? 16 : SCAN_PAGE_SECTION_GAP },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showGalleryDropTarget && !lockScrollForAddGesture}
      >
        <View style={styles.scanPageTitleWrap}>
          {needsFirstBook ? (
            <View style={styles.lockedHeaderRow}>
              <Text style={styles.lockedHeaderTitle}>Scan</Text>
              {streak.currentStreak > 0 ? <StreakBadge variant="homeLocked" /> : null}
            </View>
          ) : (
          <HeaderText
            title={
              addingAnotherBookCover ? "Add another book" : "Home"
            }
            subtitle={
              addingAnotherBookCover
                ? "Photograph the front cover. You can crop before title and author are read."
                : undefined
            }
            style={styles.scanPageHeaderBlock}
            titleStyle={{ fontFamily: FONT_CANELA_TEXT_BOLD, fontWeight: "400" }}
            trailing={<StreakBadge />}
            belowTitle={
              !addingAnotherBookCover ? (
                <Text style={[styles.pagesScannedThisWeekLine, darkMode && styles.pagesScannedThisWeekLineDark]}>
                  {pagesScannedThisWeek === 1
                    ? "1 page scanned this week"
                    : `${pagesScannedThisWeek} pages scanned this week`}
                </Text>
              ) : undefined
            }
          />
          )}
        </View>

        {books.length > 0 ? (
          <>
            <ReadingTimerActiveBanner darkMode={darkMode} onPress={onPressActiveReadingTimerBanner} />

            {navigation.getParent() ? (
              <ScanProcessingHomeWidget
                darkMode={darkMode}
                navigation={navigation}
                onTakeAnotherPhoto={() => {
                  setCoverExtractError(null);
                  setIsCameraOpen(false);
                  setAddingAnotherBookCover(false);
                  setPageScanSheetPurpose("page");
                  setPageScanSheetVisible(true);
                }}
              />
            ) : null}

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
            <BookTotalPageNudgeList />
          </>
        ) : null}

        {coverExtractError ? (
          <Text style={[styles.coverExtractError, darkMode && styles.coverExtractErrorDark]}>{coverExtractError}</Text>
        ) : null}

        {!needsFirstBook ? (
        <View style={[styles.sectionBlock, darkMode && styles.sectionBlockDark]}>
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
              {addingAnotherBookCover || coverExtracting ? (
                <LinearGradient
                  colors={accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.primaryButtonGradient, coverExtracting && styles.primaryButtonGradientDisabled]}
                >
                  <Ionicons name="camera" size={22} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    {coverExtracting ? "Reading cover…" : "Open camera"}
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
                  <Text style={styles.primaryButtonTextOnWhite}>Scan Page</Text>
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
                  <Text style={styles.primaryButtonTextLightOnDark}>Scan Page</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
        ) : null}

        {!needsFirstBook &&
        lastExtractedScan &&
        (lastExtractMainIdeas.length > 0 || lastExtractSummaryFallback) ? (
          <View style={[styles.lastExtractCard, darkMode && styles.lastExtractCardDark]}>
            <Pressable
              onPress={toggleLastExtractPreviewExpanded}
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
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: lastExtractExpandAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "180deg"],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={darkMode ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.4)"}
                />
              </Animated.View>
            </Pressable>

            <Pressable
              onPress={toggleLastExtractPreviewExpanded}
              style={({ pressed }) => [
                styles.lastExtractBody,
                pressed && styles.lastExtractHeaderPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                lastExtractPreviewExpanded ? "Collapse last extracted preview" : "Expand last extracted preview"
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

        {needsFirstBook ? (
          <HomeLockedContent onAddBook={onLockedAddBook} />
        ) : null}

        {!needsFirstBook ? (
          <>
        {savedChapterRangeCount > 0 && activeBook ? (
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
            onPress={onChapterAssistPress}
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
        )}

        <View style={styles.recentScansSection}>
          <View style={styles.recentScansHeaderRow}>
            <Text style={[styles.recentScansHeaderLabel, darkMode && styles.recentScansHeaderLabelDark]}>
              Recent scans
            </Text>
            <TouchableOpacity
              onPress={onRecentScansSeeAllPress}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.recentScansSeeAll,
                  {
                    color:
                      !needsFirstBook && activeBookId
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
          {recentScanSlots.length > 0 ? (
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
          ) : (
            <>
              <Text style={[styles.recentScansEmptyHint, darkMode && styles.recentScansEmptyHintDark]}>
                {recentScansEmptyHint}
              </Text>
              <View style={styles.recentScansCardsRow}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.recentScanCard,
                      darkMode ? styles.recentScanCardSkeletonShellDark : styles.recentScanCardSkeletonShellLight,
                    ]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <View style={styles.recentScanCardInner}>
                      <View style={styles.recentScanSkeletonContent}>
                        <View
                          style={[
                            styles.recentScanSkeletonPageBar,
                            darkMode
                              ? styles.recentScanSkeletonBarDark
                              : styles.recentScanSkeletonBarLight,
                          ]}
                        />
                        <View
                          style={[
                            styles.recentScanSkeletonLine,
                            darkMode
                              ? styles.recentScanSkeletonBarDark
                              : styles.recentScanSkeletonBarLight,
                          ]}
                        />
                        <View
                          style={[
                            styles.recentScanSkeletonLineShort,
                            darkMode
                              ? styles.recentScanSkeletonBarDark
                              : styles.recentScanSkeletonBarLight,
                          ]}
                        />
                        <View style={styles.recentScanSkeletonSpacer} />
                        <View
                          style={[
                            styles.recentScanSkeletonTimeBar,
                            darkMode
                              ? styles.recentScanSkeletonBarDark
                              : styles.recentScanSkeletonBarLight,
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.scanWidgetsGridRow}>
          <Pressable
            style={({ pressed }) => [
              styles.scanWidgetTile,
              styles.scanWidgetTileHalf,
              !darkMode && styles.scanWidgetTileLight,
              pressed && styles.scanWidgetTilePressed,
            ]}
            onPress={onPressReadingTimerWidget}
            accessibilityRole="button"
            accessibilityLabel={`Open reading timer, ${readingSessionsThisWeekCount} sessions this week`}
          >
            <View style={styles.scanWidgetTileInner}>
              <Ionicons
                name="timer-outline"
                size={88}
                color={hexWithAlpha("#f59e0b", darkMode ? 0.08 : 0.12)}
                style={styles.scanWidgetWatermarkIcon}
                pointerEvents="none"
                importantForAccessibility="no"
              />
              <View style={styles.scanWidgetTileForeground}>
                <View>
                  <Text style={styles.scanWidgetBigNumberAmber}>{readingSessionsThisWeekCount}</Text>
                  <Text style={[styles.scanWidgetTileCaption, !darkMode && styles.scanWidgetTileCaptionLight]}>
                    sessions this week
                  </Text>
                  {readingTimerLastSessionTeaser ? (
                    <Text
                      style={[styles.scanWidgetSessionTeaser, !darkMode && styles.scanWidgetSessionTeaserLight]}
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
                        !on && !darkMode && styles.scanWidgetWeekDotOffLight,
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
              !darkMode && styles.scanWidgetTileLight,
              pressed && styles.scanWidgetTilePressed,
            ]}
            onPress={onPressLibraryWidget}
            accessibilityRole="button"
            accessibilityLabel={`From your library, ${libraryPromoSlides.length} highlights`}
            accessibilityHint="Opens highlights from your scans"
          >
            <View style={styles.scanWidgetTileInner}>
              <Ionicons
                name="library-outline"
                size={88}
                color={hexWithAlpha("#a855f7", darkMode ? 0.08 : 0.12)}
                style={styles.scanWidgetWatermarkIcon}
                pointerEvents="none"
                importantForAccessibility="no"
              />
              <View style={[styles.scanWidgetTileForeground, styles.scanWidgetLibraryForeground]}>
                <View>
                  <Text style={styles.scanWidgetBigNumberPurple}>{libraryPromoSlides.length}</Text>
                  <Text style={[styles.scanWidgetTileCaption, !darkMode && styles.scanWidgetTileCaptionLight]}>
                    {`highlights · ${libraryWidgetBookCount} book${libraryWidgetBookCount === 1 ? "" : "s"}`}
                  </Text>
                </View>
                <View style={styles.scanWidgetLibraryTeaserSpacer} />
                {libraryWidgetHighlightTeaser ? (
                  <Text
                    style={[styles.scanWidgetHighlightTeaser, !darkMode && styles.scanWidgetHighlightTeaserLight]}
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
              {contentsExtracting ? (
                <View style={styles.chapterMapProgressTrack}>
                  <Animated.View
                    style={[
                      styles.chapterMapProgressFill,
                      {
                        width: chapterMapProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
              ) : null}
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
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close chapter map"
                >
                  <View style={styles.chapterMapCloseCircle}>
                    <Text style={styles.chapterMapCloseGlyph}>×</Text>
                  </View>
                </Pressable>
                <Text style={styles.chapterMapHeaderLabel} pointerEvents="none">
                  Chapter map
                </Text>
                <View style={styles.chapterMapHeaderBalance} />
              </View>
              {activeBook ? (
                <View style={styles.chapterMapBookHeaderBlock}>
                  {books.length > 1 ? (
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
                        <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.4)" />
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
                  )}
                </View>
              ) : null}
            </View>
            {activeBook && chapterMapRows.length === 0 && !contentsExtracting ? (
              <ChapterMapEmptyState
                onScanPress={onOpenContentsScannerFromOverview}
                disabled={!activeBook}
                bottomInset={insets.bottom}
              />
            ) : (
              <>
            <ScrollView
              style={styles.chapterMapList}
              contentContainerStyle={styles.chapterMapListContent}
              showsVerticalScrollIndicator={false}
            >
              {activeBook && chapterMapRows.length > 0 && (!contentsExtracting || contentsExtractAppending)
                ? chapterMapRows.map(({ range, displayEnd }, index) => {
                    const endForLabel = range.endPage ?? displayEnd;
                    const pageLabel = formatChapterMapPageRange(range.startPage, endForLabel);
                    const showOverlapWarn = chapterMapOverlapWarningIndices.has(index);
                    return (
                      <Pressable
                        key={`${range.startPage}-${range.title}-${index}`}
                        onPress={() => openChapterEditSheet(index, range)}
                        disabled={contentsExtracting}
                        android_ripple={{ color: "rgba(255,255,255,0.08)" }}
                        style={({ pressed }) => [
                          styles.chapterMapRow,
                          Platform.OS === "ios" && pressed && !contentsExtracting && styles.chapterMapRowPressed,
                          contentsExtracting && styles.chapterMapRowDisabled,
                        ]}
                      >
                        <Text style={styles.chapterMapRowNumber}>Ch {index + 1}</Text>
                        <View style={styles.chapterMapRowContent}>
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
              {contentsExtracting ? (
                <ChapterMapShimmerRows
                  shimmerX={chapterMapShimmerX}
                  count={
                    contentsExtractAppending && chapterMapRows.length > 0
                      ? CHAPTER_MAP_SHIMMER_APPEND_COUNT
                      : CHAPTER_MAP_SHIMMER_ROW_COUNT
                  }
                  rowOffset={contentsExtractAppending ? chapterMapRows.length : 0}
                />
              ) : null}
            </ScrollView>
            <View style={[styles.chapterMapFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable
                onPress={onOpenContentsScannerFromOverview}
                disabled={!activeBook || contentsExtracting}
                style={({ pressed }) => [
                  styles.chapterMapFooterButton,
                  (!activeBook || contentsExtracting) && styles.chapterMapFooterButtonDisabled,
                  pressed && activeBook && !contentsExtracting && styles.chapterMapFooterButtonPressed,
                ]}
              >
                <Text style={styles.chapterMapFooterButtonText}>
                  {contentsExtracting
                    ? "Reading contents…"
                    : chapterMapRows.length > 0
                      ? "Add another page"
                      : "Scan contents page"}
                </Text>
              </Pressable>
            </View>
              </>
            )}
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

          {chapterMapBookPickerMounted ? (
            <View style={styles.chapterMapBookPickerOverlay} pointerEvents="box-none">
              <Animated.View
                style={[styles.chapterMapBookPickerBackdrop, { opacity: chapterMapBookPickerBackdropOp }]}
              >
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={dismissChapterMapBookPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Close book picker"
                />
              </Animated.View>
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
          <Animated.View
            pointerEvents="box-none"
            style={[styles.pageScanSheetDim, { opacity: pageScanBackdropOp }]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={dismissPageScanSheet}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </Animated.View>
          <Animated.View
            {...pageScanSheetPanResponder.panHandlers}
            style={[
              styles.pageScanSheetPanel,
              pageScanSheetPurpose === "bookCover" && styles.pageScanSheetPanelFixed,
              {
                paddingBottom: insets.bottom,
                ...(pageScanSheetPurpose === "bookCover" ? { height: windowHeight * 0.8 } : null),
                transform: [{ translateY: pageScanSheetY }],
              },
            ]}
          >
            <View style={styles.pageScanSheetGrabber} />
            <Text style={styles.pageScanSheetTitle}>
              {pageScanSheetPurpose === "bookCover"
                ? needsFirstBook
                  ? "Add your first book"
                  : "Add another book"
                : "Scan a page"}
            </Text>
            <Text
              style={[
                styles.pageScanSheetSubtitle,
                pageScanSheetPurpose === "bookCover" && styles.pageScanSheetSubtitleBookCover,
                pageScanSheetPurpose === "page" && styles.pageScanSheetSubtitlePageMuted,
              ]}
            >
              {pageScanSheetPurpose === "bookCover"
                ? "Point your camera at the front cover. You can crop before we read the title."
                : "Hold the page flat and steady"}
            </Text>
            <View
              style={[
                styles.pageScanPreviewWrap,
                pageScanSheetPurpose === "bookCover"
                  ? styles.pageScanPreviewWrapFill
                  : styles.pageScanPreviewWrapPage,
              ]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  pageScanPreviewLayoutRef.current = { width, height };
                }
              }}
            >
              <View style={styles.pageScanPreviewCameraSlot}>
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
                  {!pageScanSheetCameraReady ? (
                    <View style={styles.pageScanPreviewPlaceholder} pointerEvents="none">
                      <Ionicons name="camera-outline" size={32} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.pageScanPreviewPlaceholderText}>Camera preview</Text>
                    </View>
                  ) : null}
                </CameraView>
              </View>
              <View style={styles.pageScanPreviewCornersOverlay} pointerEvents="none">
                <PageScanSheetFrameCorners />
              </View>
            </View>
            <View style={styles.pageScanActionsRow}>
              <TouchableOpacity
                style={[
                  styles.contentsFlashButton,
                  flashEnabled && styles.contentsFlashButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setFlashEnabled((on) => !on);
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={flashEnabled ? "Turn flash off" : "Turn flash on"}
              >
                <Ionicons
                  name={flashEnabled ? "flash" : "flash-outline"}
                  size={22}
                  color={flashEnabled ? "#fbbf24" : "#fff"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pageScanTakePhotoBtn}
                onPress={() => void onCapturePageFromSheet()}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
              >
                <Ionicons name="camera" size={18} color="#111111" />
                <Text style={styles.pageScanTakePhotoBtnText}>Take photo</Text>
              </TouchableOpacity>
            </View>
            <Pressable
              style={styles.pageScanGalleryLinkWrap}
              onPress={() => void onPickFromGallery()}
              disabled={isGalleryOpening || coverExtracting}
              accessibilityRole="button"
              accessibilityLabel="Choose from gallery"
            >
              <Text
                style={[
                  styles.pageScanGalleryLinkText,
                  (isGalleryOpening || coverExtracting) && styles.pageScanGalleryLinkTextDisabled,
                ]}
              >
                {isGalleryOpening ? "Opening gallery…" : "or choose from gallery"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.pageScanCancelLinkWrap}
              onPress={dismissPageScanSheet}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.pageScanCancelLinkText}>Cancel</Text>
            </Pressable>
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
            setContentsFlashEnabled(false);
            setIsContentsScannerOpen(false);
          }
        }}
      >
        <View
          style={[
            styles.contentsModalScreen,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 16,
              paddingLeft: CONTENTS_MODAL_HORIZONTAL_PAD + insets.left,
              paddingRight: CONTENTS_MODAL_HORIZONTAL_PAD + insets.right,
            },
          ]}
        >
          <View style={styles.contentsChrome}>
            <View style={styles.contentsHeaderBlock}>
              <View style={styles.contentsTitleRow}>
                <Pressable
                  onPress={() => {
                    setContentsScanAppend(false);
                    setContentsFlashEnabled(false);
                    setIsContentsScannerOpen(false);
                  }}
                  disabled={contentsExtracting}
                  style={({ pressed }) => [
                    styles.chapterMapCloseHit,
                    pressed && styles.chapterMapClosePressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close contents scanner"
                >
                  <View style={styles.chapterMapCloseCircle}>
                    <Text style={styles.chapterMapCloseGlyph}>×</Text>
                  </View>
                </Pressable>
                <Text style={styles.contentsSheetTitle} numberOfLines={2}>
                  {contentsScanAppend ? "Add another contents page" : "Scan the contents page"}
                </Text>
                <View style={styles.chapterMapHeaderBalance} />
              </View>
              <Text style={styles.contentsSheetSubtitle}>
                {contentsScanAppend
                  ? "Capture the next part of your table of contents. New chapters will be merged with what you already have."
                  : "Fit the chapter list and page numbers inside the frame."}
              </Text>
            </View>

            <View
              style={[
                styles.contentsViewfinderWrap,
                { width: contentsViewfinderWidth, height: contentsViewfinderHeight },
              ]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  contentsPreviewLayoutRef.current = { width, height };
                }
              }}
            >
              <View style={styles.contentsViewfinderCameraSlot}>
                <CameraView
                  ref={contentsCameraRef}
                  style={styles.contentsViewfinderCamera}
                  facing="back"
                  selectedLens={selectedLens}
                  zoom={0}
                  flash={contentsFlashEnabled ? "on" : "off"}
                  enableTorch={contentsFlashEnabled}
                  {...(Platform.OS === "android"
                    ? { ratio: "4:3" as const, videoQuality: "4:3" as const }
                    : {})}
                />
              </View>
              <View style={styles.contentsViewfinderCornersOverlay} pointerEvents="none">
                <PageScanSheetFrameCorners />
              </View>
            </View>

            {contentsExtractError ? (
              <View style={styles.contentsErrorBox}>
                <Text style={styles.contentsErrorText}>{contentsExtractError}</Text>
              </View>
            ) : null}

            <View style={[styles.contentsActionsRow, { width: contentsViewfinderWidth }]}>
              <TouchableOpacity
                style={[
                  styles.contentsFlashButton,
                  contentsFlashEnabled && styles.contentsFlashButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setContentsFlashEnabled((on) => !on);
                }}
                disabled={contentsExtracting}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={contentsFlashEnabled ? "Turn flash off" : "Turn flash on"}
              >
                <Ionicons
                  name={contentsFlashEnabled ? "flash" : "flash-outline"}
                  size={22}
                  color={contentsFlashEnabled ? "#fbbf24" : "#fff"}
                />
              </TouchableOpacity>

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
          </View>
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
                {
                  paddingBottom: 28 + insets.bottom,
                  marginBottom: bookPickerKeyboardPad,
                },
                { transform: [{ translateY: bookPickerSheetTranslate }] },
              ]}
            >
              <View style={styles.bookPickerDragHandle} />
              <Text style={styles.bookPickerSheetTitle}>Select book</Text>
              <View style={styles.bookPickerSearchOuter}>
                <View style={styles.bookPickerSearchInner}>
                  <Ionicons name="search-outline" size={15} color="rgba(255,255,255,0.3)" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by title or author"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    style={styles.bookPickerSearchInput}
                    selectionColor={accentColor}
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>

              <FlatList
                data={filteredBooks}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={[styles.bookPickerList, { maxHeight: windowHeight * 0.58 }]}
                contentContainerStyle={styles.bookPickerListContent}
                renderItem={({ item, index }) => {
                  const isActive = item.id === activeBookId;
                  const hasCover = Boolean(item.coverUri?.trim());
                  const isLast = index === filteredBooks.length - 1;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.bookPickerRow,
                        isActive ? styles.bookPickerRowSelected : styles.bookPickerRowPlain,
                        !isActive && !isLast ? styles.bookPickerRowDivider : null,
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        Haptics.selectionAsync().catch(() => {});
                        setActiveBookId(item.id);
                        setIsBookModalOpen(false);
                        setSearchQuery("");
                      }}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      {hasCover ? (
                        <Image
                          source={{ uri: item.coverUri }}
                          style={styles.bookPickerCoverImage}
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        <View style={styles.bookPickerCoverPlaceholder}>
                          <Ionicons name="book-outline" size={16} color="rgba(255,255,255,0.15)" />
                        </View>
                      )}
                      <View style={styles.bookPickerRowTextCol}>
                        <Text style={styles.bookPickerRowTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.bookPickerRowAuthor} numberOfLines={1}>
                          {item.author}
                        </Text>
                      </View>
                      {isActive ? (
                        <View style={[styles.bookPickerCheckCircle, { backgroundColor: accentColor }]}>
                          <Ionicons name="checkmark" size={14} color="#ffffff" />
                        </View>
                      ) : (
                        <View style={styles.bookPickerCheckSpacer} pointerEvents="none" />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.bookPickerEmptyText}>{bookPickerEmptyMessage}</Text>
                }
                ListFooterComponent={
                  <View>
                    <View style={styles.bookPickerFooterDivider} />
                    <TouchableOpacity
                      style={styles.bookPickerAddRow}
                      onPress={openAddBookFromPicker}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityLabel="Add new book"
                    >
                      <View style={styles.bookPickerAddIconWrap}>
                        <Ionicons name="barcode-outline" size={16} color={accentColor} />
                      </View>
                      <View style={styles.bookPickerAddTextCol}>
                        <Text style={styles.bookPickerAddTitle}>Add new book</Text>
                        <Text style={styles.bookPickerAddSubtitle}>Scan barcode to add</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
                    </TouchableOpacity>
                  </View>
                }
              />
            </Animated.View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={libraryPromoModalMounted}
        transparent
        animationType="none"
        onRequestClose={() => setLibraryPromoModalVisible(false)}
      >
        <View style={styles.fromLibraryModalRoot}>
          <Animated.View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, { opacity: libraryModalBackdropOp }]}
          >
            <Pressable
              style={styles.fromLibraryModalBackdrop}
              onPress={() => setLibraryPromoModalVisible(false)}
              accessibilityLabel="Dismiss"
            />
          </Animated.View>
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

            <View style={styles.fromLibraryModalHoldHintRow}>
              <HandTapIcon
                size={15}
                color={darkMode ? darkColors.textSecondary : lightColors.textMuted}
                opacity={0.85}
              />
              <Text
                style={[
                  styles.fromLibraryModalHoldHint,
                  darkMode && styles.fromLibraryModalHoldHintDark,
                ]}
              >
                Hold a card for 1 second to open the full report.
              </Text>
            </View>
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
  screenLocked: {
    backgroundColor: HOME_LOCKED_BG,
  },
  lockedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 34,
  },
  lockedHeaderTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#ffffff",
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
    paddingBottom: ROOT_TAB_MAIN_SCROLL_BOTTOM_PADDING,
  },
  /** Scroll content fills at least the viewport height when content is short. */
  scrollContentFlex: {
    flexGrow: 1,
  },
  scrollContentLocked: {
    flexGrow: 1,
    paddingBottom: 100,
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
  recentScansEmptyHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
    color: "rgba(15,23,42,0.5)",
    marginBottom: 4,
  },
  recentScansEmptyHintDark: {
    color: "rgba(255,255,255,0.42)",
  },
  recentScanCardSkeletonShellDark: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.07)",
  },
  recentScanCardSkeletonShellLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.08)",
  },
  recentScanSkeletonContent: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 8,
    paddingTop: 2,
  },
  recentScanSkeletonPageBar: {
    height: 22,
    width: "42%",
    borderRadius: 6,
  },
  recentScanSkeletonLine: {
    height: 9,
    width: "100%",
    borderRadius: 4,
  },
  recentScanSkeletonLineShort: {
    height: 9,
    width: "72%",
    borderRadius: 4,
  },
  recentScanSkeletonSpacer: {
    flex: 1,
    minHeight: 8,
  },
  recentScanSkeletonTimeBar: {
    height: 8,
    width: "38%",
    borderRadius: 4,
  },
  recentScanSkeletonBarDark: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  recentScanSkeletonBarLight: {
    backgroundColor: "rgba(15,23,42,0.1)",
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
  scanWidgetTileLight: {
    borderColor: "rgba(15,23,42,0.08)",
    backgroundColor: "rgba(15,23,42,0.04)",
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
  scanWidgetTileCaptionLight: {
    color: "rgba(15,23,42,0.45)",
  },
  scanWidgetSessionTeaser: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
  },
  scanWidgetSessionTeaserLight: {
    color: "rgba(15,23,42,0.4)",
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
  scanWidgetHighlightTeaserLight: {
    color: "rgba(15,23,42,0.4)",
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
  scanWidgetWeekDotOffLight: {
    backgroundColor: "rgba(15,23,42,0.12)",
  },
  fromLibraryModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  fromLibraryModalBackdrop: {
    ...StyleSheet.absoluteFill,
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
  fromLibraryModalHoldHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 8,
  },
  fromLibraryModalHoldHint: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    color: lightColors.textMuted,
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
  chapterMapProgressTrack: {
    height: 3,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  chapterMapProgressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#60a5fa",
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
  chapterMapCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  chapterMapClosePressed: {
    opacity: 0.55,
  },
  chapterMapCloseGlyph: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "400",
    lineHeight: 22,
    marginTop: -1,
  },
  chapterMapHeaderLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
  },
  chapterMapHeaderBalance: {
    width: 28,
    height: 28,
  },
  chapterMapBookHeaderBlock: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  chapterMapBookHeaderTappable: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  chapterMapBookHeaderTappablePressed: {
    opacity: 0.78,
  },
  chapterMapBookTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "stretch",
    maxWidth: "100%",
  },
  chapterMapBookTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  chapterMapBookTitleWithChevron: {
    flexShrink: 1,
  },
  chapterMapBookAuthor: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
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
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  chapterMapRowNumber: {
    width: 32,
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.3)",
    flexShrink: 0,
  },
  chapterMapRowContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  chapterMapRowPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chapterMapRowDisabled: {
    opacity: 0.72,
  },
  chapterMapShimmerRow: {
    position: "relative",
    overflow: "hidden",
  },
  chapterMapShimmerBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chapterMapShimmerBarChapter: {
    width: 32,
    height: 10,
    flexShrink: 0,
  },
  chapterMapShimmerBarShort: {
    width: "48%",
    height: 10,
    marginTop: 6,
  },
  chapterMapShimmerBarPages: {
    width: 44,
    height: 10,
    marginTop: 2,
    flexShrink: 0,
  },
  chapterMapShimmerSweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 140,
  },
  chapterMapShimmerSweepInner: {
    flex: 1,
  },
  chapterMapRowTitle: {
    fontSize: 13,
    fontFamily: FONT_CANELA_TEXT_REGULAR,
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
    textAlign: "right",
  },
  chapterMapFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  chapterMapFooterButton: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
  },
  chapterMapFooterButtonPressed: {
    opacity: 0.88,
  },
  chapterMapFooterButtonDisabled: {
    opacity: 0.35,
  },
  chapterMapFooterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  chapterMapBookPickerOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    justifyContent: "flex-end",
  },
  chapterMapBookPickerBackdrop: {
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
    zIndex: 24,
    justifyContent: "flex-end",
  },
  chapterEditBackdrop: {
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
    marginBottom: 10,
  },
  pageScanSheetSubtitleBookCover: {
    color: "rgba(255,255,255,0.45)",
  },
  pageScanSheetSubtitlePageMuted: {
    color: "rgba(255,255,255,0.4)",
  },
  pageScanPreviewWrap: {
    position: "relative",
    borderRadius: 14,
    backgroundColor: "#0a0a0a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },
  pageScanPreviewWrapPage: {
    width: "100%",
    alignSelf: "stretch",
    aspectRatio: 3 / 4,
  },
  pageScanPreviewWrapFill: {
    flex: 1,
    minHeight: 0,
    alignSelf: "stretch",
    width: "100%",
  },
  pageScanPreviewCameraSlot: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    borderRadius: 14,
    overflow: "hidden",
  },
  pageScanPreviewCornersOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
  },
  pageScanPreviewCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  pageScanPreviewPlaceholder: {
    ...StyleSheet.absoluteFill,
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
  pageScanActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 12,
  },
  pageScanTakePhotoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  pageScanTakePhotoBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  pageScanGalleryLinkWrap: {
    marginTop: 10,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  pageScanGalleryLinkText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },
  pageScanGalleryLinkTextDisabled: {
    opacity: 0.4,
  },
  pageScanCancelLinkWrap: {
    marginTop: 10,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  pageScanCancelLinkText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
  },
  contentsModalScreen: {
    flex: 1,
    backgroundColor: CHAPTER_MAP_BG,
  },
  contentsChrome: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  contentsHeaderBlock: {
    alignSelf: "stretch",
    width: "100%",
    marginBottom: 12,
    gap: 8,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  contentsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  contentsSheetTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  contentsSheetSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  contentsViewfinderWrap: {
    position: "relative",
    alignSelf: "center",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 4,
  },
  contentsViewfinderCameraSlot: {
    flex: 1,
    width: "100%",
    minHeight: 0,
  },
  contentsViewfinderCornersOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
  },
  contentsViewfinderCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
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
  contentsActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 12,
    marginTop: 20,
  },
  contentsFlashButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  contentsFlashButtonActive: {
    backgroundColor: "rgba(251,191,36,0.16)",
    borderColor: "rgba(251,191,36,0.35)",
  },
  contentsCaptureButton: {
    flex: 1,
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
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    maxHeight: "90%",
    width: "100%",
  },
  bookPickerDragHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 16,
  },
  bookPickerSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  bookPickerSearchOuter: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  bookPickerSearchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bookPickerSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: "#ffffff",
    padding: 0,
    margin: 0,
  },
  bookPickerList: {
    flexGrow: 1,
  },
  bookPickerListContent: {
    paddingBottom: 4,
  },
  bookPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  bookPickerRowPlain: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  bookPickerRowDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  bookPickerRowSelected: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  bookPickerCoverPlaceholder: {
    width: 36,
    height: 48,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookPickerCoverImage: {
    width: 36,
    height: 48,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  bookPickerRowTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bookPickerRowTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
  },
  bookPickerRowAuthor: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  bookPickerCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  bookPickerCheckSpacer: {
    width: 26,
    height: 26,
  },
  bookPickerEmptyText: {
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    fontSize: 14,
    lineHeight: 20,
  },
  bookPickerFooterDivider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: 4,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  bookPickerAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  bookPickerAddIconWrap: {
    width: 36,
    height: 48,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookPickerAddTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bookPickerAddTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
  },
  bookPickerAddSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
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
    ...StyleSheet.absoluteFill,
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
  firstBookAddRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    width: "100%",
  },
  firstBookAddPressable: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  /** Light appearance: solid black control; label and icon are white for contrast. */
  firstBookAddPressableLight: {
    backgroundColor: "#0f172a",
    borderWidth: 0,
  },
  firstBookAddPressableLightPressed: {
    opacity: 0.9,
  },
  /** Dark appearance: solid white control with black label and icon. */
  firstBookAddPressableDark: {
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.12)",
  },
  firstBookAddPressableDarkPressed: {
    backgroundColor: "#f1f5f9",
  },
  firstBookAddCoverLabel: {
    fontFamily: FONT_HELVETICA,
    fontWeight: "700",
    fontSize: 15,
  },
  firstBookAddCoverLabelLight: {
    color: "#ffffff",
  },
  firstBookAddCoverLabelDark: {
    color: "#0f172a",
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
