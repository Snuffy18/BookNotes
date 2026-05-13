import { useCallback, useLayoutEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export const READING_TIMER_WHEEL_ITEM_HEIGHT = 44;
export const READING_TIMER_WHEEL_VISIBLE_HEIGHT = 220;

export function getPercentage(page: number, totalPages: number | null | undefined): string | null {
  if (!totalPages) return null;
  return ((page / totalPages) * 100).toFixed(1) + "%";
}

function typographyForDistance(distance: number): {
  pageSize: number;
  pageOpacity: number;
  pctSize: number;
  pctOpacity: number;
} {
  if (distance === 0) {
    return { pageSize: 15, pageOpacity: 1, pctSize: 13, pctOpacity: 0.4 };
  }
  if (distance === 1) {
    return { pageSize: 12, pageOpacity: 0.55, pctSize: 12, pctOpacity: 0.3 };
  }
  return { pageSize: 11, pageOpacity: 0.22, pctSize: 11, pctOpacity: 0.12 };
}

type Props = {
  pages: number[];
  value: number;
  onValueChange: (page: number) => void;
  totalPages: number | null | undefined;
};

export function ReadingTimerPageWheel({ pages, value, onValueChange, totalPages }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const lastSnapIdxRef = useRef<number>(-1);
  const minPage = pages[0] ?? 1;
  const maxPage = pages[pages.length - 1] ?? minPage;
  const clamped = Math.min(maxPage, Math.max(minPage, value));
  const indexInList = pages.length
    ? Math.max(0, Math.min(pages.length - 1, clamped - minPage))
    : 0;

  const [activePage, setActivePage] = useState(clamped);

  const pagesKey = pages.length ? `${pages[0]}-${pages[pages.length - 1]}-${pages.length}` : "";

  useLayoutEffect(() => {
    setActivePage(clamped);
    const sc = scrollRef.current;
    if (!sc || pages.length === 0) return;
    lastSnapIdxRef.current = indexInList;
    const offset = indexInList * READING_TIMER_WHEEL_ITEM_HEIGHT;
    const id = requestAnimationFrame(() => {
      sc.scrollTo({ y: offset, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [indexInList, pagesKey, pages.length, clamped]);

  const pad = (READING_TIMER_WHEEL_VISIBLE_HEIGHT - READING_TIMER_WHEEL_ITEM_HEIGHT) / 2;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pages.length === 0) return;
      const y = e.nativeEvent.contentOffset.y;
      const raw = Math.round(y / READING_TIMER_WHEEL_ITEM_HEIGHT);
      const idx = Math.max(0, Math.min(pages.length - 1, raw));
      const page = pages[idx] ?? minPage;
      if (idx !== lastSnapIdxRef.current) {
        lastSnapIdxRef.current = idx;
        setActivePage(page);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    [pages, minPage]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const raw = Math.round(y / READING_TIMER_WHEEL_ITEM_HEIGHT);
      const idx = Math.max(0, Math.min(pages.length - 1, raw));
      const page = pages[idx] ?? minPage;
      lastSnapIdxRef.current = idx;
      setActivePage(page);
      onValueChange(page);
    },
    [pages, minPage, onValueChange]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.highlightStrip} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        snapToInterval={READING_TIMER_WHEEL_ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={{
          paddingTop: pad,
          paddingBottom: pad,
        }}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {pages.map((item) => {
          const distance = Math.abs(item - activePage);
          const t = typographyForDistance(distance);
          const pct = getPercentage(item, totalPages);
          return (
            <View
              key={item}
              style={[
                styles.row,
                { height: READING_TIMER_WHEEL_ITEM_HEIGHT },
                pct == null ? styles.rowPageOnly : null,
              ]}
            >
              <Text
                style={[
                  styles.pageText,
                  {
                    fontSize: t.pageSize,
                    opacity: t.pageOpacity,
                    fontWeight: distance === 0 ? "500" : "400",
                  },
                ]}
              >
                {item}
              </Text>
              {pct != null ? (
                <Text style={[styles.pctText, { fontSize: t.pctSize, opacity: t.pctOpacity }]}>{pct}</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <LinearGradient
        colors={["#1a1a1a", "rgba(26,26,26,0)"]}
        style={styles.fadeTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(26,26,26,0)", "#1a1a1a"]}
        style={styles.fadeBottom}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: READING_TIMER_WHEEL_VISIBLE_HEIGHT,
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  list: {
    flex: 1,
    zIndex: 1,
  },
  highlightStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    marginTop: -READING_TIMER_WHEEL_ITEM_HEIGHT / 2,
    height: READING_TIMER_WHEEL_ITEM_HEIGHT,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    zIndex: 0,
  },
  fadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 56,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    zIndex: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  rowPageOnly: {
    justifyContent: "flex-start",
  },
  pageText: {
    color: "#ffffff",
  },
  pctText: {
    color: "#ffffff",
    fontWeight: "400",
  },
});
