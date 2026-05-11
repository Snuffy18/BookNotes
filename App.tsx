import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppSettingsProvider, useAppSettings } from "./src/context/AppSettingsContext";
import { ReadingSessionProvider } from "./src/context/ReadingSessionContext";
import { ScanProvider } from "./src/context/ScanContext";
import { StreakProvider } from "./src/context/StreakContext";
import { ExportPreferencesProvider } from "./src/context/ExportPreferencesContext";
import { StudyPreferencesProvider } from "./src/context/StudyPreferencesContext";
import { RootTabNavigator } from "./src/navigation/RootTabNavigator";
import { accentColors, darkColors, lightColors } from "./src/theme/colors";
import { FONT_CANELA_TEXT_BOLD, FONT_CANELA_TEXT_REGULAR } from "./src/theme/fonts";

function AppContent() {
  const { darkMode, accentTheme } = useAppSettings();
  const primaryColor = accentColors[accentTheme];
  const appTheme = darkMode
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
      };
  return (
    <NavigationContainer theme={appTheme}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <RootTabNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    [FONT_CANELA_TEXT_REGULAR]: require("./assets/CanelaText-Regular-Trial.otf"),
    [FONT_CANELA_TEXT_BOLD]: require("./assets/CanelaText-Bold-Trial.otf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <ExportPreferencesProvider>
            <StudyPreferencesProvider>
              <ScanProvider>
                <ReadingSessionProvider>
                  <StreakProvider>
                    <AppContent />
                  </StreakProvider>
                </ReadingSessionProvider>
              </ScanProvider>
            </StudyPreferencesProvider>
          </ExportPreferencesProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
