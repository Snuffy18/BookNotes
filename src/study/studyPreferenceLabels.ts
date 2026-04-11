import type { StudyLength, StudyPreferencesSnapshot, StudyTone } from "../types/studyPreferences";

const TONE_LABELS: Record<StudyTone, string> = {
  simple: "Simple",
  academic: "Academic",
  exam: "Exam-ready",
};

const LENGTH_LABELS: Record<StudyLength, string> = {
  short: "Short",
  medium: "Medium",
  detailed: "Detailed",
};

const LENGTH_DROPDOWN: Record<StudyLength, { title: string; subtitle?: string }> = {
  short: { title: "Short", subtitle: "3–5 bullets" },
  medium: { title: "Medium" },
  detailed: { title: "Detailed" },
};

export function labelTone(tone: StudyTone): string {
  return TONE_LABELS[tone] ?? tone;
}

export function labelLength(length: StudyLength): string {
  return LENGTH_LABELS[length] ?? length;
}

/** Label shown in Study Preferences dropdown row (matches previous screen copy). */
export function formatLengthDropdown(length: StudyLength): string {
  const m = LENGTH_DROPDOWN[length];
  if (!m) return length;
  return m.subtitle ? `${m.title} · ${m.subtitle}` : m.title;
}

export function labelHighlightSummary(p: StudyPreferencesSnapshot): string {
  if (!p.highlightKeyElements) return "Off";
  const n = [p.highlightKeyTerms, p.highlightDefinitions, p.highlightNumbersDates].filter(Boolean).length;
  if (n === 3) return "Key terms, definitions, numbers";
  if (n === 0) return "None";
  const parts: string[] = [];
  if (p.highlightKeyTerms) parts.push("terms");
  if (p.highlightDefinitions) parts.push("definitions");
  if (p.highlightNumbersDates) parts.push("numbers/dates");
  return parts.join(", ");
}
