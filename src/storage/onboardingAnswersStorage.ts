import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadReadingReminders, saveReadingReminders } from "./readingRemindersStorage";
import type { OnboardingData } from "../onboarding/types";

export async function applyOnboardingReminders(data: OnboardingData): Promise<void> {
  const reminders = await loadReadingReminders();
  reminders.morning = {
    ...reminders.morning,
    enabled: data.toggles.morning,
    hour: 8,
    minute: 30,
  };
  reminders.endOfDay = {
    ...reminders.endOfDay,
    enabled: data.toggles.evening,
    hour: 21,
    minute: 0,
  };
  await saveReadingReminders(reminders);
}

export async function saveOnboardingAnswers(data: OnboardingData): Promise<void> {
  await AsyncStorage.setItem("@booknotes_onboarding_answers", JSON.stringify(data));
}
