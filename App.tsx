import { useFonts } from "expo-font";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppRoot } from "./AppRoot";
import { AddBookSheetProvider } from "./src/context/AddBookSheetContext";
import { BarcodeScanBookSheetProvider } from "./src/context/BarcodeScanBookSheetContext";
import { AppSettingsProvider } from "./src/context/AppSettingsContext";
import { ReadingPlanProvider } from "./src/context/ReadingPlanContext";
import { ReadingRemindersProvider } from "./src/context/ReadingRemindersContext";
import { ReadingSessionProvider } from "./src/context/ReadingSessionContext";
import { ScanProcessingProvider } from "./src/context/ScanProcessingContext";
import { ScanProvider } from "./src/context/ScanContext";
import { StreakProvider } from "./src/context/StreakContext";
import { ExportPreferencesProvider } from "./src/context/ExportPreferencesContext";
import { StudyPreferencesProvider } from "./src/context/StudyPreferencesContext";
import { FONT_CANELA_TEXT_BOLD, FONT_CANELA_TEXT_REGULAR, FONT_DM_SERIF_DISPLAY } from "./src/theme/fonts";

export default function App() {
  const [fontsLoaded] = useFonts({
    [FONT_CANELA_TEXT_REGULAR]: require("./assets/CanelaText-Regular-Trial.otf"),
    [FONT_CANELA_TEXT_BOLD]: require("./assets/CanelaText-Bold-Trial.otf"),
    [FONT_DM_SERIF_DISPLAY]: DMSerifDisplay_400Regular,
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
              <ReadingRemindersProvider>
                <ScanProvider>
                  <BarcodeScanBookSheetProvider>
                    <AddBookSheetProvider>
                      <ReadingSessionProvider>
                        <ReadingPlanProvider>
                          <StreakProvider>
                            <ScanProcessingProvider>
                              <AppRoot />
                            </ScanProcessingProvider>
                          </StreakProvider>
                        </ReadingPlanProvider>
                      </ReadingSessionProvider>
                    </AddBookSheetProvider>
                  </BarcodeScanBookSheetProvider>
                </ScanProvider>
              </ReadingRemindersProvider>
            </StudyPreferencesProvider>
          </ExportPreferencesProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
