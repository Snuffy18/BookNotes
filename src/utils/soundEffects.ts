import { Audio } from "expo-av";

let soundEffectsPlaybackEnabled = true;

/** Synced from AppSettings (persisted). Default on until settings load. */
export function setSoundEffectsPlaybackEnabled(enabled: boolean) {
  soundEffectsPlaybackEnabled = enabled;
}

let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  audioModeReady = true;
}

/** Filenames match `assets/sound-effects/*.wav` (see folder for exact spelling). */
const SOUND_FILES = {
  bookAddedSuccessful: require("../../assets/sound-effects/book-added-sucessful.wav"),
  takePhoto: require("../../assets/sound-effects/take-photo.wav"),
  summarizeAiSuccess: require("../../assets/sound-effects/summarize-ai-success.wav"),
  pdfExtracted: require("../../assets/sound-effects/pdf-extracted.wav"),
  aiExtractionCompleted: require("../../assets/sound-effects/ai-extraction-completed.wav"),
} as const;

export type SoundEffectId = keyof typeof SOUND_FILES;

export function playSoundEffect(id: SoundEffectId): void {
  if (!soundEffectsPlaybackEnabled) return;
  void (async () => {
    try {
      await ensureAudioMode();
      const { sound } = await Audio.Sound.createAsync(SOUND_FILES[id], {
        shouldPlay: true,
        volume: 1,
      });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      // Missing asset or device limitation — fail silently.
    }
  })();
}
