import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { FONT_DM_SERIF_DISPLAY } from "../theme/fonts";
import { T } from "./theme";

export function ProgressDots({ step, total = 5 }: { step: number; total?: number }) {
  return (
    <View style={styles.progressDots}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === step;
        return (
          <View
            key={i}
            style={[
              styles.progressDot,
              active ? styles.progressDotActive : null,
            ]}
          />
        );
      })}
    </View>
  );
}

type PrimaryButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  icon?: React.ReactNode;
  variant?: "primary" | "ghost";
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  children,
  onPress,
  icon,
  variant = "primary",
  style,
}: PrimaryButtonProps) {
  const isPrimary = variant === "primary";
  const content =
    typeof children === "string" ? (
      <Text style={[styles.primaryButtonText, !isPrimary && styles.primaryButtonTextGhost]}>
        {children}
      </Text>
    ) : (
      children
    );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        isPrimary ? styles.primaryButtonPrimary : styles.primaryButtonGhost,
        pressed && onPress ? styles.primaryButtonPressed : null,
        style,
      ]}
      accessibilityRole="button"
    >
      {content}
      {icon}
    </Pressable>
  );
}

export function SkipLink({
  children,
  onPress,
  opacity = 0.2,
}: {
  children: React.ReactNode;
  onPress: () => void;
  opacity?: number;
}) {
  return (
    <Pressable onPress={onPress} style={styles.skipWrap} accessibilityRole="button">
      <Text style={[styles.skipText, { color: `rgba(255,255,255,${opacity})` }]}>{children}</Text>
    </Pressable>
  );
}

type OptionCardProps = {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  selected: boolean;
  onPress: () => void;
};

export function OptionCard({
  label,
  icon,
  iconBg,
  selected,
  onPress,
}: OptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        selected ? styles.optionCardSelected : styles.optionCardDefault,
        pressed && styles.optionCardPressed,
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.optionIconWrap, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={[styles.optionRadio, selected && styles.optionRadioSelected]}>
        {selected ? <View style={styles.optionRadioDot} /> : null}
      </View>
    </Pressable>
  );
}

export function ScreenShell({
  children,
  screenKey,
  variant = "fade",
}: {
  children: React.ReactNode;
  screenKey: string;
  variant?: "fade" | "slide";
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(variant === "slide" ? 0 : 6)).current;
  const translateX = useRef(new Animated.Value(variant === "slide" ? 40 : 0)).current;

  useEffect(() => {
    opacity.setValue(0);
    if (variant === "slide") {
      translateX.setValue(40);
      translateY.setValue(0);
    } else {
      translateY.setValue(6);
      translateX.setValue(0);
    }

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(variant === "slide" ? translateX : translateY, {
        toValue: 0,
        duration: variant === "slide" ? 320 : 320,
        easing: variant === "slide" ? Easing.bezier(0.32, 0.72, 0.36, 1) : Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const id = setTimeout(() => anim.start(), 20);
    return () => {
      clearTimeout(id);
      anim.stop();
    };
  }, [screenKey, opacity, translateX, translateY, variant]);

  return (
    <Animated.View
      style={[
        styles.screenShell,
        {
          opacity,
          transform: variant === "slide" ? [{ translateX }] : [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Wordmark({ opacity = 0.3 }: { opacity?: number }) {
  return (
    <Text style={[styles.wordmark, { color: `rgba(255,255,255,${opacity})` }]}>BOOKNOTES</Text>
  );
}

export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
    >
      <View style={[styles.toggleKnob, on ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressDots: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    height: 8,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.w15,
  },
  progressDotActive: {
    width: 18,
    backgroundColor: T.white,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonPrimary: {
    backgroundColor: T.white,
  },
  primaryButtonGhost: {
    backgroundColor: T.w07,
    borderWidth: 0.5,
    borderColor: T.w15,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: "#111",
  },
  primaryButtonTextGhost: {
    color: T.white,
  },
  skipWrap: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  skipText: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.1,
    textAlign: "center",
  },
  optionCard: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 0.5,
  },
  optionCardDefault: {
    backgroundColor: T.w06,
    borderColor: T.w10,
  },
  optionCardSelected: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: T.w30,
  },
  optionCardPressed: {
    opacity: 0.9,
  },
  optionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionLabel: {
    flex: 1,
    color: T.white,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.w25,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionRadioSelected: {
    backgroundColor: T.white,
    borderWidth: 0,
  },
  optionRadioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#111",
  },
  screenShell: {
    flex: 1,
    backgroundColor: "#111",
    paddingHorizontal: 20,
  },
  wordmark: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  toggle: {
    width: 36,
    height: 22,
    borderRadius: 11,
    padding: 2,
    flexShrink: 0,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: T.white,
    alignItems: "flex-end",
  },
  toggleOff: {
    backgroundColor: T.w15,
    alignItems: "flex-start",
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  toggleKnobOn: {
    backgroundColor: "#111",
  },
  toggleKnobOff: {
    backgroundColor: T.w40,
  },
});

export const serifStyle = {
  fontFamily: FONT_DM_SERIF_DISPLAY,
} as const;
