import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StudyPreferencesSnapshot } from "../types/studyPreferences";
import { DEFAULT_STUDY_PREFERENCES } from "../types/studyPreferences";

const KEY = "@booknotes_study_preferences_v1";

export async function loadStudyPreferences(): Promise<StudyPreferencesSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STUDY_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<StudyPreferencesSnapshot>;
    return {
      ...DEFAULT_STUDY_PREFERENCES,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_STUDY_PREFERENCES };
  }
}

export async function saveStudyPreferences(prefs: StudyPreferencesSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
