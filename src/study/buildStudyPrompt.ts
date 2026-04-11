import type { StudyPreferencesSnapshot } from "../types/studyPreferences";

/** Appends to the vision prompt so model output matches Study Preferences. */
export function buildStudyPreferencesInstructions(p: StudyPreferencesSnapshot): string {
  const toneLine =
    p.tone === "simple"
      ? "Tone: Plain, friendly language suitable for someone new to the topic."
      : p.tone === "academic"
        ? "Tone: Formal, precise academic phrasing where appropriate."
        : "Tone: Exam-ready — concise, structured, favor scannable bullets and crisp definitions.";

  const lengthLine =
    p.length === "short"
      ? "Length: Summary under 45 words. mainIdeas: exactly 3–5 very short bullets. detailedNotes: compact (at most a few short paragraphs)."
      : p.length === "medium"
        ? "Length: Balanced — summary under 60 words, mainIdeas 3–6 bullets, detailedNotes clear but not padded."
        : "Length: Rich — summary may approach ~100 words if needed, 5–8 main ideas when the page supports it, detailedNotes more comprehensive.";

  let highlightLine =
    "Highlighting in output: Do not use **asterisk** markers; plain text only.";
  if (p.highlightKeyElements) {
    const bits: string[] = [];
    if (p.highlightKeyTerms) bits.push("key terms and proper names");
    if (p.highlightDefinitions) bits.push("definitional phrases");
    if (p.highlightNumbersDates) bits.push("important numbers, statistics, and dates");
    if (bits.length > 0) {
      highlightLine =
        "Highlighting in output (REQUIRED when the page contains matching content): " +
        `In the JSON string fields summary, detailedNotes, and each string in mainIdeas, you MUST wrap ${bits.join(
          ", "
        )} with pairs of ** ASCII asterisks ** exactly like markdown bold (examples: **photosynthesis**, **1492**, **the process by which**). ` +
        "Put the literal ** characters inside the JSON strings; this is valid JSON. " +
        "When the page has numbers, dates, terms, or definitions, include multiple **...** spans — do not leave those fields entirely plain if such content exists. " +
        "Only skip markers for a field if that field truly has no qualifying text from the page.";
    }
  }

  return `${toneLine} ${lengthLine} ${highlightLine}`;
}
