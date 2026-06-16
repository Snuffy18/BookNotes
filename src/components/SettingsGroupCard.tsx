import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/** Room for iOS card shadow (shadowRadius 12 + offset.y 3) inside ScrollView bounds. */
export const SETTINGS_CARD_SHADOW_BLEED = 16;

/**
 * Asymmetric wrapper padding that reserves room for the iOS card shadow
 * (offset.y 3 + radius 12). The horizontal padding is cancelled by the
 * negative margin so the card stays edge-aligned. This wrapper is applied in
 * BOTH light and dark mode so toggling themes never changes geometry — dark
 * mode simply renders no visible shadow inside the reserved space.
 */
export const settingsCardLightWrapStyle: ViewStyle = {
  paddingTop: SETTINGS_CARD_SHADOW_BLEED - 3,
  paddingBottom: SETTINGS_CARD_SHADOW_BLEED + 3,
  paddingHorizontal: SETTINGS_CARD_SHADOW_BLEED,
  marginHorizontal: -SETTINGS_CARD_SHADOW_BLEED,
  overflow: "visible",
};

const styles = StyleSheet.create({
  groupCardWrap: settingsCardLightWrapStyle,
  groupCard: {
    borderRadius: 14,
    borderWidth: 0.5,
  },
  groupCardDark: {
    backgroundColor: "#1C1C1E",
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  groupCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "transparent",
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
});

export function settingsGroupCardStyle(darkMode: boolean) {
  return [styles.groupCard, darkMode ? styles.groupCardDark : styles.groupCardLight];
}

type SettingsGroupCardProps = {
  darkMode: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function SettingsGroupCard({ darkMode, style, children }: SettingsGroupCardProps) {
  const wrapStyle = styles.groupCardWrap;
  const cardStyle = settingsGroupCardStyle(darkMode);

  return (
    <View style={[wrapStyle, style]}>
      <View style={cardStyle}>{children}</View>
    </View>
  );
}

/**
 * Applied to the ScrollView component style in light mode. Must NOT set
 * `overflow: "visible"` — on iOS that lets scrolling content paint upward over
 * the fixed page header/title. Card shadow bleed is instead reserved via the
 * contentContainer padding (`settingsScrollContentLightStyle`) and the per-card
 * wrappers (`settingsCardLightWrapStyle`), so the scroll viewport stays clipped.
 */
export const settingsScrollLight = {};

/** Extra scroll insets so first/last card shadows aren't clipped in light mode. */
export function settingsScrollContentLightStyle(
  basePadding: { paddingTop?: number; paddingBottom?: number } = {}
): ViewStyle {
  return {
    overflow: "visible",
    paddingTop: (basePadding.paddingTop ?? 0) + SETTINGS_CARD_SHADOW_BLEED,
    paddingBottom: (basePadding.paddingBottom ?? 0) + SETTINGS_CARD_SHADOW_BLEED,
  };
}
