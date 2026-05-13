import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Haptics from "expo-haptics";
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BarcodeScanBookSheetContent,
  CROSSFADE_MS,
  useBarcodeSheetContentHeight,
  type BarcodeSheetPhase,
} from "../components/BarcodeScanBookSheet";
import { addBookSheetActions } from "./addBookSheetActions";
import { useScanContext } from "./ScanContext";
import {
  isValidIsbnInput,
  lookupBookByIsbn,
  type OpenLibraryBookResult,
} from "../services/openLibrary";

type BarcodeScanBookSheetContextValue = {
  isOpen: boolean;
  openBarcodeScanBookSheet: () => void;
  closeBarcodeScanBookSheet: () => void;
};

const BarcodeScanBookSheetContext = createContext<BarcodeScanBookSheetContextValue | undefined>(
  undefined
);

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function BarcodeScanBookSheetProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { addOrActivateBook } = useScanContext();

  const sheetHideY = useMemo(() => Math.round(windowHeight * 0.55) + 80, [windowHeight]);
  const sheetY = useRef(new Animated.Value(0)).current;
  const keyboardLift = useRef(new Animated.Value(0)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<BarcodeSheetPhase>("scanning");
  const [renderPhase, setRenderPhase] = useState<BarcodeSheetPhase>("scanning");
  const [detectedIsbn, setDetectedIsbn] = useState<string | null>(null);
  const [bookResult, setBookResult] = useState<OpenLibraryBookResult | null>(null);
  const [manualIsbnOpen, setManualIsbnOpen] = useState(false);
  const [manualIsbnDraft, setManualIsbnDraft] = useState("");

  const lookupAbortRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<BarcodeSheetPhase>("scanning");

  const chromeHeight = 8 + 14 + 16 + 28 + insets.bottom;
  const contentHeight = useBarcodeSheetContentHeight(renderPhase, manualIsbnOpen);
  const targetSheetHeight = chromeHeight + contentHeight;

  const resetScannerState = useCallback(() => {
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    setPhase("scanning");
    setRenderPhase("scanning");
    setDetectedIsbn(null);
    setBookResult(null);
    setManualIsbnOpen(false);
    setManualIsbnDraft("");
    contentOpacity.setValue(1);
    phaseRef.current = "scanning";
  }, [contentOpacity]);

  const closeSheetAnimated = useCallback(() => {
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: sheetHideY,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOp, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsOpen(false);
        resetScannerState();
      }
    });
  }, [backdropOp, resetScannerState, sheetHideY, sheetY]);

  const openBarcodeScanBookSheet = useCallback(() => {
    resetScannerState();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsOpen(true);
  }, [resetScannerState]);

  const closeBarcodeScanBookSheet = useCallback(() => {
    closeSheetAnimated();
  }, [closeSheetAnimated]);

  const transitionPhase = useCallback(
    (next: BarcodeSheetPhase) => {
      if (next === phaseRef.current) return;
      phaseRef.current = next;
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: CROSSFADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setRenderPhase(next);
        setPhase(next);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: CROSSFADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished: fadeInFinished }) => {
          if (fadeInFinished && next === "found") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        });
      });
    },
    [contentOpacity]
  );

  const startLookup = useCallback(
    async (rawIsbn: string) => {
      const trimmed = rawIsbn.trim();
      if (!isValidIsbnInput(trimmed)) {
        setDetectedIsbn(trimmed);
        transitionPhase("error");
        return;
      }

      lookupAbortRef.current?.abort();
      const controller = new AbortController();
      lookupAbortRef.current = controller;

      setDetectedIsbn(trimmed);
      setBookResult(null);
      transitionPhase("lookingUp");

      try {
        const result = await lookupBookByIsbn(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        if (!result) {
          transitionPhase("error");
          return;
        }
        setBookResult(result);
        transitionPhase("found");
      } catch (error) {
        if (controller.signal.aborted) return;
        transitionPhase("error");
      }
    },
    [transitionPhase]
  );

  useEffect(() => {
    if (!isOpen) {
      sheetY.setValue(sheetHideY);
      backdropOp.setValue(0);
      return;
    }
    sheetY.setValue(sheetHideY);
    backdropOp.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY, {
        toValue: 0,
        friction: 9,
        tension: 64,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOp, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, backdropOp, sheetHideY, sheetY]);

  useEffect(() => {
    if (!isOpen) return;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
  }, [isOpen, renderPhase, manualIsbnOpen, targetSheetHeight]);

  useEffect(() => {
    if (!isOpen || !manualIsbnOpen) {
      keyboardLift.setValue(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (event: { endCoordinates: { height: number }; duration?: number }) => {
      const lift = Math.max(0, event.endCoordinates.height - insets.bottom + 12);
      Animated.timing(keyboardLift, {
        toValue: -lift,
        duration: event.duration ?? 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const onHide = (event: { duration?: number }) => {
      Animated.timing(keyboardLift, {
        toValue: 0,
        duration: event.duration ?? 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      keyboardLift.setValue(0);
    };
  }, [insets.bottom, isOpen, keyboardLift, manualIsbnOpen]);

  useEffect(() => {
    if (!isOpen || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSheetAnimated();
      return true;
    });
    return () => sub.remove();
  }, [closeSheetAnimated, isOpen]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder(_, g) {
          return g.dy > 12 && g.dy > Math.abs(g.dx) * 0.65;
        },
        onPanResponderGrant: () => {
          sheetY.stopAnimation();
          backdropOp.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          const y = Math.max(0, Math.min(g.dy, sheetHideY));
          sheetY.setValue(y);
          const hide = Math.max(sheetHideY, 1);
          backdropOp.setValue(Math.max(0, 1 - y / hide));
        },
        onPanResponderRelease: (_, g) => {
          const y = Math.max(0, Math.min(g.dy, sheetHideY));
          const threshold = Math.min(120, Math.max(72, sheetHideY * 0.22));
          if (y > threshold || g.vy > 0.85) {
            closeSheetAnimated();
          } else {
            Animated.parallel([
              Animated.spring(sheetY, {
                toValue: 0,
                friction: 9,
                tension: 64,
                useNativeDriver: true,
              }),
              Animated.timing(backdropOp, {
                toValue: 1,
                duration: 240,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [backdropOp, closeSheetAnimated, sheetHideY, sheetY]
  );

  const onBarcodeScanned = useCallback(
    (data: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      void startLookup(data);
    },
    [startLookup]
  );

  const onOpenManualIsbn = useCallback(() => {
    setManualIsbnOpen((open) => {
      if (open) Keyboard.dismiss();
      return !open;
    });
  }, []);

  const onSubmitManualIsbn = useCallback(() => {
    void startLookup(manualIsbnDraft);
  }, [manualIsbnDraft, startLookup]);

  const onCancelLookup = useCallback(() => {
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    resetScannerState();
  }, [resetScannerState]);

  const onAddToLibrary = useCallback(() => {
    if (!bookResult) return;
    addOrActivateBook({
      title: bookResult.title,
      author: bookResult.author,
      coverUri: bookResult.coverUrl ?? "",
      totalPageCount: bookResult.pageCount ?? undefined,
      isbn: bookResult.isbn,
    });
    closeSheetAnimated();
  }, [addOrActivateBook, bookResult, closeSheetAnimated]);

  const onScanAgain = useCallback(() => {
    resetScannerState();
  }, [resetScannerState]);

  const onTryAgain = useCallback(() => {
    resetScannerState();
  }, [resetScannerState]);

  const onEnterManually = useCallback(() => {
    closeSheetAnimated();
    setTimeout(() => {
      addBookSheetActions.open?.();
    }, 300);
  }, [closeSheetAnimated]);

  const value = useMemo(
    () => ({
      isOpen,
      openBarcodeScanBookSheet,
      closeBarcodeScanBookSheet,
    }),
    [closeBarcodeScanBookSheet, isOpen, openBarcodeScanBookSheet]
  );

  return (
    <BarcodeScanBookSheetContext.Provider value={value}>
      {children}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeBarcodeScanBookSheet}
      >
        <View style={styles.root}>
          <Animated.View pointerEvents="box-none" style={[styles.dim, { opacity: backdropOp }]}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={closeBarcodeScanBookSheet}
              accessibilityRole="button"
              accessibilityLabel="Close barcode scanner"
            />
          </Animated.View>
          <Animated.View
            {...panResponder.panHandlers}
            style={{ transform: [{ translateY: Animated.add(sheetY, keyboardLift) }] }}
          >
            <View
              style={[
                styles.panel,
                {
                  paddingBottom: 28 + insets.bottom,
                  minHeight: targetSheetHeight,
                },
              ]}
            >
              <View style={styles.handle} />
              <Animated.View style={{ opacity: contentOpacity }}>
                <BarcodeScanBookSheetContent
                  phase={renderPhase}
                  detectedIsbn={detectedIsbn}
                  bookResult={bookResult}
                  manualIsbnOpen={manualIsbnOpen}
                  manualIsbnDraft={manualIsbnDraft}
                  onManualIsbnDraftChange={setManualIsbnDraft}
                  onBarcodeScanned={onBarcodeScanned}
                  onOpenManualIsbn={onOpenManualIsbn}
                  onSubmitManualIsbn={onSubmitManualIsbn}
                  onCancelLookup={onCancelLookup}
                  onAddToLibrary={onAddToLibrary}
                  onScanAgain={onScanAgain}
                  onTryAgain={onTryAgain}
                  onEnterManually={onEnterManually}
                />
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </BarcodeScanBookSheetContext.Provider>
  );
}

export function useBarcodeScanBookSheet() {
  const ctx = useContext(BarcodeScanBookSheetContext);
  if (!ctx) {
    throw new Error("useBarcodeScanBookSheet must be used inside BarcodeScanBookSheetProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  panel: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 14,
    marginBottom: 16,
  },
});
