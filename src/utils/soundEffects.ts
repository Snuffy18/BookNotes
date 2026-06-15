import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

let soundEffectsPlaybackEnabled = true;

/** Synced from AppSettings (persisted). Default on until settings load. */
export function setSoundEffectsPlaybackEnabled(enabled: boolean) {
  soundEffectsPlaybackEnabled = enabled;
}

let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: "mixWithOthers",
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
  bookDeletedTrash: require("../../assets/sound-effects/trash.wav"),
} as const;

export type SoundEffectId = keyof typeof SOUND_FILES;

const SOUND_VOLUMES: Partial<Record<SoundEffectId, number>> = {
  bookAddedSuccessful: 0.1,
  bookDeletedTrash: 0.1,
  takePhoto: 0.1,
};

export function playSoundEffect(id: SoundEffectId): void {
  if (!soundEffectsPlaybackEnabled) return;
  void (async () => {
    try {
      await ensureAudioMode();
      const player = createAudioPlayer(SOUND_FILES[id]);
      player.volume = SOUND_VOLUMES[id] ?? 1;
      const subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          player.release();
        }
      });
      player.play();
    } catch {
      // Missing asset or device limitation — fail silently.
    }
  })();
}
