import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { WelcomeScreen } from "./src/components/WelcomeScreen";
import { useAddBookSheet } from "./src/context/AddBookSheetContext";
import { useBarcodeScanBookSheet } from "./src/context/BarcodeScanBookSheetContext";
import { useAppSettings } from "./src/context/AppSettingsContext";
import { useScanContext } from "./src/context/ScanContext";
import { RootTabNavigator } from "./src/navigation/RootTabNavigator";
import { loadOnboardingDismissed, saveOnboardingDismissed } from "./src/storage/onboardingStorage";
import { accentColors, darkColors, lightColors } from "./src/theme/colors";

const SPLASH_BG = "#111111";

export function AppRoot() {
  const { darkMode, accentTheme } = useAppSettings();
  const { books, libraryReady } = useScanContext();
  const { openBarcodeScanBookSheet } = useBarcodeScanBookSheet();
  const { openAddBookSheet } = useAddBookSheet();
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean | null>(null);

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
    loadOnboardingDismissed().then(setOnboardingDismissed);
  }, []);

  useEffect(() => {
    if (books.length > 0 && onboardingDismissed === false) {
      void saveOnboardingDismissed().then(() => setOnboardingDismissed(true));
    }
  }, [books.length, onboardingDismissed]);

  const showWelcome =
    libraryReady && onboardingDismissed === false && books.length === 0;

  const handleSkip = () => {
    void saveOnboardingDismissed().then(() => setOnboardingDismissed(true));
  };

  if (!libraryReady || onboardingDismissed === null) {
    return <View style={{ flex: 1, backgroundColor: SPLASH_BG }} />;
  }

  if (showWelcome) {
    return (
      <>
        <StatusBar style="light" />
        <WelcomeScreen
          onAddFirstBook={() => openBarcodeScanBookSheet()}
          onTakePhoto={() => openAddBookSheet()}
          onSkip={handleSkip}
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
