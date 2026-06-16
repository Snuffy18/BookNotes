import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScanContext } from "../context/ScanContext";
import { useReadingSession } from "../context/ReadingSessionContext";
import { useReadingPlan } from "../context/ReadingPlanContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { estimateBookPageTotal } from "../utils/bookReadingProgress";
import {
  detectCurrentPage,
  estimateHoursToFinish,
  formatHoursToFinish,
  formatPlanTargetDate,
} from "../utils/readingPlanProgress";
import { FONT_CANELA_TEXT_REGULAR } from "../theme/fonts";

const SHEET_BG = "#1a1a1a";
const OVERLAY = "rgba(0,0,0,0.7)";
const BORDER_10 = "rgba(255,255,255,0.1)";
const CARD_BG = "rgba(255,255,255,0.05)";
const MUTED = "rgba(255,255,255,0.45)";
const LIGHT_MUTED = "rgba(15,23,42,0.5)";

type PresetKey = 7 | 14 | 30 | "custom";

const PRESETS: { key: PresetKey; label: string; days: number }[] = [
  { key: 7, label: "7 days", days: 7 },
  { key: 14, label: "14 days", days: 14 },
  { key: 30, label: "30 days", days: 30 },
];

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(base: Date, n: number): Date {
  const copy = startOfLocalDay(base);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Maps a target date back to a preset pill when it lands exactly on 7/14/30 days from today. */
function presetForDate(target: Date): PresetKey {
  const today = startOfLocalDay(new Date()).getTime();
  const days = Math.round((startOfLocalDay(target).getTime() - today) / 86400000);
  const match = PRESETS.find((p) => p.days === days);
  return match ? match.key : "custom";
}

/** "Jun 30" short label for the custom pill. */
function shortDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** Book to preselect (defaults to the active book). */
  initialBookId?: string | null;
};

export function ReadingPlanBottomSheet({ visible, onDismiss, initialBookId }: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { darkMode, accentColor } = useAppSettings();
  const { books, activeBookId, scans, updateBookTotalPageCount } = useScanContext();
  const { sessions } = useReadingSession();
  const { getPlanForBook, setPlan, removePlan } = useReadingPlan();

  const mutedColor = darkMode ? MUTED : LIGHT_MUTED;

  const [mounted, setMounted] = useState(false);
  const translateY = useRef(new Animated.Value(winH)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;
  const animatingOut = useRef(false);
  const prevVisible = useRef(false);

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [preset, setPreset] = useState<PresetKey>(7);
  const [customDate, setCustomDate] = useState<Date>(() => addDays(new Date(), 14));
  const [androidPickerVisible, setAndroidPickerVisible] = useState(false);
  /** The inline calendar stays hidden until the reader taps "Custom". */
  const [customPickerVisible, setCustomPickerVisible] = useState(false);
  const [pagesDraft, setPagesDraft] = useState("");
  /** Page count + current page live behind the 3-dots menu since they're rarely changed. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [pagesEditorVisible, setPagesEditorVisible] = useState(false);
  const [currentPageEditorVisible, setCurrentPageEditorVisible] = useState(false);
  const [currentPageDraft, setCurrentPageDraft] = useState("");
  /** Lifts the sheet above the keyboard (transparent Modal + bottom sheet). */
  const [keyboardPad, setKeyboardPad] = useState(0);

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) ?? null,
    [books, selectedBookId]
  );
  const existingPlan = useMemo(
    () => getPlanForBook(selectedBookId),
    [getPlanForBook, selectedBookId]
  );

  const targetDate = useMemo(() => {
    if (preset === "custom") return startOfLocalDay(customDate);
    const found = PRESETS.find((p) => p.key === preset);
    return addDays(new Date(), found ? found.days : 7);
  }, [preset, customDate]);

  // Sync defaults whenever the sheet opens.
  useEffect(() => {
    if (visible && !prevVisible.current) {
      const fallback =
        initialBookId ??
        (activeBookId && books.some((b) => b.id === activeBookId) ? activeBookId : books[0]?.id ?? null);
      setSelectedBookId(fallback);
      setBookPickerOpen(false);
      setCustomPickerVisible(false);
      setMenuOpen(false);
      setPagesEditorVisible(false);
      setCurrentPageEditorVisible(false);
      const plan = getPlanForBook(fallback);
      if (plan) {
        const planDate = startOfLocalDay(new Date(plan.targetFinishDate));
        setCustomDate(planDate);
        setPreset(presetForDate(planDate));
      } else {
        setPreset(7);
        setCustomDate(addDays(new Date(), 14));
      }
    }
    prevVisible.current = visible;
  }, [visible, initialBookId, activeBookId, books, getPlanForBook]);

  const handleDismiss = useCallback(() => {
    if (animatingOut.current) return;
    animatingOut.current = true;
    backdropOp.stopAnimation();
    translateY.stopAnimation();
    Animated.parallel([
      Animated.timing(backdropOp, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: winH,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      animatingOut.current = false;
      if (finished) {
        setMounted(false);
        onDismiss();
      }
    });
  }, [backdropOp, translateY, winH, onDismiss]);

  useEffect(() => {
    if (!visible) return;
    backdropOp.stopAnimation();
    translateY.stopAnimation();
    setMounted(true);
    backdropOp.setValue(0);
    translateY.setValue(winH);
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 68,
          friction: 12,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [visible, winH, backdropOp, translateY]);

  // Keep the editable page-count field in sync with the chosen book.
  useEffect(() => {
    const saved = selectedBook?.totalPageCount;
    setPagesDraft(typeof saved === "number" && saved > 0 ? String(saved) : "");
  }, [selectedBook?.id, selectedBook?.totalPageCount]);

  const draftPageCount = useMemo(() => {
    const n = parseInt(pagesDraft.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [pagesDraft]);

  useEffect(() => {
    if (!mounted) {
      setKeyboardPad(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: { endCoordinates: { height: number } }) => {
      setKeyboardPad(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardPad(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [mounted]);

  const totalPages = useMemo(() => {
    if (!selectedBook) return null;
    return draftPageCount ?? estimateBookPageTotal(selectedBook);
  }, [selectedBook, draftPageCount]);

  const commitPages = useCallback(() => {
    if (!selectedBookId || draftPageCount == null) return;
    if (draftPageCount === selectedBook?.totalPageCount) return;
    updateBookTotalPageCount(selectedBookId, draftPageCount);
  }, [selectedBookId, draftPageCount, selectedBook?.totalPageCount, updateBookTotalPageCount]);
  const detectedCurrentPage = useMemo(
    () => (selectedBookId ? detectCurrentPage(selectedBookId, scans, sessions, existingPlan?.startPage ?? 0) : 0),
    [selectedBookId, scans, sessions, existingPlan?.startPage]
  );

  // Seed the editable "current page" from the detected position when the book changes.
  useEffect(() => {
    setCurrentPageDraft(detectedCurrentPage > 0 ? String(detectedCurrentPage) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId]);

  const currentPage = useMemo(() => {
    const n = parseInt(currentPageDraft.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n) && n >= 0) return n;
    return detectedCurrentPage;
  }, [currentPageDraft, detectedCurrentPage]);

  const daysToTarget = useMemo(() => {
    const today = startOfLocalDay(new Date()).getTime();
    return Math.max(1, Math.round((targetDate.getTime() - today) / 86400000));
  }, [targetDate]);

  const pagesRemaining = useMemo(() => {
    if (totalPages == null || totalPages <= 0) return null;
    return Math.max(0, totalPages - Math.min(currentPage, totalPages));
  }, [totalPages, currentPage]);

  const pagesPerDay = useMemo(() => {
    if (pagesRemaining == null) return null;
    return Math.ceil(pagesRemaining / daysToTarget);
  }, [pagesRemaining, daysToTarget]);

  const hoursToFinish = useMemo(() => {
    if (!selectedBookId || pagesRemaining == null) return null;
    return estimateHoursToFinish(sessions, selectedBookId, pagesRemaining);
  }, [selectedBookId, sessions, pagesRemaining]);

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const onSave = useCallback(() => {
    if (!selectedBookId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    commitPages();
    setPlan({
      bookId: selectedBookId,
      startPage: currentPage,
      targetFinishDate: targetDate.toISOString(),
    });
    handleDismiss();
  }, [selectedBookId, currentPage, targetDate, setPlan, handleDismiss, commitPages]);

  const onRemove = useCallback(() => {
    if (!selectedBookId) return;
    hapticLight();
    Alert.alert(
      "Remove reading goal?",
      "This will delete your goal and progress tracking for this book. You can set a new goal anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove goal",
          style: "destructive",
          onPress: () => {
            removePlan(selectedBookId);
            handleDismiss();
          },
        },
      ]
    );
  }, [selectedBookId, removePlan, handleDismiss]);

  const onSelectPreset = useCallback((key: PresetKey) => {
    hapticLight();
    setPreset(key);
    setCustomPickerVisible(false);
  }, []);

  const onTapCustom = useCallback(() => {
    hapticLight();
    setPreset("custom");
    if (Platform.OS === "android") {
      setAndroidPickerVisible(true);
      return;
    }
    setCustomPickerVisible((v) => !v);
  }, []);

  const onAndroidPickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setAndroidPickerVisible(false);
      if (event.type === "set" && date) setCustomDate(startOfLocalDay(date));
    },
    []
  );

  const minDate = useMemo(() => addDays(new Date(), 1), []);

  // Cap the sheet so lifting it above the keyboard never pushes its top off-screen.
  const sheetMaxHeight =
    keyboardPad > 0
      ? Math.max(280, winH - keyboardPad - insets.top - 12)
      : Math.round(winH * 0.88);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.sheetRoot}>
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: backdropOp }]}>
          <Pressable
            style={[styles.overlay, !darkMode && styles.overlayLight, StyleSheet.absoluteFill]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss reading goal"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            !darkMode && styles.sheetLight,
            {
              paddingBottom: keyboardPad > 0 ? 20 : 20 + insets.bottom,
              marginBottom: keyboardPad,
              maxHeight: sheetMaxHeight,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, !darkMode && styles.handleLight]} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, !darkMode && styles.titleLight]}>
              {existingPlan ? "Edit reading goal" : "Set a reading goal"}
            </Text>
            {books.length > 0 ? (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => {
                  hapticLight();
                  setMenuOpen((o) => !o);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={mutedColor} />
              </TouchableOpacity>
            ) : null}
          </View>

          {menuOpen ? (
            <>
              <Pressable
                style={[StyleSheet.absoluteFill, styles.menuScrim]}
                onPress={() => setMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              />
              <View style={[styles.menuCard, !darkMode && styles.menuCardLight]}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    hapticLight();
                    setMenuOpen(false);
                    setCurrentPageEditorVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="bookmark-outline" size={16} color={mutedColor} />
                  <View style={styles.menuItemTextCol}>
                    <Text style={[styles.menuItemText, !darkMode && styles.menuItemTextLight]}>
                      Edit current page
                    </Text>
                    <Text style={[styles.menuItemSub, !darkMode && styles.menuItemSubLight]}>
                      {currentPage > 0 ? `On page ${currentPage}` : "Not started"}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={[styles.menuDivider, !darkMode && styles.menuDividerLight]} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    hapticLight();
                    setMenuOpen(false);
                    setPagesEditorVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="book-outline" size={16} color={mutedColor} />
                  <View style={styles.menuItemTextCol}>
                    <Text style={[styles.menuItemText, !darkMode && styles.menuItemTextLight]}>
                      Edit page count
                    </Text>
                    <Text style={[styles.menuItemSub, !darkMode && styles.menuItemSubLight]}>
                      {draftPageCount != null ? `${draftPageCount} pages` : "Not set"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {books.length === 0 ? (
              <Text style={[styles.emptyNote, !darkMode && styles.emptyNoteLight]}>
                Add a book to your library first, then set a goal to finish it.
              </Text>
            ) : (
              <>
                <Text style={[styles.fieldLabel, !darkMode && styles.fieldLabelLight]}>Book</Text>
                <View style={[styles.bookCard, !darkMode && styles.bookCardLight]}>
                  <TouchableOpacity
                    style={styles.bookRow}
                    onPress={() => {
                      hapticLight();
                      setBookPickerOpen((o) => !o);
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: bookPickerOpen }}
                  >
                    <View style={styles.bookRowText}>
                      <Text style={[styles.bookTitle, !darkMode && styles.bookTitleLight]} numberOfLines={1}>
                        {selectedBook?.title ?? "Select a book"}
                      </Text>
                      {selectedBook ? (
                        <Text style={[styles.bookMeta, !darkMode && styles.bookMetaLight]} numberOfLines={1}>
                          {currentPage > 0
                            ? `On page ${totalPages != null ? Math.min(currentPage, totalPages) : currentPage}`
                            : "Not started yet"}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={bookPickerOpen ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={mutedColor}
                    />
                  </TouchableOpacity>
                  {bookPickerOpen ? (
                    <View style={[styles.bookList, !darkMode && styles.bookListLight]}>
                      {books.map((book) => {
                        const sel = book.id === selectedBookId;
                        return (
                          <TouchableOpacity
                            key={book.id}
                            style={[styles.pickerRow, sel && (darkMode ? styles.pickerRowSel : styles.pickerRowSelLight)]}
                            onPress={() => {
                              hapticLight();
                              setSelectedBookId(book.id);
                              setBookPickerOpen(false);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[styles.pickerRowText, !darkMode && styles.pickerRowTextLight]}
                              numberOfLines={2}
                            >
                              {book.title}
                            </Text>
                            {sel ? <Ionicons name="checkmark" size={18} color={accentColor} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>

                {currentPageEditorVisible ? (
                  <>
                    <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, !darkMode && styles.fieldLabelLight]}>
                      Current page
                    </Text>
                    <View style={[styles.pagesField, !darkMode && styles.pagesFieldLight]}>
                      <TextInput
                        value={currentPageDraft}
                        onChangeText={(t) => setCurrentPageDraft(t.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        placeholder="e.g. 42"
                        placeholderTextColor={mutedColor}
                        style={[styles.pagesInput, !darkMode && styles.pagesInputLight]}
                        selectionColor={accentColor}
                        maxLength={5}
                        autoFocus
                      />
                      <Text style={[styles.pagesSuffix, !darkMode && styles.pagesSuffixLight]}>page</Text>
                    </View>
                  </>
                ) : null}

                {pagesEditorVisible ? (
                  <>
                    <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, !darkMode && styles.fieldLabelLight]}>
                      Pages in book
                    </Text>
                    <View style={[styles.pagesField, !darkMode && styles.pagesFieldLight]}>
                      <TextInput
                        value={pagesDraft}
                        onChangeText={(t) => setPagesDraft(t.replace(/[^0-9]/g, ""))}
                        onBlur={commitPages}
                        onSubmitEditing={commitPages}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        placeholder="e.g. 320"
                        placeholderTextColor={mutedColor}
                        style={[styles.pagesInput, !darkMode && styles.pagesInputLight]}
                        selectionColor={accentColor}
                        maxLength={5}
                        autoFocus
                      />
                      <Text style={[styles.pagesSuffix, !darkMode && styles.pagesSuffixLight]}>pages</Text>
                    </View>
                  </>
                ) : null}

                <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, !darkMode && styles.fieldLabelLight]}>
                  Finish by
                </Text>
                <View style={styles.presetRow}>
                  {PRESETS.map((p) => {
                    const sel = preset === p.key;
                    return (
                      <TouchableOpacity
                        key={p.key}
                        style={[
                          styles.presetPill,
                          !darkMode && styles.presetPillLight,
                          sel && { backgroundColor: accentColor, borderColor: accentColor },
                        ]}
                        onPress={() => onSelectPreset(p.key)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.presetPillText,
                            !darkMode && styles.presetPillTextLight,
                            sel && styles.presetPillTextSel,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.presetPill,
                      styles.presetPillCustom,
                      !darkMode && styles.presetPillLight,
                      preset === "custom" && { backgroundColor: accentColor, borderColor: accentColor },
                    ]}
                    onPress={onTapCustom}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        !darkMode && styles.presetPillTextLight,
                        preset === "custom" && styles.presetPillTextSel,
                      ]}
                      numberOfLines={1}
                    >
                      {preset === "custom" ? shortDateLabel(customDate) : "Custom"}
                    </Text>
                    <Ionicons
                      name={customPickerVisible ? "chevron-up" : "calendar-outline"}
                      size={12}
                      color={preset === "custom" ? "#ffffff" : mutedColor}
                    />
                  </TouchableOpacity>
                </View>

                {customPickerVisible && Platform.OS === "ios" ? (
                  <View style={styles.iosPickerWrap}>
                    <DateTimePicker
                      value={customDate}
                      mode="date"
                      display="spinner"
                      minimumDate={minDate}
                      themeVariant={darkMode ? "dark" : "light"}
                      onChange={(_e, date) => {
                        if (date) setCustomDate(startOfLocalDay(date));
                      }}
                    />
                  </View>
                ) : null}

                <View style={[styles.summaryCard, !darkMode && styles.summaryCardLight]}>
                  <Text style={[styles.summaryTarget, !darkMode && styles.summaryTargetLight]}>
                    Finish by {formatPlanTargetDate(targetDate.toISOString())}
                  </Text>
                  {pagesPerDay != null ? (
                    <Text style={[styles.summaryPace, { color: accentColor }]}>
                      About {pagesPerDay} {pagesPerDay === 1 ? "page" : "pages"}/day
                    </Text>
                  ) : (
                    <Text style={[styles.summaryPaceMuted, !darkMode && styles.summaryPaceMutedLight]}>
                      Add this book's page count to see a daily target.
                    </Text>
                  )}
                  {hoursToFinish != null ? (
                    <Text style={[styles.summaryHours, !darkMode && styles.summaryHoursLight]}>
                      {`At your pace, about ${formatHoursToFinish(hoursToFinish)} of reading left`}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: accentColor }, !selectedBookId && styles.saveBtnDisabled]}
                  onPress={onSave}
                  activeOpacity={0.9}
                  disabled={!selectedBookId}
                >
                  <Ionicons name="flag" size={18} color="#ffffff" />
                  <Text style={styles.saveBtnText}>
                    {existingPlan ? "Update goal" : "Set reading goal"}
                  </Text>
                </TouchableOpacity>

                {existingPlan ? (
                  <TouchableOpacity onPress={onRemove} style={styles.removeHit} hitSlop={{ top: 8, bottom: 8 }}>
                    <Text style={[styles.removeText, !darkMode && styles.removeTextLight]}>Remove goal</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>

      {androidPickerVisible ? (
        <DateTimePicker
          value={customDate}
          mode="date"
          display="default"
          minimumDate={minDate}
          onChange={onAndroidPickerChange}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    backgroundColor: OVERLAY,
  },
  overlayLight: {
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 0.5,
    borderTopColor: BORDER_10,
    paddingHorizontal: 20,
  },
  sheetLight: {
    backgroundColor: "#ffffff",
    borderTopColor: "rgba(15,23,42,0.1)",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  handleLight: {
    backgroundColor: "rgba(15,23,42,0.15)",
  },
  headerRow: {
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: FONT_CANELA_TEXT_REGULAR,
    color: "#ffffff",
    textAlign: "center",
    paddingHorizontal: 36,
  },
  titleLight: {
    color: "#0f172a",
  },
  menuButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  menuScrim: {
    zIndex: 15,
  },
  menuCard: {
    position: "absolute",
    top: 44,
    right: 0,
    minWidth: 200,
    zIndex: 20,
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: "#242424",
    borderColor: BORDER_10,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  menuCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(15,23,42,0.08)",
    shadowOpacity: 0.12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_10,
    marginHorizontal: 14,
  },
  menuDividerLight: {
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  menuItemTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
  },
  menuItemTextLight: {
    color: "#0f172a",
  },
  menuItemSub: {
    fontSize: 12,
    fontWeight: "400",
    color: MUTED,
  },
  menuItemSubLight: {
    color: LIGHT_MUTED,
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  emptyNote: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    paddingVertical: 24,
  },
  emptyNoteLight: {
    color: LIGHT_MUTED,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
    marginBottom: 8,
  },
  fieldLabelSpaced: {
    marginTop: 18,
  },
  fieldLabelLight: {
    color: LIGHT_MUTED,
  },
  bookCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: CARD_BG,
    borderColor: BORDER_10,
    overflow: "hidden",
  },
  bookCardLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.1)",
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  bookRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
  bookTitleLight: {
    color: "#0f172a",
  },
  bookMeta: {
    fontSize: 12,
    fontWeight: "400",
    color: MUTED,
  },
  bookMetaLight: {
    color: LIGHT_MUTED,
  },
  bookList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxHeight: 220,
  },
  bookListLight: {
    borderTopColor: "rgba(15,23,42,0.1)",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 8,
  },
  pickerRowSel: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pickerRowSelLight: {
    backgroundColor: "rgba(15,23,42,0.05)",
  },
  pickerRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
  },
  pickerRowTextLight: {
    color: "#0f172a",
  },
  pagesField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: CARD_BG,
    borderColor: BORDER_10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  pagesFieldLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.1)",
  },
  pagesInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
    padding: 0,
    margin: 0,
  },
  pagesInputLight: {
    color: "#0f172a",
  },
  pagesSuffix: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
  },
  pagesSuffixLight: {
    color: LIGHT_MUTED,
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
  },
  presetPill: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: BORDER_10,
    backgroundColor: CARD_BG,
  },
  presetPillLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.1)",
  },
  presetPillCustom: {
    flexDirection: "row",
    gap: 4,
  },
  presetPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  presetPillTextLight: {
    color: "#0f172a",
  },
  presetPillTextSel: {
    color: "#ffffff",
  },
  iosPickerWrap: {
    marginTop: 8,
    alignItems: "center",
  },
  summaryCard: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: BORDER_10,
    gap: 4,
  },
  summaryCardLight: {
    backgroundColor: "rgba(15,23,42,0.04)",
    borderColor: "rgba(15,23,42,0.1)",
  },
  summaryTarget: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  summaryTargetLight: {
    color: "#0f172a",
  },
  summaryPace: {
    fontSize: 14,
    fontWeight: "600",
  },
  summaryPaceMuted: {
    fontSize: 13,
    fontWeight: "400",
    color: MUTED,
  },
  summaryPaceMutedLight: {
    color: LIGHT_MUTED,
  },
  summaryHours: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: MUTED,
  },
  summaryHoursLight: {
    color: LIGHT_MUTED,
  },
  saveBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  removeHit: {
    alignSelf: "center",
    paddingVertical: 10,
    marginTop: 6,
  },
  removeText: {
    fontSize: 14,
    fontWeight: "500",
    color: MUTED,
  },
  removeTextLight: {
    color: LIGHT_MUTED,
  },
});
