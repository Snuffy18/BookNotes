import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type ScanProcessingStep = {
  label: string;
  activeSublabel: string;
  doneSublabel: string;
  pendingIcon: IoniconName;
};

export const SCAN_PROCESSING_STEPS: ScanProcessingStep[] = [
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

export const SCAN_PROCESSING_STEP_INTERVAL_MS = 2000;
export const SCAN_PROCESSING_STEP_COUNT = SCAN_PROCESSING_STEPS.length;
