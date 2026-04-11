/** Mirrors Study Preferences screen; stored on each scan for display + AI generation. */
export type StudyTone = "simple" | "academic" | "exam";
export type StudyLength = "short" | "medium" | "detailed";

export type StudyPreferencesSnapshot = {
  tone: StudyTone;
  length: StudyLength;
  highlightKeyElements: boolean;
  highlightKeyTerms: boolean;
  highlightDefinitions: boolean;
  highlightNumbersDates: boolean;
};

export const DEFAULT_STUDY_PREFERENCES: StudyPreferencesSnapshot = {
  tone: "academic",
  length: "medium",
  highlightKeyElements: true,
  highlightKeyTerms: true,
  highlightDefinitions: true,
  highlightNumbersDates: true,
};
