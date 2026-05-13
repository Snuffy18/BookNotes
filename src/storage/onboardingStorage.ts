import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "booknotes_onboarding_dismissed";

export async function loadOnboardingDismissed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === "1";
}

export async function saveOnboardingDismissed(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
