import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAppSettings } from "../context/AppSettingsContext";
import { useReadingSession } from "../context/ReadingSessionContext";
import { useScanContext } from "../context/ScanContext";
import type { ScanStackParamList } from "../navigation/types";
import { hexWithAlpha } from "../theme/colorUtils";
import { darkColors, lightColors } from "../theme/colors";

type ScanNav = NativeStackNavigationProp<ScanStackParamList, "ScanCamera">;

function formatElapsed(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function ReadingTimerCard() {
  const navigation = useNavigation<ScanNav>();
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const { books, activeBookId } = useScanContext();
  const { sessions, run, startReading, stopReading, saveReading, cancelReading } = useReadingSession();
  const [startPageDraft, setStartPageDraft] = useState("");
  const [endPageDraft, setEndPageDraft] = useState("");
  const [tick, setTick] = useState(0);
  /** `undefined` until first sync with library; `null` = explicit “No book”. */
  const [timerBookId, setTimerBookId] = useState<string | null | undefined>(undefined);

  const isIdle = run === null;
  const isActive = run?.phase === "active";
  const isStopped = run?.phase === "stopped";

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

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

  const elapsedSeconds = useMemo(() => {
    if (!run) return 0;
    if (run.phase === "active") {
      return Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000));
    }
    return Math.max(0, Math.floor((run.stoppedAt - run.startedAt) / 1000));
  }, [run, tick]);

  const hapticLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={[styles.card, darkMode && styles.cardDark]}>
      <View style={styles.headerRow}>
        <Ionicons name="timer-outline" size={20} color={accentColor} />
        <Text style={[styles.title, darkMode && styles.titleDark]}>Reading timer</Text>
      </View>
      <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
        Track time and page range while you read. Sessions are saved on this device.
      </Text>
      <TouchableOpacity
        style={styles.viewHistoryRow}
        onPress={() => {
          hapticLight();
          navigation.navigate("ReadingHistory");
        }}
        activeOpacity={0.75}
        hitSlop={{ top: 4, bottom: 8 }}
      >
        <Text style={[styles.viewHistoryText, { color: accentColor }]}>View history</Text>
        {sessions.length > 0 ? (
          <View style={[styles.historyBadge, { backgroundColor: accentColor + "22" }]}>
            <Text style={[styles.historyBadgeText, { color: accentColor }]}>{sessions.length}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={accentColor} />
      </TouchableOpacity>

      {isIdle ? (
        <>
          <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>Book</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bookPillScroll}
          >
            <TouchableOpacity
              style={[
                styles.bookPill,
                darkMode && styles.bookPillDarkBase,
                timerBookId === null && {
                  backgroundColor: hexWithAlpha(accentColor, 0.16),
                  borderColor: hexWithAlpha(accentColor, 0.45),
                },
              ]}
              onPress={() => {
                hapticLight();
                setTimerBookId(null);
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.bookPillText,
                  darkMode && styles.bookPillTextDarkBase,
                  timerBookId === null && { color: accentColor, fontWeight: "700" as const },
                ]}
              >
                No book
              </Text>
            </TouchableOpacity>
            {books.map((book) => {
              const isActive = timerBookId === book.id;
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
                  onPress={() => {
                    hapticLight();
                    setTimerBookId(book.id);
                  }}
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
          </ScrollView>
          <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>Page you start on</Text>
          <TextInput
            value={startPageDraft}
            onChangeText={setStartPageDraft}
            placeholder="e.g. 42"
            placeholderTextColor={darkMode ? "#64748b" : "#94a3b8"}
            style={[styles.input, darkMode && styles.inputDark]}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={styles.primaryWrap}
            onPress={() => {
              if (!startPageDraft.trim()) return;
              hapticLight();
              startReading(startPageDraft, timerBookId === undefined ? null : timerBookId);
            }}
            activeOpacity={0.9}
            disabled={!startPageDraft.trim()}
          >
            <LinearGradient
              colors={accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.primaryGradient, !startPageDraft.trim() && styles.primaryGradientDisabled]}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.primaryText}>Start timer</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      ) : null}

      {isActive && run ? (
        <>
          <View style={styles.timerBlock}>
            <Text style={[styles.timerValue, darkMode && styles.timerValueDark]}>{formatElapsed(elapsedSeconds)}</Text>
            <Text style={[styles.timerMeta, darkMode && styles.timerMetaDark]}>
              From page {run.startPage}
              {run.bookTitle ? ` · ${run.bookTitle}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              hapticLight();
              stopReading();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryBtnText, { color: accentColor }]}>Stop timer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { hapticLight(); cancelReading(); }} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={[styles.cancelText, darkMode && styles.cancelTextDark]}>Cancel session</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {isStopped && run ? (
        <>
          <View style={styles.timerBlock}>
            <Text style={[styles.timerValue, darkMode && styles.timerValueDark]}>{formatElapsed(elapsedSeconds)}</Text>
            <Text style={[styles.timerMeta, darkMode && styles.timerMetaDark]}>
              Started on page {run.startPage}
              {run.bookTitle ? ` · ${run.bookTitle}` : ""}
            </Text>
          </View>
          <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>Page you finished on</Text>
          <TextInput
            value={endPageDraft}
            onChangeText={setEndPageDraft}
            placeholder="e.g. 67"
            placeholderTextColor={darkMode ? "#64748b" : "#94a3b8"}
            style={[styles.input, darkMode && styles.inputDark]}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={styles.primaryWrap}
            onPress={() => {
              if (!endPageDraft.trim()) return;
              hapticLight();
              saveReading(endPageDraft);
            }}
            activeOpacity={0.9}
            disabled={!endPageDraft.trim()}
          >
            <LinearGradient
              colors={accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.primaryGradient, !endPageDraft.trim() && styles.primaryGradientDisabled]}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.primaryText}>Save session</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { hapticLight(); cancelReading(); }} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={[styles.cancelText, darkMode && styles.cancelTextDark]}>Discard</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 14,
    gap: 8,
  },
  cardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: lightColors.textPrimary,
  },
  titleDark: {
    color: darkColors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: lightColors.textMuted,
    marginBottom: 4,
  },
  subtitleDark: {
    color: darkColors.textSecondary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: lightColors.textSecondary,
    marginTop: 4,
  },
  fieldLabelDark: {
    color: darkColors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.background,
  },
  inputDark: {
    borderColor: darkColors.border,
    color: darkColors.textPrimary,
    backgroundColor: darkColors.background,
  },
  primaryWrap: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  primaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  primaryGradientDisabled: {
    opacity: 0.45,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  timerBlock: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  timerValue: {
    fontSize: 36,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    color: lightColors.textPrimary,
  },
  timerValueDark: {
    color: darkColors.textPrimary,
  },
  timerMeta: {
    fontSize: 13,
    color: lightColors.textMuted,
    textAlign: "center",
  },
  timerMetaDark: {
    color: darkColors.textSecondary,
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  cancelText: {
    fontSize: 13,
    color: lightColors.textMuted,
    textAlign: "center",
    paddingVertical: 4,
  },
  cancelTextDark: {
    color: darkColors.textSecondary,
  },
  viewHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  viewHistoryText: {
    fontSize: 14,
    fontWeight: "700",
  },
  bookPillScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
    paddingRight: 4,
  },
  bookPill: {
    maxWidth: 160,
    backgroundColor: lightColors.chipBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  historyBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
