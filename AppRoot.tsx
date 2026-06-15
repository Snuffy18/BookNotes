import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { OnboardingFlow } from "./src/onboarding/OnboardingFlow";
import { DEFAULT_ONBOARDING_DATA } from "./src/onboarding/types";
import { useAppSettings } from "./src/context/AppSettingsContext";
import { useScanContext } from "./src/context/ScanContext";
import { RootTabNavigator } from "./src/navigation/RootTabNavigator";
import {
  clearOnboardingProgress,
  loadOnboardingDismissed,
  loadOnboardingProgress,
  saveOnboardingDismissed,
  saveOnboardingProgress,
} from "./src/storage/onboardingStorage";
import { applyOnboardingReminders, saveOnboardingAnswers } from "./src/storage/onboardingAnswersStorage";
import { accentColors, darkColors, lightColors } from "./src/theme/colors";

const SPLASH_BG = "#111111";

export function AppRoot() {
  const { darkMode, accentTheme } = useAppSettings();
  const { books, libraryReady } = useScanContext();
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean | null>(null);
  const [onboardingIdx, setOnboardingIdx] = useState(0);
  const [onboardingData, setOnboardingData] = useState(DEFAULT_ONBOARDING_DATA);
  const [onboardingReady, setOnboardingReady] = useState(false);

  const primaryColor = accentColors[accentTheme];
  const appTheme = useMemo(
    () =>
      darkMode
        ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: darkColors.background,
              primary: primaryColor,
              card: darkColors.card,
              text: darkColors.textPrimary,
              border: darkColors.border,
            },
          }
        : {
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: lightColors.background,
              primary: primaryColor,
              card: lightColors.card,
              text: lightColors.textPrimary,
              border: lightColors.border,
            },
          },
    [darkMode, primaryColor]
  );

  useEffect(() => {
    Promise.all([loadOnboardingDismissed(), loadOnboardingProgress()]).then(
      ([dismissed, progress]) => {
        setOnboardingDismissed(dismissed);
        if (progress) {
          setOnboardingIdx(progress.idx);
          setOnboardingData(progress.data);
        }
        setOnboardingReady(true);
      }
    );
  }, []);

  useEffect(() => {
    if (books.length > 0 && onboardingDismissed === false) {
      void saveOnboardingDismissed().then(() => setOnboardingDismissed(true));
    }
  }, [books.length, onboardingDismissed]);

  const showOnboarding =
    libraryReady && onboardingReady && onboardingDismissed === false && books.length === 0;

  const handleOnboardingProgress = useCallback((idx: number, data: typeof onboardingData) => {
    setOnboardingIdx(idx);
    setOnboardingData(data);
    void saveOnboardingProgress(idx, data);
  }, []);

  const handleOnboardingComplete = useCallback((data: typeof onboardingData) => {
    void (async () => {
      await Promise.all([
        saveOnboardingDismissed(),
        clearOnboardingProgress(),
        saveOnboardingAnswers(data),
        applyOnboardingReminders(data),
      ]);
      setOnboardingDismissed(true);
    })();
  }, []);

  if (!libraryReady || onboardingDismissed === null || !onboardingReady) {
    return <View style={{ flex: 1, backgroundColor: SPLASH_BG }} />;
  }

  if (showOnboarding) {
    return (
      <>
        <StatusBar style="light" />
        <OnboardingFlow
          initialIdx={onboardingIdx}
          initialData={onboardingData}
          onProgressChange={handleOnboardingProgress}
          onComplete={handleOnboardingComplete}
        />
      </>
    );
  }

  return (
    <NavigationContainer theme={appTheme}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <RootTabNavigator />
    </NavigationContainer>
  );
}
