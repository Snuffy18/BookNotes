import { StyleSheet, View } from "react-native";

const PAGE_SCAN_SHEET_CORNER_LEN = 26;
const PAGE_SCAN_SHEET_CORNER_INSET = 14;
const PAGE_SCAN_SHEET_CORNER_RADIUS = 6;
const PAGE_SCAN_SHEET_STROKE = 3;
const PAGE_SCAN_CORNER_COLOR = "rgba(255,255,255,0.9)";

type CenteredFrameCornersProps = {
  width: number;
  height: number;
  frameWidthRatio?: number;
  frameHeightRatio?: number;
  arm?: number;
};

/** L-shaped corners forming a centered rectangle inside a measured preview. */
export function CenteredViewfinderFrameCorners({
  width,
  height,
  frameWidthRatio = 0.82,
  frameHeightRatio = 0.78,
  arm = PAGE_SCAN_SHEET_CORNER_LEN,
}: CenteredFrameCornersProps) {
  if (width <= 0 || height <= 0) return null;

  const frameW = width * frameWidthRatio;
  const frameH = height * frameHeightRatio;
  const left = (width - frameW) / 2;
  const top = (height - frameH) / 2;
  const corner = {
    position: "absolute" as const,
    width: arm,
    height: arm,
    borderColor: PAGE_SCAN_CORNER_COLOR,
  };

  return (
    <>
      <View
        style={{
          ...corner,
          left,
          top,
          borderLeftWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...corner,
          left: left + frameW - arm,
          top,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...corner,
          left,
          top: top + frameH - arm,
          borderLeftWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
      <View
        style={{
          ...corner,
          left: left + frameW - arm,
          top: top + frameH - arm,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
        }}
      />
    </>
  );
}

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
          borderTopLeftRadius: PAGE_SCAN_SHEET_CORNER_RADIUS,
        }}
      />
      <View
        style={{
          ...c,
          right: PAGE_SCAN_SHEET_CORNER_INSET,
          top: PAGE_SCAN_SHEET_CORNER_INSET,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopWidth: PAGE_SCAN_SHEET_STROKE,
          borderTopRightRadius: PAGE_SCAN_SHEET_CORNER_RADIUS,
        }}
      />
      <View
        style={{
          ...c,
          left: PAGE_SCAN_SHEET_CORNER_INSET,
          bottom: PAGE_SCAN_SHEET_CORNER_INSET,
          borderLeftWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomLeftRadius: PAGE_SCAN_SHEET_CORNER_RADIUS,
        }}
      />
      <View
        style={{
          ...c,
          right: PAGE_SCAN_SHEET_CORNER_INSET,
          bottom: PAGE_SCAN_SHEET_CORNER_INSET,
          borderRightWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomWidth: PAGE_SCAN_SHEET_STROKE,
          borderBottomRightRadius: PAGE_SCAN_SHEET_CORNER_RADIUS,
        }}
      />
    </View>
  );
}
