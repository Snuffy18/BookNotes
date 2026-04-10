import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppSettings } from "../context/AppSettingsContext";
import { darkColors, lightColors } from "../theme/colors";
import { ProfileScreen } from "../screens/ProfileScreen";
import { LibraryStackNavigator } from "./LibraryStackNavigator";
import { ScanStackNavigator } from "./ScanStackNavigator";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

function getDeepestRouteName(route: any): string | null {
  let current = route;
  while (current?.state?.routes && typeof current.state.index === "number") {
    current = current.state.routes[current.state.index];
  }
  return current?.name ?? null;
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { darkMode } = useAppSettings();
  const scanRoute = state.routes.find((route) => route.name === "ScanFlow");
  const libraryRoute = state.routes.find((route) => route.name === "Library");
  const profileRoute = state.routes.find((route) => route.name === "Profile");

  const isScanActive = state.routes[state.index]?.name === "ScanFlow";
  const isLibraryActive = state.routes[state.index]?.name === "Library";
  const isProfileActive = state.routes[state.index]?.name === "Profile";
  const activeRootRoute = state.routes[state.index];
  const activeNestedRouteName = getDeepestRouteName(activeRootRoute);

  // Hide bottom nav on full-screen detail/result flows to avoid overlap.
  if (
    activeNestedRouteName === "ReportDetails" ||
    activeNestedRouteName === "Processing" ||
    activeNestedRouteName === "Results"
  ) {
    return null;
  }

  const triggerNavHaptic = () => {
    Haptics.selectionAsync().catch(() => {
      // Ignore haptics failures on unsupported devices.
    });
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.leftPill,
          {
            backgroundColor: darkMode ? darkColors.card : lightColors.card,
            borderColor: darkMode ? darkColors.border : lightColors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.leftButton,
            isScanActive && styles.leftButtonActive,
            isScanActive && darkMode && styles.leftButtonActiveDark,
          ]}
          onPress={() => {
            triggerNavHaptic();
            if (scanRoute) navigation.navigate(scanRoute.name);
          }}
          activeOpacity={0.85}
        >
          <Ionicons
            name="scan"
            size={18}
            color={
              isScanActive
                ? darkMode
                  ? darkColors.textPrimary
                  : "#000"
                : darkMode
                ? darkColors.textSecondary
                : lightColors.textMuted
            }
          />
          <Text
            style={[
              styles.leftLabel,
              isScanActive && styles.leftLabelActive,
              isScanActive && darkMode && styles.leftLabelActiveDark,
              !isScanActive && darkMode && styles.leftLabelDark,
            ]}
          >
            Scan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.leftButton,
            isLibraryActive && styles.leftButtonActive,
            isLibraryActive && darkMode && styles.leftButtonActiveDark,
          ]}
          onPress={() => {
            triggerNavHaptic();
            if (libraryRoute) navigation.navigate(libraryRoute.name);
          }}
          activeOpacity={0.85}
        >
          <Ionicons
            name="library-outline"
            size={18}
            color={
              isLibraryActive
                ? darkMode
                  ? darkColors.textPrimary
                  : "#000"
                : darkMode
                ? darkColors.textSecondary
                : lightColors.textMuted
            }
          />
          <Text
            style={[
              styles.leftLabel,
              isLibraryActive && styles.leftLabelActive,
              isLibraryActive && darkMode && styles.leftLabelActiveDark,
              !isLibraryActive && darkMode && styles.leftLabelDark,
            ]}
          >
            Library
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.profileCircle,
          {
            backgroundColor: darkMode ? darkColors.card : lightColors.card,
            borderColor: darkMode ? darkColors.border : lightColors.border,
          },
              isProfileActive && styles.profileCircleActive,
        ]}
        onPress={() => {
          triggerNavHaptic();
          if (profileRoute) navigation.navigate(profileRoute.name);
        }}
        activeOpacity={0.85}
      >
        <Ionicons
          name="person-outline"
          size={20}
          color={isProfileActive ? "#fff" : darkMode ? darkColors.textPrimary : lightColors.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}

export function RootTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="ScanFlow" component={ScanStackNavigator} />
      <Tab.Screen name="Library" component={LibraryStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftPill: {
    width: "50%",
    marginRight: 10,
    height: 56,
    borderRadius: 999,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    flexDirection: "row",
    padding: 6,
    elevation: 8,
    shadowColor: lightColors.textPrimary,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
  },
  leftButton: {
    flex: 1,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  leftButtonActive: {
    backgroundColor: "#f1f5f9",
  },
  leftButtonActiveDark: {
    backgroundColor: darkColors.border,
  },
  leftLabel: {
    color: lightColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  leftLabelDark: {
    color: darkColors.textSecondary,
  },
  leftLabelActive: {
    color: lightColors.textPrimary,
  },
  leftLabelActiveDark: {
    color: darkColors.textPrimary,
  },
  profileCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: lightColors.textPrimary,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
  },
  profileCircleActive: {
    backgroundColor: lightColors.textPrimary,
    borderColor: lightColors.textPrimary,
  },
});
