import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProcessingScreen } from "../screens/ProcessingScreen";
import { ResultsScreen } from "../screens/ResultsScreen";
import { ScanCameraScreen } from "../screens/ScanCameraScreen";
import type { ScanStackParamList } from "./types";

const ScanStack = createNativeStackNavigator<ScanStackParamList>();

export function ScanStackNavigator() {
  return (
    <ScanStack.Navigator screenOptions={{ headerShown: false }}>
      <ScanStack.Screen name="ScanCamera" component={ScanCameraScreen} />
      <ScanStack.Screen name="Processing" component={ProcessingScreen} />
      <ScanStack.Screen name="Results" component={ResultsScreen} />
    </ScanStack.Navigator>
  );
}
