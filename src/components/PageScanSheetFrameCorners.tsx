import { StyleSheet, View } from "react-native";

const PAGE_SCAN_SHEET_CORNER_LEN = 26;
const PAGE_SCAN_SHEET_CORNER_INSET = 14;
const PAGE_SCAN_SHEET_STROKE = 3;
const PAGE_SCAN_CORNER_COLOR = "rgba(255,255,255,0.9)";

/** L-shaped corner brackets for page-scan / add-book sheet camera preview. */
export function PageScanSheetFrameCorners() {
  const c = {
    position: "absolute" as const,
    width: PAGE_SCAN_SHEET_CORNER_LEN,
    height: PAGE_SCAN_SHEET_CORNER_LEN,
    borderColor: PAGE_SCAN_CORNER_COLOR,
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={{
          ...c,
          left: PAGE_SCAN_SHEET_CORNER_INSET,
          top: PAGE_SCAN_SHEET_CORNER_INSET,
          borderLeftWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...c,
          right: PAGE_SCAN_SHEET_CORNER_INSET,
          top: PAGE_SCAN_SHEET_CORNER_INSET,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...c,
          left: PAGE_SCAN_SHEET_CORNER_INSET,
          bottom: PAGE_SCAN_SHEET_CORNER_INSET,
          borderLeftWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...c,
          right: PAGE_SCAN_SHEET_CORNER_INSET,
          bottom: PAGE_SCAN_SHEET_CORNER_INSET,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
    </View>
  );
}
