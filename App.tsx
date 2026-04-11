import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppSettingsProvider, useAppSettings } from "./src/context/AppSettingsContext";
import { ScanProvider } from "./src/context/ScanContext";
import { StreakProvider } from "./src/context/StreakContext";
import { RootTabNavigator } from "./src/navigation/RootTabNavigator";
import { accentColors, darkColors, lightColors } from "./src/theme/colors";

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
  return (
    <SafeAreaProvider>
      <AppSettingsProvider>
        <ScanProvider>
          <StreakProvider>
            <AppContent />
          </StreakProvider>
        </ScanProvider>
      </AppSettingsProvider>
    </SafeAreaProvider>
  );
}
