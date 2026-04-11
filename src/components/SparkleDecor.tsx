import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

/** Path from `assets/sparkle.svg` (Core SVG four-point star). */
const SPARKLE_PATH =
  "M12.2754 24.5215C12.7246 24.5215 13.0664 24.209 13.1348 23.7402C14.1797 15.0879 15.2539 13.9941 23.7305 13.125C24.1992 13.0762 24.541 12.7148 24.541 12.2656C24.541 11.8066 24.1992 11.4453 23.7305 11.4062C15.2539 10.5273 14.1797 9.44336 13.1348 0.791016C13.0664 0.3125 12.7246 0 12.2754 0C11.8359 0 11.4844 0.3125 11.4062 0.791016C10.3711 9.44336 9.28711 10.5273 0.820312 11.4062C0.341797 11.4453 0 11.8066 0 12.2656C0 12.7148 0.341797 13.0664 0.820312 13.125C9.26758 14.209 10.293 15.0781 11.4062 23.7402C11.4844 24.209 11.8359 24.5215 12.2754 24.5215Z";

const VIEWBOX = "0 0 24.9023 24.541";
const ASPECT = 24.541 / 24.9023;

type SparkleIconProps = {
  size?: number;
  color?: string;
  opacity?: number;
};

export function SparkleIcon({ size = 20, color = "#ffffff", opacity = 0.85 }: SparkleIconProps) {
  const h = size * ASPECT;
  return (
    <Svg width={size} height={h} viewBox={VIEWBOX}>
      <Path d={SPARKLE_PATH} fill={color} fillOpacity={opacity} />
    </Svg>
  );
}

type Placement = {
  key: string;
  top?: number | `${number}%`;
  left?: number | `${number}%`;
  right?: number | `${number}%`;
  bottom?: number | `${number}%`;
  size: number;
  opacity?: number;
  rotateDeg?: number;
};

/** Scattered sparkles inside full-width modal OK buttons (`ThemesScreen` theme toast). */
const OK_BUTTON_SPARKLE_PLACEMENTS: Placement[] = [
  { key: "ok-a", top: "12%", left: "8%", size: 6, opacity: 0.5, rotateDeg: 12 },
  { key: "ok-b", top: "58%", left: "16%", size: 5, opacity: 0.4, rotateDeg: -8 },
  { key: "ok-c", top: "20%", left: "44%", size: 4, opacity: 0.38, rotateDeg: -14 },
  { key: "ok-d", top: "62%", left: "72%", size: 6, opacity: 0.48, rotateDeg: 6 },
  { key: "ok-e", top: "28%", right: "12%", size: 7, opacity: 0.52, rotateDeg: 3 },
  { key: "ok-f", top: "68%", right: "24%", size: 5, opacity: 0.42, rotateDeg: 18 },
  { key: "ok-g", top: "42%", left: "28%", size: 4, opacity: 0.34, rotateDeg: -22 },
  { key: "ok-h", top: "48%", right: "6%", size: 5, opacity: 0.44, rotateDeg: -5 },
];

/** Placements around the 80% OFF hero in `OneTimeOfferModal`. */
const OFFER_HERO_PLACEMENTS: Placement[] = [
  { key: "tl", top: 15, left: "-2%", size: 30, opacity: 0.7, rotateDeg: 5 },
  { key: "tr", top: 15, right: "4%", size: 30, opacity: 0.7, rotateDeg: 0 },
  { key: "ml", top: "36%", left: 5, size: 45, opacity: 1, rotateDeg: 0 },
  { key: "mr", top: "40%", right: -6, size: 40, opacity: 1, rotateDeg: 0 },
  { key: "bl", bottom: 20, left: "-1%", size: 20, opacity: 0.4, rotateDeg: 6 },
  { key: "br", bottom: 8, right: "8%", size: 18, opacity: 0.7, rotateDeg: 0 },
  { key: "tc", top: -12, left: "46%", size: 11, opacity: 0.5, rotateDeg: 20 },
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h + s.charCodeAt(i) * (i + 1)) % 9973;
  }
  return h;
}

/** Deterministic value in [0, 1) from key hash + salt (independent per salt). */
function seeded01(seed: number, salt: number): number {
  const x = (seed * 7919 + salt * 9973) >>> 0;
  return (x % 100000) / 100000;
}

/**
 * Independent float path per star: direction + magnitude + timings derived only from `key`,
 * plus staggered start so they don’t move in sync.
 */
function SparkleAt({
  p,
  color,
}: {
  p: Placement;
  color: string;
}) {
  const rot = p.rotateDeg ?? 0;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;

  const floatParams = useMemo(() => {
    const seed = hashSeed(p.key);
    const mag = 3 + (seed % 5);
    const mag2 = mag * (0.55 + seeded01(seed, 1) * 0.45);

    const angle1 = seeded01(seed, 2) * 2 * Math.PI;
    const angle2 = angle1 + (0.35 + seeded01(seed, 3) * 1.15) * Math.PI;

    const x1 = Math.cos(angle1) * mag;
    const y1 = Math.sin(angle1) * mag;
    const x2 = Math.cos(angle2) * mag2;
    const y2 = Math.sin(angle2) * mag2;

    const legMs1 = 2000 + (seed % 2000);
    const legMs2 = Math.round(legMs1 * (0.82 + seeded01(seed, 4) * 0.36));
    const legMs3 = Math.round(legMs1 * (0.6 + seeded01(seed, 5) * 0.35));
    /** Stagger loop starts so stars aren’t phase-locked. */
    const startDelayMs = seed % 11000;

    return { x1, y1, x2, y2, legMs1, legMs2, legMs3, startDelayMs };
  }, [p.key]);

  useEffect(() => {
    const { x1, y1, x2, y2, legMs1, legMs2, legMs3, startDelayMs } = floatParams;
    const easing = Easing.inOut(Easing.sin);

    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(tx, {
              toValue: x1,
              duration: legMs1,
              easing,
              useNativeDriver: true,
            }),
            Animated.timing(ty, {
              toValue: y1,
              duration: legMs2,
              easing,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(tx, {
              toValue: x2,
              duration: legMs1,
              easing,
              useNativeDriver: true,
            }),
            Animated.timing(ty, {
              toValue: y2,
              duration: legMs2,
              easing,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(tx, {
              toValue: 0,
              duration: legMs3,
              easing,
              useNativeDriver: true,
            }),
            Animated.timing(ty, {
              toValue: 0,
              duration: legMs3,
              easing,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loop.start();
    }, startDelayMs);

    return () => {
      clearTimeout(timer);
      loop?.stop();
    };
  }, [floatParams, tx, ty]);

  return (
    <Animated.View
      style={[
        styles.sparkleWrap,
        {
          top: p.top,
          left: p.left,
          right: p.right,
          bottom: p.bottom,
          transform: [
            { translateX: tx },
            { translateY: ty },
            { rotate: `${rot}deg` },
          ],
        },
      ]}
    >
      <SparkleIcon size={p.size} color={color} opacity={p.opacity ?? 0.85} />
    </Animated.View>
  );
}

type CardSparkleDecorProps = {
  /** Tint sparkles (e.g. accent); defaults to white. */
  color?: string;
};

/** Multiple `sparkle.svg` instances around the offer hero card; non-interactive overlay. */
export function CardSparkleDecor({ color = "#ffffff" }: CardSparkleDecorProps) {
  const placements = OFFER_HERO_PLACEMENTS;
  return (
    <View pointerEvents="none" style={styles.layer}>
      {placements.map((p) => (
        <SparkleAt key={p.key} p={p} color={color} />
      ))}
    </View>
  );
}

type ButtonFloatingSparklesProps = {
  /** Sparkle tint; default light on saturated button fills. */
  color?: string;
};

/** Small floating sparkles inside a pill/button area; parent should use `overflow: 'hidden'` + `borderRadius`. */
export function ButtonFloatingSparkles({ color = "rgba(255,255,255,0.92)" }: ButtonFloatingSparklesProps) {
  return (
    <View pointerEvents="none" style={styles.buttonSparkleLayer}>
      {OK_BUTTON_SPARKLE_PLACEMENTS.map((p) => (
        <SparkleAt key={p.key} p={p} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  buttonSparkleLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sparkleWrap: {
    position: "absolute",
  },
});
