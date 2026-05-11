import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_EXPORT_PREFERENCES,
  type ExportPreferencesSnapshot,
} from "../types/exportPreferences";

const KEY = "booknotes_export_preferences_v1";

export async function loadExportPreferences(): Promise<ExportPreferencesSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_EXPORT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<ExportPreferencesSnapshot>;
    return { ...DEFAULT_EXPORT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_EXPORT_PREFERENCES };
  }
}

export async function saveExportPreferences(next: ExportPreferencesSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
