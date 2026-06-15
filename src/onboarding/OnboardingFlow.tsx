import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ResultBookType,
  ResultBooks,
  ResultChallenge,
  ResultNotes,
  ResultWhy,
  ScreenBookType,
  ScreenBooksPerYear,
  ScreenChallenge,
  ScreenNotes,
  ScreenNotifications,
  ScreenSignUp,
  ScreenSummary,
  ScreenWelcome,
  ScreenWhy,
} from "./screens";
import { BG } from "./theme";
import { DEFAULT_ONBOARDING_DATA, type OnboardingData, type OnboardingScreenProps } from "./types";

const SCREENS = [
  { key: "welcome", render: (p: OnboardingScreenProps) => <ScreenWelcome {...p} /> },
  { key: "books", render: (p: OnboardingScreenProps) => <ScreenBooksPerYear {...p} /> },
  { key: "r-books", render: (p: OnboardingScreenProps) => <ResultBooks {...p} /> },
  { key: "challenge", render: (p: OnboardingScreenProps) => <ScreenChallenge {...p} /> },
  { key: "r-challenge", render: (p: OnboardingScreenProps) => <ResultChallenge {...p} /> },
  { key: "why", render: (p: OnboardingScreenProps) => <ScreenWhy {...p} /> },
  { key: "r-why", render: (p: OnboardingScreenProps) => <ResultWhy {...p} /> },
  { key: "notes", render: (p: OnboardingScreenProps) => <ScreenNotes {...p} /> },
  { key: "r-notes", render: (p: OnboardingScreenProps) => <ResultNotes {...p} /> },
  { key: "booktype", render: (p: OnboardingScreenProps) => <ScreenBookType {...p} /> },
  { key: "r-booktype", render: (p: OnboardingScreenProps) => <ResultBookType {...p} /> },
  { key: "summary", render: (p: OnboardingScreenProps) => <ScreenSummary {...p} /> },
  { key: "notifications", render: (p: OnboardingScreenProps) => <ScreenNotifications {...p} /> },
  { key: "signup", render: (p: OnboardingScreenProps) => <ScreenSignUp {...p} /> },
] as const;

type Props = {
  initialIdx?: number;
  initialData?: OnboardingData;
  onComplete: (data: OnboardingData) => void;
  onProgressChange?: (idx: number, data: OnboardingData) => void;
};

export function OnboardingFlow({
  initialIdx = 0,
  initialData = DEFAULT_ONBOARDING_DATA,
  onComplete,
  onProgressChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(initialIdx);
  const [data, setData] = useState<OnboardingData>(initialData);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    onProgressChange?.(idx, data);
  }, [data, idx, onProgressChange]);

  const setField = useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const next = useCallback(() => {
    if (idx >= SCREENS.length - 1) {
      onComplete(dataRef.current);
      return;
    }
    setIdx((current) => Math.min(SCREENS.length - 1, current + 1));
  }, [idx, onComplete]);

  const skipAll = useCallback(() => {
    setIdx(SCREENS.length - 1);
  }, []);

  const screenProps: OnboardingScreenProps = {
    state: data,
    set: setField,
    next,
    skip: skipAll,
  };

  const Screen = SCREENS[idx].render;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Screen {...screenProps} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
    paddingTop: 50,
  },
});
