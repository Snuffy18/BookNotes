import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettings } from "../context/AppSettingsContext";
import type { LibraryStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<LibraryStackParamList, "ReportDetails">;

export function ReportDetailsScreen({ route }: Props) {
  const { darkMode, accentColor } = useAppSettings();
  const { item, highlightQuery } = route.params;
  const createdAt = new Date(item.createdAt);
  const createdLabel = createdAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const readingMinutes = Math.max(1, Math.round((item.notes.detailedNotes.length || 120) / 900));
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [highlightActive, setHighlightActive] = useState(Boolean(highlightQuery));
  const highlightOpacity = useRef(new Animated.Value(0)).current;

  const normalizedQuery = useMemo(
    () => (highlightQuery ?? "").trim().toLowerCase(),
    [highlightQuery]
  );
  const accentRgb = useMemo(() => hexToRgb(accentColor), [accentColor]);
  const highlightBgColor = useMemo(
    () =>
      highlightOpacity.interpolate({
        inputRange: [0, 1],
        outputRange: [
          `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0)`,
          `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.95)`,
        ],
      }),
    [accentRgb, highlightOpacity]
  );

  const matchedSection = useMemo(() => {
    if (!normalizedQuery) return null;
    if (item.notes.summary.toLowerCase().includes(normalizedQuery)) return "summary";
    if (item.notes.mainIdeas.some((idea) => idea.toLowerCase().includes(normalizedQuery)))
      return "mainIdeas";
    if (item.notes.detailedNotes.toLowerCase().includes(normalizedQuery)) return "detailedNotes";
    if (item.notes.keywords.some((k) => k.toLowerCase().includes(normalizedQuery))) return "keywords";
    return null;
  }, [item.notes, normalizedQuery]);

  useEffect(() => {
    if (!normalizedQuery) return;
    setHighlightActive(true);
    const sequence = Animated.sequence([
      Animated.timing(highlightOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(1800),
      Animated.timing(highlightOpacity, {
        toValue: 0,
        duration: 1200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    sequence.start();
    const timer = setTimeout(() => {
      setHighlightActive(false);
      highlightOpacity.setValue(0);
    }, 3600);
    return () => clearTimeout(timer);
  }, [normalizedQuery, highlightOpacity]);

  useEffect(() => {
    if (!matchedSection) return;
    const y = sectionY.current[matchedSection];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  }, [matchedSection]);

  const renderHighlightedText = (text: string, baseStyle: any) => {
    if (!normalizedQuery || !highlightActive) {
      return <Text style={baseStyle}>{text}</Text>;
    }
    const lower = text.toLowerCase();
    const parts: Array<{ value: string; hit: boolean }> = [];
    let cursor = 0;
    while (true) {
      const idx = lower.indexOf(normalizedQuery, cursor);
      if (idx === -1) break;
      if (idx > cursor) {
        parts.push({ value: text.slice(cursor, idx), hit: false });
      }
      parts.push({
        value: text.slice(idx, idx + normalizedQuery.length),
        hit: true,
      });
      cursor = idx + normalizedQuery.length;
    }
    if (cursor < text.length) {
      parts.push({ value: text.slice(cursor), hit: false });
    }
    if (parts.length === 0) {
      return <Text style={baseStyle}>{text}</Text>;
    }
    return (
      <Text style={baseStyle}>
        {parts.map((part, index) => (
          <Animated.Text
            key={`${part.value}-${index}`}
            style={
              part.hit
                ? [styles.highlightText, { backgroundColor: highlightBgColor, color: "#fff" }]
                : undefined
            }
          >
            {part.value}
          </Animated.Text>
        ))}
      </Text>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.heroCard, darkMode && styles.cardDark]}>
          <Text style={[styles.heroTitle, darkMode && styles.textPrimaryDark]}>
            {item.book ?? "Report Details"}
          </Text>
          <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>{createdLabel}</Text>
          <View style={styles.heroMetaRow}>
            <View style={[styles.badge, { borderColor: accentColor }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>High confidence</Text>
            </View>
            <Text style={[styles.heroMeta, darkMode && styles.textMutedDark]}>
              ~{readingMinutes} min read
            </Text>
          </View>
        </View>

        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.summary = e.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Summary</Text>
          {renderHighlightedText(item.notes.summary, [
            styles.sectionText,
            darkMode && styles.textSecondaryDark,
          ])}
        </View>

        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.mainIdeas = e.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Main Ideas</Text>
          <View style={styles.ideasList}>
            {item.notes.mainIdeas.map((idea, index) => (
              <View key={`${idea}-${index}`} style={styles.ideaRow}>
                <View style={[styles.ideaIndex, { borderColor: accentColor }]}>
                  <Text style={[styles.ideaIndexText, { color: accentColor }]}>{index + 1}</Text>
                </View>
                {renderHighlightedText(idea, [
                  styles.sectionText,
                  styles.ideaText,
                  darkMode && styles.textSecondaryDark,
                ])}
              </View>
            ))}
          </View>
        </View>

        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.detailedNotes = e.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Detailed Notes</Text>
          {renderHighlightedText(item.notes.detailedNotes, [
            styles.sectionText,
            darkMode && styles.textSecondaryDark,
          ])}
        </View>

        <View
          style={[styles.sectionCard, darkMode && styles.cardDark]}
          onLayout={(e) => {
            sectionY.current.keywords = e.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle, darkMode && styles.textPrimaryDark]}>Keywords</Text>
          <View style={styles.keywordWrap}>
            {item.notes.keywords.map((keyword) => {
              const isMatch =
                Boolean(normalizedQuery) &&
                highlightActive &&
                keyword.toLowerCase().includes(normalizedQuery);
              return (
                <Animated.View
                  key={keyword}
                  style={[
                    styles.keywordChip,
                    { borderColor: accentColor },
                    isMatch
                      ? [
                          styles.keywordChipHighlight,
                          {
                            backgroundColor: highlightBgColor,
                          },
                        ]
                      : null,
                  ]}
                >
                  <Text style={[styles.keywordText, { color: isMatch ? "#fff" : accentColor }]}>
                    {keyword}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.stickyActionBar, darkMode && styles.cardDark]}>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="copy-outline" size={18} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
          <Text style={[styles.actionText, darkMode && styles.textPrimaryDark]}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="share-outline" size={18} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
          <Text style={[styles.actionText, darkMode && styles.textPrimaryDark]}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtnPrimary, { backgroundColor: accentColor }]}>
          <Ionicons name="sparkles-outline" size={18} color="#fff" />
          <Text style={styles.actionTextPrimary}>Ask AI</Text>
        </TouchableOpacity>
      </View>
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
  scrollContent: {
    paddingBottom: 110 + 72,
    gap: 12,
  },
  cardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  heroCard: {
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  heroTitle: {
    color: lightColors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  heroMeta: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: lightColors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  sectionText: {
    color: lightColors.textSecondary,
    lineHeight: 21,
  },
  textPrimaryDark: {
    color: darkColors.textPrimary,
  },
  textSecondaryDark: {
    color: darkColors.textSecondary,
  },
  textMutedDark: {
    color: darkColors.textMuted,
  },
  ideasList: {
    gap: 10,
  },
  ideaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  ideaIndex: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  ideaIndexText: {
    fontSize: 12,
    fontWeight: "700",
  },
  ideaText: {
    flex: 1,
  },
  keywordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  keywordChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  keywordChipHighlight: {
    borderColor: "transparent",
  },
  keywordText: {
    fontSize: 12,
    fontWeight: "700",
  },
  highlightText: {
    borderRadius: 4,
  },
  stickyActionBar: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: "row",
    gap: 8,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 22,
    padding: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    flexDirection: "row",
    gap: 6,
  },
  actionBtnPrimary: {
    flex: 1.3,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    flexDirection: "row",
    gap: 6,
  },
  actionText: {
    color: lightColors.textPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  actionTextPrimary: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
});

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => char + char)
        .join("")
    : normalized;
  const int = parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}
