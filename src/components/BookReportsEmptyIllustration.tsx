import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

const FLOAT_EASE = Easing.bezier(0.4, 0, 0.6, 1);
const GLOW_PULSE_MS = 3000;
const BOOK_SIZE = 130;
/** Visible open-book top within the square Lottie frame (px from container top). */
const BOOK_TOP_INSET = 54;
const BOOK_SURFACE_BOTTOM = BOOK_SIZE - BOOK_TOP_INSET;
const PARTICLE_CYCLE_GAP_MS = 500;

const BOOK_LOTTIE = require("../../assets/Book.json");

type MotionProfile = "sparkle" | "star";

type ParticleDef = {
  id: string;
  profile: MotionProfile;
  size: number;
  driftX: number;
  driftY: number;
  delayMs: number;
  durationMs: number;
  cycleGapMs: number;
  style: StyleProp<ViewStyle>;
  render: (accentColor: string, darkMode: boolean) => ReactNode;
};

function buildParticles(accentColor: string, darkMode: boolean): ParticleDef[] {
  const starColor = darkMode ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.35)";
  return [
    {
      id: "left",
      profile: "sparkle",
      size: 12,
      driftX: -6,
      driftY: -36,
      delayMs: 0,
      durationMs: 2200,
      cycleGapMs: 400,
      style: styles.particleLeft,
      render: () => <Ionicons name="sparkles" size={12} color={accentColor} />,
    },
    {
      id: "center",
      profile: "star",
      size: 10,
      driftX: 0,
      driftY: -40,
      delayMs: 750,
      durationMs: 2300,
      cycleGapMs: 400,
      style: styles.particleCenter,
      render: () => <Ionicons name="star" size={10} color={starColor} />,
    },
    {
      id: "right",
      profile: "sparkle",
      size: 11,
      driftX: 6,
      driftY: -36,
      delayMs: 1500,
      durationMs: 2200,
      cycleGapMs: 400,
      style: styles.particleRight,
      render: () => <Ionicons name="sparkles" size={11} color="#a855f7" />,
    },
  ];
}

type FloatingParticleProps = {
  def: ParticleDef;
  reduceMotion: boolean;
  accentColor: string;
  darkMode: boolean;
};

function FloatingParticle({ def, reduceMotion, accentColor, darkMode }: FloatingParticleProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(def.delayMs),
        Animated.timing(progress, {
          toValue: 1,
          duration: def.durationMs,
          easing: FLOAT_EASE,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(def.cycleGapMs + PARTICLE_CYCLE_GAP_MS),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [def.cycleGapMs, def.delayMs, def.durationMs, progress, reduceMotion]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, def.driftY],
  });

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, def.driftX],
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.85, 1, 0.9],
  });

  const rotate =
    def.profile === "sparkle"
      ? progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ["-8deg", "4deg", "8deg"],
        })
      : "0deg";

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: def.size, height: def.size },
        def.style,
        {
          opacity: reduceMotion ? 1 : opacity,
          transform: reduceMotion ? [] : [{ translateX }, { translateY }, { scale }, { rotate }],
        },
      ]}
    >
      {def.render(accentColor, darkMode)}
    </Animated.View>
  );
}

type AnimatedBookProps = {
  darkMode: boolean;
  reduceMotion: boolean;
  particles: ParticleDef[];
  accentColor: string;
};

function AnimatedOpenBook({ darkMode, reduceMotion, particles, accentColor }: AnimatedBookProps) {
  const glow = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    if (reduceMotion) {
      glow.setValue(0.12);
      return;
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.18,
          duration: GLOW_PULSE_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.1,
          duration: GLOW_PULSE_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [glow, reduceMotion]);

  return (
    <View style={styles.bookStage}>
      <Animated.View
        style={[
          styles.bookGlow,
          {
            opacity: glow,
            backgroundColor: darkMode ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)",
          },
        ]}
      />
      <View style={styles.particlesLayer} pointerEvents="none">
        {particles.map((def) => (
          <FloatingParticle
            key={def.id}
            def={def}
            reduceMotion={reduceMotion}
            accentColor={accentColor}
            darkMode={darkMode}
          />
        ))}
      </View>
      <LottieView
        source={BOOK_LOTTIE}
        autoPlay={!reduceMotion}
        loop={!reduceMotion}
        speed={0.5}
        progress={reduceMotion ? 0 : undefined}
        style={styles.bookLottie}
      />
    </View>
  );
}

type Props = {
  darkMode?: boolean;
  accentColor?: string;
};

export function BookReportsEmptyIllustration({ darkMode = true, accentColor = "#60a5fa" }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const particles = useMemo(() => buildParticles(accentColor, darkMode), [accentColor, darkMode]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.wrap}>
      <AnimatedOpenBook
        darkMode={darkMode}
        reduceMotion={reduceMotion}
        particles={particles}
        accentColor={accentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: BOOK_SIZE,
    alignItems: "center",
    overflow: "visible",
  },
  bookStage: {
    width: BOOK_SIZE,
    height: BOOK_SIZE,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "visible",
  },
  particlesLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "visible",
    zIndex: 1,
  },
  particle: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  bookLottie: {
    width: BOOK_SIZE,
    height: BOOK_SIZE,
  },
  bookGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    bottom: 12,
    alignSelf: "center",
  },
  particleLeft: {
    left: 34,
    bottom: BOOK_SURFACE_BOTTOM + 4,
  },
  particleCenter: {
    left: 60,
    bottom: BOOK_SURFACE_BOTTOM + 6,
  },
  particleRight: {
    right: 34,
    bottom: BOOK_SURFACE_BOTTOM + 4,
  },
});
