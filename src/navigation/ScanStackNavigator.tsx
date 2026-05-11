import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CropPhotoScreen } from "../screens/CropPhotoScreen";
import { ExtractionOptionsScreen } from "../screens/ExtractionOptionsScreen";
import { ProcessingScreen } from "../screens/ProcessingScreen";
import { ReadingHistoryScreen } from "../screens/ReadingHistoryScreen";
import { ResultsScreen } from "../screens/ResultsScreen";
import { ScanCameraScreen } from "../screens/ScanCameraScreen";
import { StreakDetailsScreen } from "../screens/StreakDetailsScreen";
import type { ScanStackParamList } from "./types";

const ScanStack = createNativeStackNavigator<ScanStackParamList>();

export function ScanStackNavigator() {
  return (
    <ScanStack.Navigator screenOptions={{ headerShown: false }}>
      <ScanStack.Screen name="ScanCamera" component={ScanCameraScreen} />
      <ScanStack.Screen name="ReadingHistory" component={ReadingHistoryScreen} />
      <ScanStack.Screen name="StreakDetails" component={StreakDetailsScreen} />
      <ScanStack.Screen
        name="CropPhoto"
        component={CropPhotoScreen}
        options={{
          // Avoid iOS edge-swipe back fighting crop handle drags (and odd nav state).
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <ScanStack.Screen name="ExtractionOptions" component={ExtractionOptionsScreen} />
      <ScanStack.Screen name="Processing" component={ProcessingScreen} />
      <ScanStack.Screen name="Results" component={ResultsScreen} />
    </ScanStack.Navigator>
  );
}
