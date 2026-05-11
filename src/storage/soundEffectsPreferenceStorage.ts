import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "booknotes_sound_effects_enabled";

export async function loadSoundEffectsEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return true;
  return raw === "1";
}

export async function saveSoundEffectsEnabled(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, value ? "1" : "0");
}
