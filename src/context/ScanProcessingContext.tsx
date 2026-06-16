import * as Haptics from "expo-haptics";
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
import type { ScanStackParamList } from "../navigation/types";
import {
  mapScanExtractionError,
  runScanExtraction,
  type RunScanExtractionParams,
} from "../processing/runScanExtraction";
import {
  SCAN_PROCESSING_STEP_COUNT,
  SCAN_PROCESSING_STEP_INTERVAL_MS,
} from "../processing/scanProcessingSteps";
import { useScanContext } from "./ScanContext";
import { useStreak } from "./StreakContext";
import { useStudyPreferences } from "./StudyPreferencesContext";
import type { ScanItem } from "../types/note";
import { playSoundEffect } from "../utils/soundEffects";

export type ScanProcessingStatus = "idle" | "running" | "complete" | "error";

type ScanProcessingContextValue = {
  status: ScanProcessingStatus;
  activeStepIndex: number;
  resultItem: ScanItem | null;
  error: string | null;
  dismissedToHome: boolean;
  params: RunScanExtractionParams | null;
  startProcessing: (params: RunScanExtractionParams) => void;
  dismissToHome: () => void;
  clearJob: () => void;
};

const ScanProcessingContext = createContext<ScanProcessingContextValue | null>(null);

function hapticStepCompleted() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function ScanProcessingProvider({ children }: { children: ReactNode }) {
  const studyPrefs = useStudyPreferences();
  const { addScan, updateScan, activeBook, scans, books } = useScanContext();
  const { recordSuccessfulScan } = useStreak();

  const [status, setStatus] = useState<ScanProcessingStatus>("idle");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [resultItem, setResultItem] = useState<ScanItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedToHome, setDismissedToHome] = useState(false);
  const [params, setParams] = useState<RunScanExtractionParams | null>(null);
  const [apiComplete, setApiComplete] = useState(false);

  const jobGenerationRef = useRef(0);

  // Keep the extraction dependencies in a ref so `startProcessing` can stay
  // referentially stable. Otherwise it would be recreated whenever `scans`
  // changes (which happens the moment a scan is added), re-triggering the
  // ProcessingScreen effect and registering the report twice.
  const depsRef = useRef({
    activeBook,
    books,
    scans,
    studyPrefs,
    addScan,
    updateScan,
    recordSuccessfulScan,
  });
  depsRef.current = {
    activeBook,
    books,
    scans,
    studyPrefs,
    addScan,
    updateScan,
    recordSuccessfulScan,
  };

  const clearJob = useCallback(() => {
    jobGenerationRef.current += 1;
    setApiComplete(false);
    setStatus("idle");
    setActiveStepIndex(0);
    setResultItem(null);
    setError(null);
    setDismissedToHome(false);
    setParams(null);
  }, []);

  const startProcessing = useCallback((nextParams: RunScanExtractionParams) => {
    const generation = jobGenerationRef.current + 1;
    jobGenerationRef.current = generation;
    setApiComplete(false);
    setStatus("running");
    setActiveStepIndex(0);
    setResultItem(null);
    setError(null);
    setDismissedToHome(false);
    setParams(nextParams);

    void (async () => {
      try {
        const item = await runScanExtraction(nextParams, depsRef.current);
        if (jobGenerationRef.current !== generation) return;
        setApiComplete(true);
        setResultItem(item);
      } catch (e) {
        if (jobGenerationRef.current !== generation) return;
        setError(mapScanExtractionError(e));
        setStatus("error");
      }
    })();
  }, []);

  const dismissToHome = useCallback(() => {
    setDismissedToHome(true);
  }, []);

  useEffect(() => {
    if (status !== "running" || error) return;

    const id = setInterval(() => {
      setActiveStepIndex((prev) => {
        const last = SCAN_PROCESSING_STEP_COUNT - 1;
        if (prev >= last) return prev;
        hapticStepCompleted();
        return prev + 1;
      });
    }, SCAN_PROCESSING_STEP_INTERVAL_MS);

    return () => clearInterval(id);
  }, [error, status]);

  useEffect(() => {
    if (status !== "running" || error || !apiComplete) return;
    if (activeStepIndex < SCAN_PROCESSING_STEP_COUNT - 1) return;

    setStatus("complete");
    playSoundEffect("aiExtractionCompleted");
  }, [activeStepIndex, apiComplete, error, status]);

  const value = useMemo(
    (): ScanProcessingContextValue => ({
      status,
      activeStepIndex,
      resultItem,
      error,
      dismissedToHome,
      params,
      startProcessing,
      dismissToHome,
      clearJob,
    }),
    [
      activeStepIndex,
      clearJob,
      dismissToHome,
      dismissedToHome,
      error,
      params,
      resultItem,
      startProcessing,
      status,
    ]
  );

  return <ScanProcessingContext.Provider value={value}>{children}</ScanProcessingContext.Provider>;
}

export function useScanProcessing() {
  const ctx = useContext(ScanProcessingContext);
  if (!ctx) {
    throw new Error("useScanProcessing must be used within ScanProcessingProvider");
  }
  return ctx;
}
