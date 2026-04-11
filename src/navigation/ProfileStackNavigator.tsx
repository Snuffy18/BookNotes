import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppearanceScreen } from "../screens/AppearanceScreen";
import { AppBehaviorScreen } from "../screens/AppBehaviorScreen";
import { ThemesScreen } from "../screens/ThemesScreen";
import { ExportSettingsScreen } from "../screens/ExportSettingsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ReadingRemindersScreen } from "../screens/ReadingRemindersScreen";
import { StudyPreferencesScreen } from "../screens/StudyPreferencesScreen";
import type { ProfileStackParamList } from "./types";

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="Appearance" component={AppearanceScreen} />
      <ProfileStack.Screen name="Themes" component={ThemesScreen} />
      <ProfileStack.Screen name="StudyPreferences" component={StudyPreferencesScreen} />
      <ProfileStack.Screen name="AppBehavior" component={AppBehaviorScreen} />
      <ProfileStack.Screen name="ExportSettings" component={ExportSettingsScreen} />
      <ProfileStack.Screen name="ReadingReminders" component={ReadingRemindersScreen} />
    </ProfileStack.Navigator>
  );
}
