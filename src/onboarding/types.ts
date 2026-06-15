export type OnboardingToggles = {
  morning: boolean;
  evening: boolean;
  weekly: boolean;
};

export type OnboardingData = {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  q5: number | null;
  toggles: OnboardingToggles;
};

export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  q1: null,
  q2: null,
  q3: null,
  q4: null,
  q5: null,
  toggles: { morning: true, evening: false, weekly: true },
};

export type OnboardingScreenProps = {
  state: OnboardingData;
  set: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  next: () => void;
  skip: () => void;
};
