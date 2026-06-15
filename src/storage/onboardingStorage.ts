import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_ONBOARDING_DATA, type OnboardingData } from "../onboarding/types";

const DISMISSED_KEY = "booknotes_onboarding_dismissed";
const PROGRESS_KEY = "booknotes_onboarding_v2";

export async function loadOnboardingDismissed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY);
  return raw === "1";
}

export async function saveOnboardingDismissed(): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_KEY, "1");
}

type StoredProgress = {
  idx: number;
  data: OnboardingData;
};

export async function loadOnboardingProgress(): Promise<StoredProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return {
      idx: typeof parsed.idx === "number" ? parsed.idx : 0,
      data: { ...DEFAULT_ONBOARDING_DATA, ...parsed.data },
    };
  } catch {
    return null;
  }
}

export async function saveOnboardingProgress(idx: number, data: OnboardingData): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ idx, data }));
}

export async function clearOnboardingProgress(): Promise<void> {
  await AsyncStorage.removeItem(PROGRESS_KEY);
}
