import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
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
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { getActiveElapsedSeconds, useReadingSession } from "../context/ReadingSessionContext";
import { useScanContext } from "../context/ScanContext";
import type { RootTabParamList } from "../navigation/types";
import { FONT_CANELA_TEXT_REGULAR } from "../theme/fonts";

const SHEET_BG = "#1a1a1a";
const OVERLAY = "rgba(0,0,0,0.7)";
const BORDER_10 = "rgba(255,255,255,0.1)";
const CARD_BG = "rgba(255,255,255,0.05)";
const INPUT_BG = "rgba(255,255,255,0.06)";
const PAUSE_BG = "rgba(255,255,255,0.07)";
const MUTED = "rgba(255,255,255,0.45)";
const BLUE_DOT = "#3b82f6";
const PRIMARY_WHITE = "#ffffff";
const PRIMARY_TEXT = "#111111";

function formatElapsedHMS(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function ReadingTimerBottomSheet({ visible, onDismiss }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { books, activeBookId } = useScanContext();
  const { sessions, run, startReading, pauseReading, resumeReading, stopReading, saveReading, cancelReading } =
    useReadingSession();

  const [startPageDraft, setStartPageDraft] = useState("");
  const [endPageDraft, setEndPageDraft] = useState("");
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const translateY = useRef(new Animated.Value(winH)).current;
  const animatingOut = useRef(false);
  const prevVisible = useRef(visible);

  /** `undefined` until first sync with library; `null` = explicit “No book”. */
  const [timerBookId, setTimerBookId] = useState<string | null | undefined>(undefined);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const isIdle = run === null;
  const isRunning = run?.phase === "running";
  const isPaused = run?.phase === "paused";
  const isStopped = run?.phase === "stopped";

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    if (isIdle) {
      setStartPageDraft("");
      setEndPageDraft("");
    }
  }, [isIdle]);

  useEffect(() => {
    if (books.length === 0) {
      setTimerBookId(null);
      return;
    }
    setTimerBookId((prev) => {
      if (prev === undefined) {
        return activeBookId && books.some((b) => b.id === activeBookId) ? activeBookId : books[0].id;
      }
      if (prev === null) return null;
      if (books.some((b) => b.id === prev)) return prev;
      return activeBookId && books.some((b) => b.id === activeBookId) ? activeBookId : books[0].id;
    });
  }, [books, activeBookId]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setBookPickerOpen(false);
    }
    prevVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardOpen(false);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (animatingOut.current) return;
    animatingOut.current = true;
    Animated.timing(translateY, {
      toValue: winH,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      animatingOut.current = false;
      if (finished) onDismiss();
    });
  }, [winH, translateY, onDismiss]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(winH);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    } else {
      translateY.setValue(winH);
    }
  }, [visible, winH, translateY]);

  const elapsedSeconds = useMemo(() => getActiveElapsedSeconds(run), [run, tick]);

  const selectedBookTitle = useMemo(() => {
    if (timerBookId === undefined) return "Select a book";
    if (timerBookId === null) return "Not tied to a book";
    return books.find((b) => b.id === timerBookId)?.title ?? "Select a book";
  }, [timerBookId, books]);

  const activeMetaLine = useMemo(() => {
    if (!run || run.phase === "stopped") return "";
    const page = run.startPage;
    if (run.bookTitle) return `p. ${page} · ${run.bookTitle}`;
    return `p. ${page}`;
  }, [run]);

  const stoppedMetaLine = useMemo(() => {
    if (!run || run.phase !== "stopped") return "";
    const page = run.startPage;
    if (run.bookTitle) return `p. ${page} · ${run.bookTitle}`;
    return `p. ${page}`;
  }, [run]);

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const openSavedSessions = useCallback(() => {
    hapticLight();
    onDismiss();
    const tabNav = navigation.getParent<NavigationProp<RootTabParamList>>();
    requestAnimationFrame(() => {
      tabNav?.navigate("ScanFlow", { screen: "ReadingHistory" });
    });
  }, [navigation, onDismiss]);

  const timerFontFamily = Platform.OS === "ios" ? "Menlo" : "monospace";

  // Full-screen modal: avoid keyboardVerticalOffset=insets.top (that’s for stacked headers) — it adds a gap above the keyboard.
  // When the keyboard is open, skip home-indicator padding on the sheet; KeyboardAvoidingView already clears the keyboard.
  const sheetBottomPad = keyboardOpen ? 12 : 28 + insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={[styles.overlay, StyleSheet.absoluteFill]} onPress={handleDismiss} accessibilityRole="button" accessibilityLabel="Dismiss reading timer" />
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: sheetBottomPad,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Reading timer</Text>

            {bookPickerOpen ? (
              <ScrollView
                style={styles.pickerScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.pickerSectionLabel}>Choose book</Text>
                <TouchableOpacity
                  style={[styles.pickerRow, timerBookId === null && styles.pickerRowSelected]}
                  onPress={() => {
                    hapticLight();
                    setTimerBookId(null);
                    setBookPickerOpen(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pickerRowText}>Not tied to a book</Text>
                  {timerBookId === null ? <Ionicons name="checkmark" size={18} color={MUTED} /> : null}
                </TouchableOpacity>
                {books.map((book) => {
                  const sel = timerBookId === book.id;
                  return (
                    <TouchableOpacity
                      key={book.id}
                      style={[styles.pickerRow, sel && styles.pickerRowSelected]}
                      onPress={() => {
                        hapticLight();
                        setTimerBookId(book.id);
                        setBookPickerOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.pickerRowText} numberOfLines={2}>
                        {book.title}
                      </Text>
                      {sel ? <Ionicons name="checkmark" size={18} color={MUTED} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {isIdle ? (
                  <View style={styles.bodyGap}>
                    <TouchableOpacity
                      style={styles.bookRow}
                      onPress={() => {
                        hapticLight();
                        setBookPickerOpen(true);
                      }}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityLabel="Choose book for reading timer"
                    >
                      <View style={styles.bookRowLeft}>
                        <View style={styles.blueDot} />
                        <View style={styles.bookRowTextCol}>
                          <Text style={styles.labelMuted}>Reading</Text>
                          <Text style={styles.bookTitleText} numberOfLines={1}>
                            {selectedBookTitle}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-down" size={16} color={MUTED} />
                    </TouchableOpacity>

                    <View>
                      <Text style={styles.fieldLabel}>Page you start on</Text>
                      <TextInput
                        value={startPageDraft}
                        onChangeText={setStartPageDraft}
                        placeholder="e.g. 42"
                        placeholderTextColor={MUTED}
                        style={styles.textInput}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (startPageDraft.trim()) {
                            hapticLight();
                            startReading(startPageDraft, timerBookId === undefined ? null : timerBookId);
                          }
                        }}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.startBtn, !startPageDraft.trim() && styles.startBtnDisabled]}
                      onPress={() => {
                        if (!startPageDraft.trim()) return;
                        hapticLight();
                        startReading(startPageDraft, timerBookId === undefined ? null : timerBookId);
                      }}
                      activeOpacity={0.9}
                      disabled={!startPageDraft.trim()}
                    >
                      <Ionicons name="play" size={20} color={PRIMARY_TEXT} />
                      <Text style={styles.startBtnText}>Start timer</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {(isRunning || isPaused) && run ? (
                  <View style={styles.bodyGap}>
                    <View style={styles.timerBlock}>
                      <Text style={[styles.timerHuge, { fontFamily: timerFontFamily }]}>
                        {formatElapsedHMS(elapsedSeconds)}
                      </Text>
                      <Text style={styles.timerMeta}>{activeMetaLine}</Text>
                    </View>

                    <View style={styles.twoColRow}>
                      <TouchableOpacity
                        style={styles.pauseBtn}
                        onPress={() => {
                          hapticLight();
                          if (isRunning) pauseReading();
                          else resumeReading();
                        }}
                        activeOpacity={0.88}
                      >
                        <Ionicons name={isRunning ? "pause" : "play"} size={18} color="#ffffff" />
                        <Text style={styles.pauseBtnText}>{isRunning ? "Pause" : "Resume"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.stopSaveBtn}
                        onPress={() => {
                          hapticLight();
                          stopReading();
                        }}
                        activeOpacity={0.88}
                      >
                        <Ionicons name="stop" size={18} color={PRIMARY_TEXT} />
                        <Text style={styles.stopSaveBtnText}>Stop & save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {isStopped && run ? (
                  <View style={styles.bodyGap}>
                    <View style={styles.timerBlock}>
                      <Text style={[styles.timerHuge, { fontFamily: timerFontFamily }]}>
                        {formatElapsedHMS(run.durationSeconds)}
                      </Text>
                      <Text style={styles.timerMeta}>{stoppedMetaLine}</Text>
                    </View>

                    <View>
                      <Text style={styles.fieldLabel}>Page you finished on</Text>
                      <TextInput
                        value={endPageDraft}
                        onChangeText={setEndPageDraft}
                        placeholder="e.g. 67"
                        placeholderTextColor={MUTED}
                        style={styles.textInput}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (endPageDraft.trim()) {
                            hapticLight();
                            saveReading(endPageDraft);
                          }
                        }}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.startBtn, !endPageDraft.trim() && styles.startBtnDisabled]}
                      onPress={() => {
                        if (!endPageDraft.trim()) return;
                        hapticLight();
                        saveReading(endPageDraft);
                      }}
                      activeOpacity={0.9}
                      disabled={!endPageDraft.trim()}
                    >
                      <Ionicons name="checkmark" size={20} color={PRIMARY_TEXT} />
                      <Text style={styles.startBtnText}>Save session</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        hapticLight();
                        cancelReading();
                      }}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={styles.discardHit}
                    >
                      <Text style={styles.discardText}>Discard</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.savedSessionsRow}
                  onPress={openSavedSessions}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="View saved reading sessions"
                >
                  <Text style={styles.savedSessionsLabel}>Saved sessions</Text>
                  {sessions.length > 0 ? (
                    <View style={styles.savedSessionsBadge}>
                      <Text style={styles.savedSessionsBadgeText}>{sessions.length}</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={MUTED} />
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    backgroundColor: OVERLAY,
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "88%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: FONT_CANELA_TEXT_REGULAR,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 18,
  },
  bodyGap: {
    gap: 16,
    paddingBottom: 8,
  },
  bookRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: CARD_BG,
    borderColor: BORDER_10,
  },
  bookRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLUE_DOT,
  },
  bookRowTextCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  labelMuted: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
  },
  bookTitleText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
    marginBottom: 6,
  },
  textInput: {
    width: "100%",
    backgroundColor: INPUT_BG,
    borderWidth: 0.5,
    borderColor: BORDER_10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#ffffff",
  },
  startBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: PRIMARY_WHITE,
    borderRadius: 16,
    paddingVertical: 18,
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: PRIMARY_TEXT,
  },
  timerBlock: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  timerHuge: {
    fontSize: 54,
    fontWeight: "600",
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
  },
  timerMeta: {
    fontSize: 15,
    fontWeight: "400",
    color: MUTED,
    textAlign: "center",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  pauseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PAUSE_BG,
    borderWidth: 0.5,
    borderColor: BORDER_10,
    borderRadius: 12,
    paddingVertical: 14,
  },
  pauseBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  stopSaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PRIMARY_WHITE,
    borderRadius: 12,
    paddingVertical: 14,
  },
  stopSaveBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: PRIMARY_TEXT,
  },
  pickerScroll: {
    maxHeight: 360,
    marginBottom: 8,
  },
  pickerSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: BORDER_10,
  },
  pickerRowSelected: {
    borderColor: "rgba(255,255,255,0.22)",
  },
  pickerRowText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
    color: "#ffffff",
    marginRight: 8,
  },
  discardHit: {
    alignSelf: "center",
    paddingVertical: 6,
  },
  discardText: {
    fontSize: 15,
    fontWeight: "500",
    color: MUTED,
  },
  savedSessionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 20,
    paddingBottom: 4,
  },
  savedSessionsLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: MUTED,
  },
  savedSessionsBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedSessionsBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
