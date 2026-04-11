import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

/** Base star anchors (percent); opacity and drift are animated — same layout as profile promo banner. */
export const PROMO_STAR_POSITIONS = [
  { l: 6, t: 8, w: 2 },
  { l: 18, t: 14, w: 1.5 },
  { l: 42, t: 6, w: 2 },
  { l: 58, t: 18, w: 1.5 },
  { l: 72, t: 10, w: 2 },
  { l: 88, t: 22, w: 1.5 },
  { l: 12, t: 32, w: 1.5 },
  { l: 28, t: 38, w: 2 },
  { l: 50, t: 28, w: 1.5 },
  { l: 65, t: 42, w: 2 },
  { l: 82, t: 36, w: 1.5 },
  { l: 8, t: 52, w: 1.5 },
  { l: 38, t: 48, w: 2 },
  { l: 92, t: 50, w: 1.5 },
  { l: 22, t: 62, w: 1.5 },
  { l: 55, t: 58, w: 2 },
  { l: 76, t: 68, w: 1.5 },
  { l: 14, t: 72, w: 1.5 },
  { l: 44, t: 78, w: 2 },
  { l: 68, t: 82, w: 1.5 },
  { l: 90, t: 74, w: 1.5 },
  { l: 32, t: 88, w: 1.5 },
  { l: 58, t: 92, w: 2 },
] as const;

export function PromoTwinklingStar({
  leftPct,
  topPct,
  size,
}: {
  leftPct: number;
  topPct: number;
  size: number;
}) {
  const opacity = useRef(new Animated.Value(0.15 + Math.random() * 0.35)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    const pulse = () => {
      if (cancelled) return;
      const fadeOutMs = 450 + Math.random() * 900;
      const fadeInMs = 450 + Math.random() * 900;
      const low = 0.04 + Math.random() * 0.1;
      const high = 0.3 + Math.random() * 0.45;
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: low,
          duration: fadeOutMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: high,
          duration: fadeInMs,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };

    const drift = () => {
      if (cancelled) return;
      const duration = 650 + Math.random() * 1600;
      Animated.parallel([
        Animated.timing(tx, {
          toValue: (Math.random() - 0.5) * 18,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: (Math.random() - 0.5) * 18,
          duration,
          useNativeDriver: true,
        }),
      ]).start(() => drift());
    };

    pulse();
    drift();
    return () => {
      cancelled = true;
    };
  }, [opacity, tx, ty]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ translateX: tx }, { translateY: ty }],
        },
      ]}
    />
  );
}

/** Full-area star layer (pointer-events none). Use inside a relative container. */
export function PromoParticleStarsLayer() {
  return (
    <View style={styles.layer} pointerEvents="none">
      {PROMO_STAR_POSITIONS.map((star, i) => (
        <PromoTwinklingStar key={i} leftPct={star.l} topPct={star.t} size={star.w} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    position: "absolute",
    backgroundColor: "#ffffff",
  },
});
