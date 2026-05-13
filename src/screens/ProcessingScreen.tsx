import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommonActions } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAppSettings } from "../context/AppSettingsContext";
import { useExportPreferences } from "../context/ExportPreferencesContext";
import { openReportInLibraryTab } from "../navigation/openReportInLibraryTab";
import type { RootTabParamList, ScanStackParamList } from "../navigation/types";
import { extractEntitiesFromPageText, generateNotesFromImage } from "../services/ai";
import { useStreak } from "../context/StreakContext";
import { useScanContext } from "../context/ScanContext";
import { useStudyPreferences } from "../context/StudyPreferencesContext";
import { darkColors } from "../theme/colors";
import type { ChapterRange, ScanItem } from "../types/note";
import { pdfContentOptionsFromPrefs } from "../types/exportPreferences";
import { shareSingleReportPdf } from "../utils/bookReportsPdf";
import type { ExistingEntitySeed } from "../study/buildEntityExtractionPrompt";
import { detectReinforcedIdeas } from "../utils/detectReinforcedIdeas";
import { playSoundEffect } from "../utils/soundEffects";
import { toProcessingUserMessage } from "../utils/processingErrorMessage";

type Props = NativeStackScreenProps<ScanStackParamList, "Processing">;
type IoniconName = ComponentProps<typeof Ionicons>["name"];

type StepVisualState = "pending" | "active" | "done";

const SCREEN_BG = "#111";

const STEPS: Array<{
  label: string;
  activeSublabel: string;
  doneSublabel: string;
  pendingIcon: IoniconName;
}> = [
  {
    label: "Scanning image",
    activeSublabel: "Preparing your page…",
    doneSublabel: "Page detected clearly",
    pendingIcon: "image-outline",
  },
  {
    label: "Reading text",
    activeSublabel: "Extracting text from the scan…",
    doneSublabel: "342 words extracted",
    pendingIcon: "text-outline",
  },
  {
    label: "Building key ideas",
    activeSublabel: "Finding what matters most…",
    doneSublabel: "Key ideas structured",
    pendingIcon: "bulb-outline",
  },
  {
    label: "Extracting quotes",
    activeSublabel: "Pulling standout lines…",
    doneSublabel: "Quotes captured",
    pendingIcon: "chatbubble-ellipses-outline",
  },
  {
    label: "Writing summary",
    activeSublabel: "Composing your notes…",
    doneSublabel: "Summary ready",
    pendingIcon: "document-text-outline",
  },
];

const PULSE_HALF_MS = 300;
const STEP_CROSSFADE_MS = 300;
const STEP_INTERVAL_MS = 2000;
const EASE_IN_OUT = Easing.inOut(Easing.ease);

/** Amber glow + dot share one 0.6s loop; scale 0.6↔1.4, dot opacity 0.15↔1, glow opacity 0.08↔0.25 */
function ActiveStepPulseIcon() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: PULSE_HALF_MS,
          easing: EASE_IN_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: PULSE_HALF_MS,
          easing: EASE_IN_OUT,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
  const dotOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const glowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.25] });

  return (
    <View style={styles.pulseIconCell}>
      <Animated.View
        style={[
          styles.stepIconActiveGlow,
          {
            backgroundColor: "#fbbf24",
            opacity: glowOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.stepPulseDot,
          {
            backgroundColor: "#fbbf24",
            opacity: dotOpacity,
            transform: [{ scale }],
          },
        ]}
      />
    </View>
  );
}

function ProgressBarFillPulse() {
  const op = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 0.7,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [op]);
  return (
    <Animated.View style={[styles.progressFillInner, { opacity: op }]} />
  );
}

function hapticStepCompleted() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function parseNumericPage(page?: string) {
  if (!page) return null;
  const match = page.match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function findChapterForPage(page: number | null, ranges?: ChapterRange[]) {
  if (page === null || !ranges || ranges.length === 0) return null;
  const sorted = [...ranges].sort((a, b) => a.startPage - b.startPage);
  return (
    sorted.find((range, index) => {
      const inferredEnd = sorted[index + 1]?.startPage
        ? sorted[index + 1].startPage - 1
        : undefined;
      const endPage = range.endPage ?? inferredEnd;
      return page >= range.startPage && (endPage === undefined || page <= endPage);
    })?.title ?? null
  );
}

function stepStateForIndex(activeIndex: number, index: number): StepVisualState {
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "pending";
}

function ProcessingStepRow({
  state,
  step,
  isLast,
}: {
  state: StepVisualState;
  step: (typeof STEPS)[number];
  isLast: boolean;
}) {
  const pendingOpac = useRef(new Animated.Value(state === "pending" ? 1 : 0)).current;
  const activeOpac = useRef(new Animated.Value(state === "active" ? 1 : 0)).current;
  const doneOpac = useRef(new Animated.Value(state === "done" ? 1 : 0)).current;
  const badgeProgressOpac = useRef(new Animated.Value(state === "active" ? 1 : 0)).current;
  const badgeDoneOpac = useRef(new Animated.Value(state === "done" ? 1 : 0)).current;

  useEffect(() => {
    const p = state === "pending" ? 1 : 0;
    const a = state === "active" ? 1 : 0;
    const d = state === "done" ? 1 : 0;
    const bp = state === "active" ? 1 : 0;
    const bd = state === "done" ? 1 : 0;
    Animated.parallel([
      Animated.timing(pendingOpac, {
        toValue: p,
        duration: STEP_CROSSFADE_MS,
        easing: EASE_IN_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(activeOpac, {
        toValue: a,
        duration: STEP_CROSSFADE_MS,
        easing: EASE_IN_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(doneOpac, {
        toValue: d,
        duration: STEP_CROSSFADE_MS,
        easing: EASE_IN_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(badgeProgressOpac, {
        toValue: bp,
        duration: STEP_CROSSFADE_MS,
        easing: EASE_IN_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(badgeDoneOpac, {
        toValue: bd,
        duration: STEP_CROSSFADE_MS,
        easing: EASE_IN_OUT,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state, pendingOpac, activeOpac, doneOpac, badgeProgressOpac, badgeDoneOpac]);

  let sublabel: string | null = null;
  if (state === "done") sublabel = step.doneSublabel;
  else if (state === "active") sublabel = step.activeSublabel;

  return (
    <View style={!isLast ? styles.stepRowWithDivider : undefined}>
      <View style={styles.stepRowInner}>
        <View style={styles.stepIconCol}>
          <View style={styles.stepIconStack}>
            <Animated.View
              style={[styles.stepIconLayer, { opacity: pendingOpac }]}
              pointerEvents="none"
            >
              <View style={styles.stepIconPending}>
                <Ionicons name={step.pendingIcon} size={16} color="rgba(255,255,255,0.2)" />
              </View>
            </Animated.View>
            <Animated.View style={[styles.stepIconLayer, { opacity: activeOpac }]} pointerEvents="none">
              <ActiveStepPulseIcon />
            </Animated.View>
            <Animated.View style={[styles.stepIconLayer, { opacity: doneOpac }]} pointerEvents="none">
              <View style={styles.stepIconDone}>
                <Ionicons name="checkmark" size={14} color="#60a5fa" />
              </View>
            </Animated.View>
          </View>
        </View>
        <View style={styles.stepTextCol}>
          <Text style={[styles.stepLabel, state === "pending" && styles.stepLabelPending]}>{step.label}</Text>
          {sublabel ? <Text style={styles.stepSublabel}>{sublabel}</Text> : null}
        </View>
        <View style={styles.stepBadgeCol}>
          <View style={styles.badgeStack}>
            <Animated.View style={[styles.badgeLayer, { opacity: badgeProgressOpac }]} pointerEvents="none">
              <View style={styles.badgeActive}>
                <Text style={styles.badgeActiveText}>In progress</Text>
              </View>
            </Animated.View>
            <Animated.View style={[styles.badgeLayer, { opacity: badgeDoneOpac }]} pointerEvents="none">
              <View style={styles.badgeDone}>
                <Text style={styles.badgeDoneText}>Done</Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ProcessingScreen({ navigation, route }: Props) {
  const { accentColor } = useAppSettings();
  const studyPrefs = useStudyPreferences();
  const exportPrefs = useExportPreferences();
  const { addScan, updateScan, activeBook, scans, books } = useScanContext();
  const { recordSuccessfulScan } = useStreak();
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [apiSuccess, setApiSuccess] = useState(false);
  const pendingNavRef = useRef<ScanItem | null>(null);
  const didNavigateRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setError(null);
        const rescanId = route.params.rescanForScanId;
        const studyPreferencesSnapshot =
          route.params.studyPreferences ?? {
            tone: studyPrefs.tone,
            length: studyPrefs.length,
            highlightKeyElements: studyPrefs.highlightKeyElements,
            highlightKeyTerms: studyPrefs.highlightKeyTerms,
            highlightDefinitions: studyPrefs.highlightDefinitions,
            highlightNumbersDates: studyPrefs.highlightNumbersDates,
          };
        const extractionModes = route.params.extractionModes ?? [
          route.params.extractionMode ?? "everything",
        ];
        const notes = await generateNotesFromImage(
          route.params.imageUri,
          studyPreferencesSnapshot,
          extractionModes
        );
        if (!mounted) return;
        const pageLabel = route.params.page?.trim() || notes.pageNumber?.trim() || "";
        const existingScan = rescanId ? scans.find((s) => s.id === rescanId) : undefined;
        const bookForScan = existingScan?.bookId
          ? books.find((b) => b.id === existingScan.bookId) ?? activeBook
          : activeBook;
        const mappedChapter = findChapterForPage(
          parseNumericPage(pageLabel),
          bookForScan?.chapterRanges
        );
        const chapterLabel =
          route.params.chapter?.trim() ||
          mappedChapter ||
          notes.sectionHeadings?.[0]?.trim() ||
          existingScan?.chapter?.trim() ||
          "";
        const previousBookScans = bookForScan?.id
          ? scans.filter(
              (scan) => scan.bookId === bookForScan.id && scan.id !== rescanId
            )
          : [];
        const reinforcedIdeas = detectReinforcedIdeas(
          notes.mainIdeas,
          pageLabel || undefined,
          previousBookScans
        );

        const pageTextForEntities = [
          notes.summary?.trim() ?? "",
          ...(Array.isArray(notes.mainIdeas) ? notes.mainIdeas : []),
          notes.detailedNotes?.trim() ?? "",
          ...(Array.isArray(notes.quotes) ? notes.quotes : []),
        ]
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
          .join("\n");

        const existingEntityMap = new Map<string, ExistingEntitySeed>();
        if (bookForScan?.id) {
          previousBookScans.forEach((scan) => {
            (scan.entityGraph?.entities ?? []).forEach((entity) => {
              const current = existingEntityMap.get(entity.id);
              if (current) {
                const mergedAliases = Array.from(
                  new Set([...(current.aliases ?? []), ...(entity.aliases ?? [])])
                );
                existingEntityMap.set(entity.id, {
                  ...current,
                  aliases: mergedAliases,
                });
                return;
              }
              existingEntityMap.set(entity.id, {
                id: entity.id,
                canonical_name: entity.canonical_name,
                type: entity.type,
                aliases: entity.aliases,
              });
            });
          });
        }

        let entityGraph:
          | {
              entities: {
                id: string;
                canonical_name: string;
                type: "person" | "place" | "concept" | "work" | "organization" | "event";
                aliases: string[];
                description: string;
                salience: "high" | "medium" | "low";
                first_seen_page: number;
              }[];
              relationships: {
                source_id: string;
                target_id: string;
                type: string;
                evidence: string;
                page: number;
              }[];
              page_summary: string;
            }
          | undefined;

        if (pageTextForEntities.length > 0) {
          try {
            entityGraph = await extractEntitiesFromPageText({
              bookMetadata: {
                title: bookForScan?.title ?? "",
                author: bookForScan?.author ?? "",
                context: bookForScan?.chapterRanges?.length
                  ? `Known chapter ranges: ${bookForScan.chapterRanges
                      .map((r) => `${r.title} (${r.startPage}${r.endPage ? `-${r.endPage}` : "+"})`)
                      .join(", ")}`
                  : undefined,
              },
              pageText: pageTextForEntities,
              pageNumber: parseNumericPage(pageLabel) ?? 0,
              existingEntities: Array.from(existingEntityMap.values()),
            });
          } catch {
            // Entity graph is optional; do not block notes/report generation on this step.
          }
        }

        if (rescanId) {
          if (!existingScan) {
            throw new Error("That report is no longer available. Open it again from your library.");
          }
          const nextPage = pageLabel || existingScan.page;
          const nextChapter = chapterLabel.trim() ? chapterLabel : existingScan.chapter;
          updateScan(rescanId, {
            ...(nextPage?.trim() ? { page: nextPage.trim() } : {}),
            ...(nextChapter?.trim() ? { chapter: nextChapter.trim() } : {}),
            extractionMode: extractionModes[0] ?? "everything",
            extractionModes,
            notes,
            reinforcedIdeas: reinforcedIdeas.length > 0 ? reinforcedIdeas : undefined,
            ...(entityGraph ? { entityGraph } : {}),
            studyPreferences: studyPreferencesSnapshot,
          });
          pendingNavRef.current = {
            ...existingScan,
            ...(nextPage?.trim() ? { page: nextPage.trim() } : {}),
            ...(nextChapter?.trim() ? { chapter: nextChapter.trim() } : {}),
            extractionMode: extractionModes[0] ?? "everything",
            extractionModes,
            notes,
            ...(reinforcedIdeas.length > 0 ? { reinforcedIdeas } : { reinforcedIdeas: undefined }),
            ...(entityGraph ? { entityGraph } : {}),
            studyPreferences: studyPreferencesSnapshot,
          };
        }
        if (!rescanId) {
          const item = {
            id: `${Date.now()}`,
            createdAt: new Date().toISOString(),
            imageUri: route.params.imageUri,
            bookId: activeBook?.id,
            book: activeBook?.title,
            ...(pageLabel ? { page: pageLabel } : {}),
            ...(chapterLabel ? { chapter: chapterLabel } : {}),
            extractionMode: extractionModes[0] ?? "everything",
            extractionModes,
            notes,
            ...(reinforcedIdeas.length > 0 ? { reinforcedIdeas } : {}),
            ...(entityGraph ? { entityGraph } : {}),
            studyPreferences: studyPreferencesSnapshot,
          };
          addScan(item);
          recordSuccessfulScan();
          pendingNavRef.current = item;
        }
        setApiSuccess(true);
      } catch (e) {
        if (!mounted) return;
        setError(toProcessingUserMessage(e));
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [
    addScan,
    updateScan,
    navigation,
    recordSuccessfulScan,
    route.params.imageUri,
    route.params.page,
    route.params.chapter,
    route.params.extractionMode,
    route.params.extractionModes,
    route.params.rescanForScanId,
    route.params.studyPreferences,
    activeBook,
    books,
    scans,
    studyPrefs.tone,
    studyPrefs.length,
    studyPrefs.highlightKeyElements,
    studyPrefs.highlightKeyTerms,
    studyPrefs.highlightDefinitions,
    studyPrefs.highlightNumbersDates,
  ]);

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => {
        const last = STEPS.length - 1;
        if (prev >= last) return prev;
        hapticStepCompleted();
        return prev + 1;
      });
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [error]);

  useEffect(() => {
    if (didNavigateRef.current || !apiSuccess || error) return;
    if (activeIndex < STEPS.length - 1) return;
    const item = pendingNavRef.current;
    if (!item) return;
    didNavigateRef.current = true;
    playSoundEffect("aiExtractionCompleted");

    const rescanId = route.params.rescanForScanId;
    const returnTab = route.params.rescanReturnTab;

    if (rescanId && returnTab) {
      const tabNav = navigation.getParent() as NavigationProp<RootTabParamList> | undefined;
      if (returnTab === "library") {
        openReportInLibraryTab(tabNav, item, { reportNavOrigin: "library" });
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "ScanCamera" }],
          })
        );
      } else {
        navigation.pop(1);
      }
      return;
    }

    if (exportPrefs.autoExportAfterScan && exportPrefs.defaultFormat === "pdf") {
      void shareSingleReportPdf(
        item,
        activeBook ?? null,
        pdfContentOptionsFromPrefs(exportPrefs)
      ).catch(() => {});
    }

    const tabNav = navigation.getParent() as NavigationProp<RootTabParamList> | undefined;
    if (openReportInLibraryTab(tabNav, item, { reportNavOrigin: "scan" })) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "ScanCamera" }],
        })
      );
      return;
    }

    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: "ScanCamera" }, { name: "Results", params: { item } }],
      })
    );
  }, [
    apiSuccess,
    activeIndex,
    error,
    navigation,
    activeBook,
    exportPrefs,
    route.params.rescanForScanId,
    route.params.rescanReturnTab,
  ]);

  const stepIndexShown = activeIndex + 1;

  const onRetryProcessing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const p = route.params;
    navigation.replace("Processing", {
      imageUri: p.imageUri,
      ...(p.page ? { page: p.page } : {}),
      ...(p.chapter ? { chapter: p.chapter } : {}),
      ...(p.extractionMode ? { extractionMode: p.extractionMode } : {}),
      ...(p.extractionModes ? { extractionModes: p.extractionModes } : {}),
      ...(p.rescanForScanId ? { rescanForScanId: p.rescanForScanId } : {}),
      ...(p.studyPreferences ? { studyPreferences: p.studyPreferences } : {}),
      ...(p.rescanReturnTab ? { rescanReturnTab: p.rescanReturnTab } : {}),
    });
  };

  const onTakePhotoAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "ScanCamera" }],
      })
    );
  };

  const onCancelProcessing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (route.params.rescanForScanId) {
      navigation.goBack();
      return;
    }
    onTakePhotoAgain();
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.centered}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Extracting ideas</Text>
          <Text style={styles.subtitle}>
            Your page is being read and analysed — this takes a few seconds.
          </Text>
        </View>

        <View style={styles.stepCard}>
          {STEPS.map((step, i) => (
            <ProcessingStepRow
              key={step.label}
              state={stepStateForIndex(activeIndex, i)}
              step={step}
              isLast={i === STEPS.length - 1}
            />
          ))}
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFillTrack,
                { width: `${((activeIndex + 1) / STEPS.length) * 100}%` },
              ]}
            >
              <ProgressBarFillPulse />
            </View>
          </View>
          <Text style={styles.progressCaption}>
            Step {stepIndexShown} of {STEPS.length}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorOverlay}>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn't analyze this page</Text>
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.errorActions}>
              <TouchableOpacity
                style={[styles.errorPrimaryBtn, { backgroundColor: accentColor }]}
                onPress={onTakePhotoAgain}
                accessibilityRole="button"
                accessibilityLabel="Take photo again"
              >
                <Text style={styles.errorPrimaryBtnText}>Take photo again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.errorSecondaryBtn}
                onPress={onRetryProcessing}
                accessibilityRole="button"
                accessibilityLabel="Try again with same photo"
              >
                <Text style={styles.errorSecondaryBtnText}>Try again</Text>
              </TouchableOpacity>
              {route.params.rescanForScanId ? (
                <TouchableOpacity
                  style={styles.errorCancelLinkWrap}
                  onPress={onCancelProcessing}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.errorCancelLinkText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 32,
  },
  headerBlock: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: -0.52,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 19.5,
  },
  stepCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
  },
  stepRowWithDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  stepRowInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  stepIconCol: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconStack: {
    width: 28,
    height: 24,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseIconCell: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconActiveGlow: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  stepIconDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconPending: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#ffffff",
  },
  stepLabelPending: {
    color: "rgba(255,255,255,0.3)",
  },
  stepSublabel: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.3)",
    lineHeight: 14,
  },
  stepBadgeCol: {
    minWidth: 72,
    alignItems: "flex-end",
  },
  badgeStack: {
    minWidth: 72,
    height: 28,
    position: "relative",
  },
  badgeLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  badgeDone: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  badgeDoneText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#60a5fa",
  },
  badgeActive: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(251,191,36,0.1)",
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#fbbf24",
  },
  progressSection: {
    gap: 8,
    width: "100%",
  },
  progressTrack: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFillTrack: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFillInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#60a5fa",
    borderRadius: 2,
  },
  progressCaption: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.3)",
    textAlign: "right",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  errorBox: {
    backgroundColor: darkColors.dangerBg,
    borderColor: darkColors.dangerBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: darkColors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
  errorActions: {
    gap: 8,
    marginTop: 4,
  },
  errorPrimaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  errorPrimaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  errorSecondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  errorSecondaryBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    fontSize: 15,
  },
  errorCancelLinkWrap: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  errorCancelLinkText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "500",
  },
});
