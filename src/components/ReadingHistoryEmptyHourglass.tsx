import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LOOP_MS = 3000;
const GLOW_LOOP_MS = 3000;
const SAND_EASE = Easing.bezier(0.4, 0, 0.6, 1);

const OUTLINE = "rgba(255,255,255,0.25)";
const BAR = "rgba(255,255,255,0.35)";
const SAND = "rgba(255,255,255,0.15)";
const DRIP = "rgba(255,255,255,0.5)";

export function ReadingHistoryEmptyHourglass() {
  const sandProgress = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const sandLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sandProgress, {
          toValue: 1,
          duration: LOOP_MS,
          easing: SAND_EASE,
          useNativeDriver: false,
        }),
        Animated.timing(sandProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: GLOW_LOOP_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.15,
          duration: GLOW_LOOP_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    sandLoop.start();
    glowLoop.start();
    return () => {
      sandLoop.stop();
      glowLoop.stop();
    };
  }, [glowOpacity, sandProgress]);

  const topSandHeight = sandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 3],
  });
  const bottomSandHeight = sandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 24],
  });
  const bottomSandY = sandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [63, 42],
  });
  const dripY = sandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 44],
  });
  const dripOpacity = sandProgress.interpolate({
    inputRange: [0, 0.08, 0.92, 1],
    outputRange: [0, 0.5, 0.5, 0],
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      <Svg width={64} height={80} viewBox="0 0 64 80">
        <Defs>
          <ClipPath id="rhTopChamber">
            <Path d="M16 14 L48 14 L32 36 Z" />
          </ClipPath>
          <ClipPath id="rhBottomChamber">
            <Path d="M32 44 L16 66 L48 66 Z" />
          </ClipPath>
        </Defs>

        <G clipPath="url(#rhTopChamber)">
          <AnimatedRect x={14} y={14} width={36} height={topSandHeight} fill={SAND} />
        </G>

        <AnimatedCircle cx={32} cy={dripY} r={1.5} fill={DRIP} opacity={dripOpacity} />

        <G clipPath="url(#rhBottomChamber)">
          <AnimatedRect x={14} y={bottomSandY} width={36} height={bottomSandHeight} fill={SAND} />
        </G>

        <Path
          d="M16 14 L48 14 L32 36 Z"
          fill="none"
          stroke={OUTLINE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <Path
          d="M32 44 L16 66 L48 66 Z"
          fill="none"
          stroke={OUTLINE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <Line x1={14} y1={12} x2={50} y2={12} stroke={BAR} strokeWidth={2} strokeLinecap="round" />
        <Line x1={14} y1={68} x2={50} y2={68} stroke={BAR} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 100,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
