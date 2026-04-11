import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextStyle,
  View,
  type StyleProp,
} from "react-native";
import { hexWithAlpha } from "../theme/colorUtils";

type Props = {
  text: string;
  textStyle: StyleProp<TextStyle>;
  /**
   * Theme accent; also the sweep peak if `highlightColor` is omitted, and the default `restColor`
   * when `restColor` is omitted.
   */
  accentColor: string;
  /**
   * Color of the text where the bright band passes (center gradient stop). Defaults to `accentColor`.
   * Use a second gradient stop (e.g. `accentGradient[1]`) for a lighter/different peak.
   */
  highlightColor?: string;
  shimmerPhase: Animated.Value;
  /** Fires once after width is known so the parent can start the sweep after layout. */
  onLayoutReady?: () => void;
  /**
   * “Dim” color: track under the mask + gradient shoulders when the bright peak isn’t there.
   * Omit to use `accentColor` (legacy pale accent wash). Use body text color for readable dim copy.
   */
  restColor?: string;
  /** Opacity of `restColor` on the track (0–1). Default 0.12 */
  restTrackAlpha?: number;
  /** Opacity of `restColor` at gradient shoulders (0–1). Default 0.28 */
  restShoulderAlpha?: number;
};

export function AccentShimmerText({
  text,
  textStyle,
  accentColor,
  highlightColor: highlightColorProp,
  shimmerPhase,
  onLayoutReady,
  restColor: restColorProp,
  restTrackAlpha = 0.12,
  restShoulderAlpha = 0.28,
}: Props) {
  const [boxW, setBoxW] = useState(0);
  const notifiedRef = useRef(false);
  const flat = StyleSheet.flatten(textStyle) ?? {};
  const fontSize = (flat.fontSize as number) ?? 15;
  const lineHeight = (flat.lineHeight as number) ?? Math.round(fontSize * 1.45);

  useEffect(() => {
    notifiedRef.current = false;
  }, [text]);

  const restColor = restColorProp ?? accentColor;
  const highlightColor = highlightColorProp ?? accentColor;

  const gradientColors = useMemo(
    () =>
      [
        hexWithAlpha(restColor, 0),
        hexWithAlpha(restColor, restShoulderAlpha),
        highlightColor,
        hexWithAlpha(restColor, restShoulderAlpha),
        hexWithAlpha(restColor, 0),
      ] as const,
    [highlightColor, restColor, restShoulderAlpha]
  );

  useEffect(() => {
    if (boxW <= 0 || !onLayoutReady || notifiedRef.current) return;
    notifiedRef.current = true;
    const id = requestAnimationFrame(() => {
      onLayoutReady();
    });
    return () => cancelAnimationFrame(id);
  }, [boxW, onLayoutReady, text]);

  const stripW = Math.max(100, boxW * 0.52);
  const translateX = shimmerPhase.interpolate({
    inputRange: [0, 1],
    outputRange: boxW > 0 ? [-stripW, boxW + stripW * 0.25] : [0, 0],
  });

  const onMeasureLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - boxW) > 0.5) setBoxW(w);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[textStyle, styles.measureText]} onLayout={onMeasureLayout}>
        {text}
      </Text>
      {boxW > 0 ? (
        <View style={[styles.shimmerOverlay, { width: boxW, minHeight: lineHeight }]}>
          <MaskedView
            style={{ width: boxW, height: lineHeight }}
            maskElement={
              <View style={[styles.maskBox, { height: lineHeight, width: boxW }]}>
                <Text style={[textStyle, styles.maskFill]}>{text}</Text>
              </View>
            }
          >
            <View
              style={[
                styles.track,
                {
                  width: boxW,
                  height: lineHeight,
                  backgroundColor: hexWithAlpha(restColor, restTrackAlpha),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.strip,
                  {
                    width: stripW,
                    height: lineHeight,
                    transform: [{ translateX }],
                  },
                ]}
              >
                <LinearGradient
                  colors={gradientColors}
                  locations={[0, 0.22, 0.5, 0.78, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </MaskedView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
  },
  measureText: {
    opacity: 0,
  },
  shimmerOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  maskBox: {
    backgroundColor: "transparent",
    justifyContent: "center",
  },
  maskFill: {
    color: "#000000",
  },
  track: {
    overflow: "hidden",
    borderRadius: 4,
  },
  strip: {
    borderRadius: 4,
    overflow: "hidden",
  },
});
