import { useEffect, useMemo, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  FONT_DM_SERIF_DISPLAY,
  FONT_DM_SERIF_DISPLAY_ITALIC,
  FONT_HELVETICA,
} from "../theme/fonts";

const INK = "#1C1813";
const CREAM = "#F4EFE6";
const AMBER = "#FBBF24";

/** Horizontal travel (or fling speed) past which a swipe dismisses the ribbon. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.8;

type Props = {
  darkMode: boolean;
  imageUri?: string;
  page?: string;
  onOpen: () => void;
  onDismiss: () => void;
};

/** Home card shown once background extraction finishes. Tap opens the report, swipe sideways dismisses. */
export function ReportReadyRibbon({ darkMode, imageUri, page, onOpen, onDismiss }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, friction: 8, tension: 70 }).start();
  }, [enter]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: Animated.event([null, { dx: translateX }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          const dismiss =
            Math.abs(g.dx) > DISMISS_DISTANCE || Math.abs(g.vx) > DISMISS_VELOCITY;
          if (!dismiss) {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: false, friction: 7 }).start();
            return;
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          const direction = g.dx === 0 ? Math.sign(g.vx) || 1 : Math.sign(g.dx);
          Animated.timing(translateX, {
            toValue: direction * 480,
            duration: 180,
            useNativeDriver: false,
          }).start(() => onDismiss());
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
        },
      }),
    [translateX, onDismiss],
  );

  const opacity = Animated.multiply(
    enter,
    translateX.interpolate({
      inputRange: [-240, 0, 240],
      outputRange: [0.2, 1, 0.2],
      extrapolate: "clamp",
    }),
  );
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  const eyebrow = page ? `Report ready · Page ${page}` : "Report ready";

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ opacity, transform: [{ translateX }, { translateY }] }}
    >
      <Pressable
        onPressIn={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.card,
          darkMode && styles.cardDark,
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={page ? `Report for page ${page} is ready. Open report` : "Report ready. Open report"}
        accessibilityHint="Swipe sideways to dismiss"
        accessibilityActions={[{ name: "dismiss", label: "Dismiss" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "dismiss") onDismiss();
        }}
      >
        <View style={styles.thumbWrap}>
          <View style={styles.thumb}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <View style={styles.thumbLines}>
                <View style={styles.thumbLine} />
                <View style={[styles.thumbLine, { width: "80%" }]} />
                <View style={[styles.thumbLine, styles.thumbLineHighlight]} />
                <View style={styles.thumbLine} />
                <View style={[styles.thumbLine, { width: "60%" }]} />
              </View>
            )}
          </View>
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={11} color={INK} />
          </View>
        </View>

        <View style={styles.textCol}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow.toUpperCase()}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            Your <Text style={styles.titleAccent}>notes</Text> are in.
          </Text>
        </View>

        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={17} color={INK} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    backgroundColor: INK,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    shadowColor: INK,
    shadowOpacity: 0.22,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cardDark: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  thumbWrap: {
    width: 40,
    height: 52,
    transform: [{ rotate: "-3deg" }],
  },
  thumb: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "#3A3129",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbLines: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    gap: 4,
  },
  thumbLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "#D9D3C9",
  },
  thumbLineHighlight: {
    height: 3,
    backgroundColor: "rgba(251,191,36,0.85)",
  },
  checkBadge: {
    position: "absolute",
    right: -7,
    bottom: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: AMBER,
    borderWidth: 2,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT_HELVETICA,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: AMBER,
  },
  title: {
    fontFamily: FONT_DM_SERIF_DISPLAY,
    fontSize: 21,
    lineHeight: 25,
    color: CREAM,
    marginTop: 4,
  },
  titleAccent: {
    fontFamily: FONT_DM_SERIF_DISPLAY_ITALIC,
    color: AMBER,
  },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
});
