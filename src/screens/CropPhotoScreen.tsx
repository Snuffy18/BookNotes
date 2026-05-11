import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { HeaderText } from "../components/HeaderText";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<ScanStackParamList, "CropPhoto">;

type CropPx = { left: number; top: number; right: number; bottom: number };

const MIN_FRAC = 0.08;
const HANDLE_HIT = 44;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function CropPhotoScreen({ navigation, route }: Props) {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const imageUri = route.params.imageUri;
  const purpose = route.params.purpose ?? "page";

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [layout, setLayout] = useState<{ cw: number; ch: number }>({ cw: 0, ch: 0 });
  const [crop, setCrop] = useState<CropPx | null>(null);
  const displayDimsRef = useRef<{ dispW: number; dispH: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cropRef = useRef<CropPx | null>(null);
  cropRef.current = crop;
  const dragStartRef = useRef<CropPx | null>(null);
  const envRef = useRef({
    display: null as { dispW: number; dispH: number; scale: number } | null,
    minSize: 40,
  });

  const display = useMemo(() => {
    if (!natural || layout.cw <= 0 || layout.ch <= 0) return null;
    const scale = Math.min(layout.cw / natural.w, layout.ch / natural.h);
    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    return { dispW, dispH, scale };
  }, [natural?.w, natural?.h, layout.cw, layout.ch]);

  const minSize = useMemo(() => {
    if (!display) return 40;
    return Math.max(40, Math.min(display.dispW, display.dispH) * MIN_FRAC);
  }, [display]);

  envRef.current.display = display;
  envRef.current.minSize = minSize;

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      imageUri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setNatural({ w, h });
      },
      () => {
        if (!cancelled) setError("Could not read this image.");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  useEffect(() => {
    displayDimsRef.current = null;
    setCrop(null);
    setNatural(null);
    setError(null);
  }, [imageUri]);

  useEffect(() => {
    if (!display) return;
    const prevD = displayDimsRef.current;
    const { dispW, dispH } = display;
    if (!prevD || prevD.dispW !== dispW || prevD.dispH !== dispH) {
      displayDimsRef.current = { dispW, dispH };
      setCrop((prev) => {
        if (!prev || !prevD) {
          return { left: 0, top: 0, right: dispW, bottom: dispH };
        }
        const sx = dispW / prevD.dispW;
        const sy = dispH / prevD.dispH;
        return {
          left: prev.left * sx,
          top: prev.top * sy,
          right: prev.right * sx,
          bottom: prev.bottom * sy,
        };
      });
    }
  }, [display?.dispW, display?.dispH]);

  const applyCropToImage = useCallback(async () => {
    if (!natural || !display || !crop) return imageUri;

    const { dispW, dispH, scale } = display;
    const tol = 2;
    const isFull =
      crop.left <= tol &&
      crop.top <= tol &&
      crop.right >= dispW - tol &&
      crop.bottom >= dispH - tol;
    if (isFull) return imageUri;

    const originX = clamp(Math.round(crop.left / scale), 0, natural.w - 1);
    const originY = clamp(Math.round(crop.top / scale), 0, natural.h - 1);
    const width = clamp(Math.round((crop.right - crop.left) / scale), 1, natural.w - originX);
    const height = clamp(Math.round((crop.bottom - crop.top) / scale), 1, natural.h - originY);

    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ crop: { originX, originY, width, height } }],
      { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  }, [natural, display, crop, imageUri]);

  const continueAfterCrop = useCallback(
    (uri: string) => {
      if (purpose === "bookCover") {
        navigation.navigate("ScanCamera", { bookCoverCropResultUri: uri });
        navigation.getParent()?.navigate("Library");
        return;
      }
      navigation.navigate("ExtractionOptions", {
        imageUri: uri,
        ...(route.params.page ? { page: route.params.page } : {}),
        ...(route.params.chapter ? { chapter: route.params.chapter } : {}),
      });
    },
    [navigation, purpose, route.params.chapter, route.params.page]
  );

  const onUseFullPage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void continueAfterCrop(imageUri);
  }, [continueAfterCrop, imageUri]);

  const onApplyCrop = useCallback(async () => {
    if (!crop || !display) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy(true);
    setError(null);
    try {
      const uri = await applyCropToImage();
      continueAfterCrop(uri);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not crop image.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [applyCropToImage, continueAfterCrop, crop, display]);

  const panTL = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const c = cropRef.current;
        dragStartRef.current = c ? { ...c } : null;
      },
      onPanResponderMove: (_, g) => {
        const start = dragStartRef.current;
        const disp = envRef.current.display;
        const min = envRef.current.minSize;
        if (!start || !disp) return;
        const { dispW, dispH } = disp;
        setCrop(() => {
          const left = clamp(start.left + g.dx, 0, start.right - min);
          const top = clamp(start.top + g.dy, 0, start.bottom - min);
          return { left, top, right: start.right, bottom: start.bottom };
        });
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
        Haptics.selectionAsync().catch(() => {});
      },
    })
  ).current;

  const panTR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const c = cropRef.current;
        dragStartRef.current = c ? { ...c } : null;
      },
      onPanResponderMove: (_, g) => {
        const start = dragStartRef.current;
        const disp = envRef.current.display;
        const min = envRef.current.minSize;
        if (!start || !disp) return;
        const { dispW, dispH } = disp;
        setCrop(() => {
          const right = clamp(start.right + g.dx, start.left + min, dispW);
          const top = clamp(start.top + g.dy, 0, start.bottom - min);
          return { left: start.left, top, right, bottom: start.bottom };
        });
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
        Haptics.selectionAsync().catch(() => {});
      },
    })
  ).current;

  const panBL = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const c = cropRef.current;
        dragStartRef.current = c ? { ...c } : null;
      },
      onPanResponderMove: (_, g) => {
        const start = dragStartRef.current;
        const disp = envRef.current.display;
        const min = envRef.current.minSize;
        if (!start || !disp) return;
        const { dispW, dispH } = disp;
        setCrop(() => {
          const left = clamp(start.left + g.dx, 0, start.right - min);
          const bottom = clamp(start.bottom + g.dy, start.top + min, dispH);
          return { left, top: start.top, right: start.right, bottom };
        });
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
        Haptics.selectionAsync().catch(() => {});
      },
    })
  ).current;

  const panBR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const c = cropRef.current;
        dragStartRef.current = c ? { ...c } : null;
      },
      onPanResponderMove: (_, g) => {
        const start = dragStartRef.current;
        const disp = envRef.current.display;
        const min = envRef.current.minSize;
        if (!start || !disp) return;
        const { dispW, dispH } = disp;
        setCrop(() => {
          const right = clamp(start.right + g.dx, start.left + min, dispW);
          const bottom = clamp(start.bottom + g.dy, start.top + min, dispH);
          return { left: start.left, top: start.top, right, bottom };
        });
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
        Haptics.selectionAsync().catch(() => {});
      },
    })
  ).current;

  const movePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const c = cropRef.current;
        dragStartRef.current = c ? { ...c } : null;
      },
      onPanResponderMove: (_, g) => {
        const start = dragStartRef.current;
        const disp = envRef.current.display;
        if (!start || !disp) return;
        const { dispW, dispH } = disp;
        const w = start.right - start.left;
        const h = start.bottom - start.top;
        const nl = clamp(start.left + g.dx, 0, dispW - w);
        const nt = clamp(start.top + g.dy, 0, dispH - h);
        setCrop({ left: nl, top: nt, right: nl + w, bottom: nt + h });
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
      },
    })
  ).current;

  if (error && !natural) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.backButton, darkMode && styles.backButtonDark]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{error}</Text>
        <TouchableOpacity style={[styles.secondaryBtn, darkMode && styles.secondaryBtnDark]} onPress={onUseFullPage}>
          <Text style={[styles.secondaryBtnText, darkMode && styles.secondaryBtnTextDark]}>
            {purpose === "bookCover" ? "Use full photo" : "Skip cropping"}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.titleHeaderRow}>
        <TouchableOpacity
          style={[styles.backButton, darkMode && styles.backButtonDark]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={darkMode ? darkColors.textPrimary : lightColors.textPrimary} />
        </TouchableOpacity>
        <HeaderText
          title={purpose === "bookCover" ? "Crop cover" : "Crop page"}
          subtitle={
            purpose === "bookCover"
              ? "Frame the title and author, or use the full photo. Then we read the cover with AI."
              : "Drag the corners to keep only the text you want analyzed. Or use the full photo."
          }
          style={styles.titleHeaderText}
        />
      </View>

      <View
        style={styles.imageArea}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout((prev) => (prev.cw === width && prev.ch === height ? prev : { cw: width, ch: height }));
        }}
      >
        {!display || !crop ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={[styles.loadingText, darkMode && styles.loadingTextDark]}>Loading image…</Text>
          </View>
        ) : (
          <View style={styles.imageCenter}>
            <View style={{ width: display.dispW, height: display.dispH }}>
              <Image source={{ uri: imageUri }} style={{ width: display.dispW, height: display.dispH }} resizeMode="contain" />

              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <View
                  style={[
                    styles.dimBand,
                    { left: 0, top: 0, width: display.dispW, height: crop.top },
                  ]}
                />
                <View
                  style={[
                    styles.dimBand,
                    {
                      left: 0,
                      top: crop.bottom,
                      width: display.dispW,
                      height: display.dispH - crop.bottom,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dimBand,
                    {
                      left: 0,
                      top: crop.top,
                      width: crop.left,
                      height: crop.bottom - crop.top,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dimBand,
                    {
                      left: crop.right,
                      top: crop.top,
                      width: display.dispW - crop.right,
                      height: crop.bottom - crop.top,
                    },
                  ]}
                />

                <View
                  {...movePan.panHandlers}
                  style={[
                    styles.cropFrame,
                    {
                      left: crop.left,
                      top: crop.top,
                      width: crop.right - crop.left,
                      height: crop.bottom - crop.top,
                      borderColor: accentColor,
                      zIndex: 1,
                    },
                  ]}
                />

                <View
                  {...panTL.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: crop.left - HANDLE_HIT / 2,
                      top: crop.top - HANDLE_HIT / 2,
                      zIndex: 2,
                    },
                  ]}
                >
                  <View style={[styles.handleDot, { borderColor: accentColor }]} />
                </View>
                <View
                  {...panTR.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: crop.right - HANDLE_HIT / 2,
                      top: crop.top - HANDLE_HIT / 2,
                      zIndex: 2,
                    },
                  ]}
                >
                  <View style={[styles.handleDot, { borderColor: accentColor }]} />
                </View>
                <View
                  {...panBL.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: crop.left - HANDLE_HIT / 2,
                      top: crop.bottom - HANDLE_HIT / 2,
                      zIndex: 2,
                    },
                  ]}
                >
                  <View style={[styles.handleDot, { borderColor: accentColor }]} />
                </View>
                <View
                  {...panBR.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: crop.right - HANDLE_HIT / 2,
                      top: crop.bottom - HANDLE_HIT / 2,
                      zIndex: 2,
                    },
                  ]}
                >
                  <View style={[styles.handleDot, { borderColor: accentColor }]} />
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {error ? <Text style={[styles.errorBanner, darkMode && styles.errorTextDark]}>{error}</Text> : null}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.secondaryBtn, darkMode && styles.secondaryBtnDark]}
          onPress={onUseFullPage}
          disabled={busy}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryBtnText, darkMode && styles.secondaryBtnTextDark]}>Use full photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryWrap} onPress={onApplyCrop} disabled={busy || !crop} activeOpacity={0.9}>
          <LinearGradient
            colors={accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  headerRow: {
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  titleHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginBottom: 12,
  },
  titleHeaderText: {
    flex: 1,
    marginBottom: 0,
    minWidth: 0,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  backButtonDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  imageArea: {
    flex: 1,
    minHeight: 200,
  },
  imageCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: lightColors.textMuted,
    fontWeight: "600",
  },
  loadingTextDark: {
    color: darkColors.textSecondary,
  },
  dimBand: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  cropFrame: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  handle: {
    position: "absolute",
    width: HANDLE_HIT,
    height: HANDLE_HIT,
    alignItems: "center",
    justifyContent: "center",
  },
  handleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 2,
  },
  errorText: {
    color: lightColors.dangerText,
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 12,
  },
  errorTextDark: {
    color: darkColors.dangerText,
  },
  errorBanner: {
    color: "#b91c1c",
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
  },
  footer: {
    gap: 10,
    paddingBottom: 18,
    paddingTop: 12,
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: lightColors.card,
  },
  secondaryBtnDark: {
    borderColor: darkColors.borderStrong,
    backgroundColor: darkColors.card,
  },
  secondaryBtnText: {
    fontWeight: "700",
    color: lightColors.textPrimary,
    fontSize: 15,
  },
  secondaryBtnTextDark: {
    color: darkColors.textPrimary,
  },
  primaryWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryBtn: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.75,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
