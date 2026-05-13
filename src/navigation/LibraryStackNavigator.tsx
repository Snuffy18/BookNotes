import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BookReportsScreen } from "../screens/BookReportsScreen";
import { CropPhotoScreen } from "../screens/CropPhotoScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { ReportDetailsScreen } from "../screens/ReportDetailsScreen";
import type { LibraryStackParamList } from "./types";

const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();

export function LibraryStackNavigator() {
  return (
    <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
      <LibraryStack.Screen name="LibraryHome" component={LibraryScreen} />
      <LibraryStack.Screen
        name="BookReports"
        component={BookReportsScreen}
        getId={({ params }) => String(params.bookId)}
      />
      <LibraryStack.Screen name="ReportDetails" component={ReportDetailsScreen} />
      <LibraryStack.Screen
        name="CropPhoto"
        component={CropPhotoScreen}
        getId={({ params }) => `crop-${params.purpose ?? "page"}-${params.imageUri}`}
        options={{
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
    </LibraryStack.Navigator>
  );
}
