import * as FileSystem from "expo-file-system/legacy";
import { buildStudyPreferencesInstructions } from "../study/buildStudyPrompt";
import {
  buildEntityExtractionPrompt,
  type EntityExtractionType,
  type ExistingEntitySeed,
} from "../study/buildEntityExtractionPrompt";
import { stripMarkdownBoldMarkers } from "../utils/stripMarkdownBoldMarkers";
import type {
  BookInsightsPayload,
  BookItem,
  ChapterRange,
  ExtractionMode,
  GeneratedNotes,
  ReadingSession,
  ScanItem,
} from "../types/note";
import type { StudyPreferencesSnapshot } from "../types/studyPreferences";
import { DEFAULT_STUDY_PREFERENCES } from "../types/studyPreferences";

const API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";

type NotesResponse = GeneratedNotes & {
  isBookPage?: boolean;
  rejectionReason?: string;
};

type ContentsResponse = {
  isContentsPage?: boolean;
  rejectionReason?: string;
  chapters?: Array<{ title?: string; startPage?: number | string; endPage?: number | string }>;
};

export type ExtractedEntity = {
  id: string;
  canonical_name: string;
  type: EntityExtractionType;
  aliases: string[];
  description: string;
  salience: "high" | "medium" | "low";
  first_seen_page: number;
};

export type ExtractedRelationship = {
  source_id: string;
  target_id: string;
  type: string;
  evidence: string;
  page: number;
};

export type EntityGraphExtractionResult = {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  page_summary: string;
};

function buildExtractionModeInstructions(modes: ExtractionMode[]) {
  const selected = modes.length > 0 ? modes : ["everything"];
  if (selected.includes("everything")) {
    return " Extraction focus: Everything. Produce the full report across all schema fields.";
  }

  const instructions = selected.map((mode) => {
    switch (mode) {
      case "quotes":
        return (
          "Quotes: extract every notable quote actually visible on the page; keep them verbatim or lightly cleaned for OCR."
        );
      case "words":
        return (
          "Words: extract 8-16 harder, less-common, academic, technical, archaic, or domain-specific vocabulary words from the visible page. " +
          "Avoid basic/common words. vocabularyTerms must contain objects with word and a concise student-friendly definition. " +
          "Also put the selected words in keywords."
        );
      case "bulletPoints":
        return "Bullet Points: mainIdeas must contain 5-8 concise, self-contained bullet points that cover the page.";
      case "everything":
      default:
        return "";
    }
  }).filter(Boolean);

  return (
    " Extraction focus: " +
    instructions.join(" ") +
    " Still fill the other schema fields briefly so the JSON is complete."
  );
}

function extractJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not return valid JSON.");
  }
  return raw.slice(start, end + 1);
}

function extractTextFromResponse(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim().length > 0) {
        chunks.push(part.text);
      } else if (
        typeof part?.text?.value === "string" &&
        part.text.value.trim().length > 0
      ) {
        chunks.push(part.text.value);
      }
    }
  }

  if (chunks.length > 0) {
    return chunks.join("\n");
  }

  return null;
}

function normalizeEntityGraphResponse(
  parsed: unknown,
  pageNumber: number
): EntityGraphExtractionResult {
  const value = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

  const entitiesRaw = Array.isArray(value.entities) ? value.entities : [];
  const relationshipsRaw = Array.isArray(value.relationships) ? value.relationships : [];
  const pageSummary =
    typeof value.page_summary === "string" ? value.page_summary.trim() : "";

  const entities: ExtractedEntity[] = entitiesRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const e = item as Record<string, unknown>;
      const id = typeof e.id === "string" ? e.id.trim() : "";
      const canonicalName =
        typeof e.canonical_name === "string" ? e.canonical_name.trim() : "";
      const type = typeof e.type === "string" ? e.type.trim() : "";
      const description =
        typeof e.description === "string" ? e.description.trim() : "";
      const salience = typeof e.salience === "string" ? e.salience.trim() : "";
      const aliases = Array.isArray(e.aliases)
        ? e.aliases
            .map((alias) => (typeof alias === "string" ? alias.trim() : ""))
            .filter((alias) => alias.length > 0)
        : [];
      const firstSeenPage =
        typeof e.first_seen_page === "number" && Number.isFinite(e.first_seen_page)
          ? e.first_seen_page
          : pageNumber;

      const isValidType =
        type === "person" ||
        type === "place" ||
        type === "concept" ||
        type === "work" ||
        type === "organization" ||
        type === "event";
      const isValidSalience =
        salience === "high" || salience === "medium" || salience === "low";

      if (!id || !canonicalName || !description || !isValidType || !isValidSalience) {
        return null;
      }

      return {
        id,
        canonical_name: canonicalName,
        type: type as EntityExtractionType,
        aliases,
        description,
        salience: salience as "high" | "medium" | "low",
        first_seen_page: firstSeenPage,
      };
    })
    .filter((entity): entity is ExtractedEntity => Boolean(entity));

  const relationships: ExtractedRelationship[] = relationshipsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      const sourceId = typeof r.source_id === "string" ? r.source_id.trim() : "";
      const targetId = typeof r.target_id === "string" ? r.target_id.trim() : "";
      const type = typeof r.type === "string" ? r.type.trim() : "";
      const evidence = typeof r.evidence === "string" ? r.evidence.trim() : "";
      const page =
        typeof r.page === "number" && Number.isFinite(r.page) ? r.page : pageNumber;
      if (!sourceId || !targetId || !type || !evidence) return null;
      return {
        source_id: sourceId,
        target_id: targetId,
        type,
        evidence,
        page,
      };
    })
    .filter((relationship): relationship is ExtractedRelationship => Boolean(relationship));

  return {
    entities,
    relationships,
    page_summary: pageSummary,
  };
}

export async function generateNotesFromImage(
  imageUri: string,
  studyPreferences: StudyPreferencesSnapshot = DEFAULT_STUDY_PREFERENCES,
  extractionModes: ExtractionMode[] = ["everything"]
): Promise<GeneratedNotes> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY in your Expo environment.");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const studyInstructions = buildStudyPreferencesInstructions(studyPreferences);
  const extractionInstructions = buildExtractionModeInstructions(extractionModes);
  const highlightSuffix =
    studyPreferences.highlightKeyElements &&
    (studyPreferences.highlightKeyTerms ||
      studyPreferences.highlightDefinitions ||
      studyPreferences.highlightNumbersDates)
      ? " Reminder: include literal ** markers inside summary, detailedNotes, and mainIdeas strings for every applicable term, number, date, and definition from the page."
      : "";

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are an educational assistant. Extract text from book page images and generate concise notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                studyInstructions +
                extractionInstructions +
                highlightSuffix +
                " Analyze this image and return ONLY JSON with this schema: " +
                '{"isBookPage":boolean,"rejectionReason":"string","summary":"string","mainIdeas":["string"],"detailedNotes":"string","keywords":["string"],"vocabularyTerms":[{"word":"string","definition":"string"}],"quotes":["string"],"sectionHeadings":["string"],"pageNumber":"string"}. ' +
                "Set isBookPage=true ONLY if this is clearly a readable book page with meaningful text. " +
                "If image is blank, blurry, random scene/object, handwriting-only, or non-book content, set isBookPage=false and fill rejectionReason with a short message; keep notes fields empty. " +
                "If isBookPage=true, mainIdeas must have 3-6 bullet points and summary under 60 words. " +
                "quotes: extract notable quotations actually visible on the page — text in quotation marks, block quotes, pull quotes, dialogue, epigraphs, or clearly set-off citations. " +
                "Each array item is one quote string (verbatim or lightly cleaned for OCR). If there are no quotes on the page, use quotes:[]. Do not invent quotes. " +
                "sectionHeadings: list every section/chapter/subsection heading visibly printed on the page (e.g. numbered headings like 1.2, bold or larger titles, running headers, sidebar section titles). " +
                "Preserve top-to-bottom reading order. One string per heading. If there are no such headings, use sectionHeadings:[]. Do not invent headings or repeat body text. " +
                "vocabularyTerms: when Words is requested, choose harder or less frequently used vocabulary from the visible page and define each in plain language. " +
                "If Words is not requested, you may still include a few useful vocabularyTerms, or use vocabularyTerms:[]. " +
                "pageNumber: read the printed page number visible on the page, including roman numerals if shown; if no page number is visible or readable, use an empty string. " +
                "If isBookPage=false, use quotes:[], vocabularyTerms:[], sectionHeadings:[], and pageNumber:\"\".",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawText = extractTextFromResponse(data);

  if (!rawText) {
    const responseId = typeof data?.id === "string" ? data.id : "unknown";
    throw new Error(`Empty AI response. Response id: ${responseId}`);
  }

  const parsed = JSON.parse(extractJson(rawText)) as NotesResponse;

  if (!parsed.isBookPage) {
    throw new Error(
      parsed.rejectionReason?.trim() ||
        "This image does not look like a readable book page. Please scan a clear page."
    );
  }

  if (!parsed.summary?.trim() || !parsed.detailedNotes?.trim()) {
    throw new Error("Could not detect enough readable text. Please retake the photo.");
  }

  const quotesRaw = parsed.quotes ?? [];
  const quotes = Array.isArray(quotesRaw)
    ? quotesRaw.map((q) => (typeof q === "string" ? q.trim() : "")).filter((q) => q.length > 0)
    : [];

  const headingsRaw = parsed.sectionHeadings ?? [];
  const sectionHeadings = Array.isArray(headingsRaw)
    ? headingsRaw.map((h) => (typeof h === "string" ? h.trim() : "")).filter((h) => h.length > 0)
    : [];

  const keywordsRaw = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  const keywords = keywordsRaw
    .map((k) => (typeof k === "string" ? stripMarkdownBoldMarkers(k) : ""))
    .filter((k) => k.length > 0);

  const vocabularyRaw = Array.isArray(parsed.vocabularyTerms) ? parsed.vocabularyTerms : [];
  const vocabularyTerms = vocabularyRaw
    .map((term) => {
      if (!term || typeof term !== "object") return null;
      const t = term as Record<string, unknown>;
      const word = typeof t.word === "string" ? stripMarkdownBoldMarkers(t.word).trim() : "";
      const definition = typeof t.definition === "string" ? t.definition.trim() : "";
      if (!word || !definition) return null;
      return { word, definition };
    })
    .filter((term): term is { word: string; definition: string } => Boolean(term));

  const pageNumber =
    typeof parsed.pageNumber === "string" ? parsed.pageNumber.trim() : "";

  return {
    summary: parsed.summary ?? "",
    mainIdeas: parsed.mainIdeas ?? [],
    detailedNotes: parsed.detailedNotes ?? "",
    keywords,
    ...(vocabularyTerms.length > 0 ? { vocabularyTerms } : {}),
    ...(quotes.length > 0 ? { quotes } : {}),
    ...(sectionHeadings.length > 0 ? { sectionHeadings } : {}),
    ...(pageNumber.length > 0 ? { pageNumber } : {}),
  };
}

export async function extractBookMetadataFromImage(
  imageUri: string
): Promise<{ title: string; author: string }> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY in your Expo environment.");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You extract book metadata from cover images and respond with clean JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Read this book cover and return ONLY JSON in this exact schema: " +
                '{"title":"string","author":"string"}. ' +
                "If author is not visible, set author to 'Unknown'.",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawText = extractTextFromResponse(data);
  if (!rawText) {
    throw new Error("Could not extract metadata from book image.");
  }

  const parsed = JSON.parse(extractJson(rawText)) as { title?: string; author?: string };
  const title = parsed.title?.trim();
  const author = parsed.author?.trim();

  if (!title) {
    throw new Error("Could not detect a valid book title.");
  }

  return {
    title,
    author: author && author.length > 0 ? author : "Unknown",
  };
}

export async function extractChapterRangesFromContentsImage(
  imageUri: string
): Promise<ChapterRange[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY in your Expo environment.");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You read book table-of-contents pages and return clean JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Analyze this image as a table of contents or contents page. Return ONLY JSON with this schema: " +
                '{"isContentsPage":boolean,"rejectionReason":"string","chapters":[{"title":"string","startPage":number,"endPage":number}]}. ' +
                "Set isContentsPage=true only if the image shows a readable contents/table-of-contents page or chapter list with page numbers. " +
                "Extract chapter/section titles and their starting page numbers in reading order. " +
                "If end pages are not printed, infer each endPage as one page before the next chapter startPage. Omit endPage for the final chapter if unknown. " +
                "Ignore acknowledgments, copyright, index, bibliography, notes, references, and purely front-matter entries unless they are the only useful entries. " +
                "If no usable chapter page ranges are visible, set isContentsPage=false and explain briefly in rejectionReason.",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawText = extractTextFromResponse(data);
  if (!rawText) {
    throw new Error("Could not read the contents page.");
  }

  const parsed = JSON.parse(extractJson(rawText)) as ContentsResponse;
  if (!parsed.isContentsPage) {
    throw new Error(
      parsed.rejectionReason?.trim() ||
        "This does not look like a readable table of contents page."
    );
  }

  const chapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
  const ranges = chapters
    .map((chapter) => {
      const title = typeof chapter.title === "string" ? chapter.title.trim() : "";
      const startPage = Number(chapter.startPage);
      const endPage = Number(chapter.endPage);
      if (!title || !Number.isFinite(startPage)) return null;
      return {
        title,
        startPage,
        ...(Number.isFinite(endPage) && endPage >= startPage ? { endPage } : {}),
      };
    })
    .filter((range): range is ChapterRange => Boolean(range))
    .sort((a, b) => a.startPage - b.startPage)
    .map((range, index, all) => {
      if (range.endPage) return range;
      const next = all[index + 1];
      if (!next || next.startPage <= range.startPage) return range;
      return { ...range, endPage: next.startPage - 1 };
    });

  if (ranges.length === 0) {
    throw new Error("Could not find chapter page ranges on that contents page.");
  }

  return ranges;
}

export async function extractEntitiesFromPageText(input: {
  bookMetadata: { title?: string; author?: string; context?: string };
  pageText: string;
  pageNumber: number;
  existingEntities?: ExistingEntitySeed[];
}): Promise<EntityGraphExtractionResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY in your Expo environment.");
  }
  if (!input.pageText?.trim()) {
    throw new Error("Page text is empty. Cannot extract entities.");
  }

  const prompt = buildEntityExtractionPrompt({
    book_metadata: input.bookMetadata,
    page_text: input.pageText,
    page_number: input.pageNumber,
    existing_entities: input.existingEntities ?? [],
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You extract entities and relationships from OCR text and return strict JSON only.",
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawText = extractTextFromResponse(data);
  if (!rawText) {
    const responseId = typeof data?.id === "string" ? data.id : "unknown";
    throw new Error(`Empty AI response. Response id: ${responseId}`);
  }

  const parsed = JSON.parse(extractJson(rawText)) as unknown;
  return normalizeEntityGraphResponse(parsed, input.pageNumber);
}

function formatDurationForReadingSummary(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/**
 * Produces a plain-text reading report from saved timer sessions (newest-first list).
 */
export async function generateReadingHistorySummary(sessions: ReadingSession[]): Promise<string> {
  if (sessions.length === 0) {
    throw new Error("No reading sessions to summarize.");
  }

  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY in your Expo environment.");
  }

  const capped = sessions.length > 120 ? sessions.slice(0, 120) : sessions;
  const omitted = sessions.length - capped.length;

  const lines = capped.map((s, i) => {
    const book = s.bookTitle?.trim() || "No book";
    const when = `${s.startedAt} → ${s.endedAt}`;
    return `${i + 1}. Book: ${book} | Pages: ${s.startPage}–${s.endPage} | Duration: ${formatDurationForReadingSummary(s.durationSeconds)} | ${when}`;
  });

  const header =
    capped.length === sessions.length
      ? `The user has ${sessions.length} logged reading session(s), newest first:\n\n`
      : `The user has ${sessions.length} logged reading session(s). Showing the ${capped.length} most recent:\n\n`;

  const userText =
    header +
    lines.join("\n") +
    (omitted > 0 ? `\n\n(${omitted} older session(s) omitted for length.)` : "") +
    "\n\nWrite a concise, friendly reading summary in plain text only (no markdown, no JSON). " +
    "Include: total time reading across these sessions, which book(s) and page ranges stand out, " +
    "any patterns (frequency, consistency), and 2–4 short encouraging observations. " +
    "Do not invent titles, page numbers, or durations that are not supported by the data. " +
    "Use short paragraphs. Stay under 400 words.";

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You help readers reflect on their logged reading time. Reply in plain text only: short paragraphs, no markdown, no bullet characters if possible or use simple dashes.",
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userText }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawText = extractTextFromResponse(data);
  if (!rawText?.trim()) {
    const responseId = typeof data?.id === "string" ? data.id : "unknown";
    throw new Error(`Empty AI response. Response id: ${responseId}`);
  }

  return rawText.trim();
}

type InsightHints = {
  reportCount: number;
  pagesWithLabels: number;
  pageSpan: string;
  distinctChapters: number;
  reinforcedTotal: number;
  uniqueKeywords: number;
};

function buildInsightHints(_book: BookItem, chronological: ScanItem[]): InsightHints {
  const n = chronological.length;
  const withPage = chronological.filter((s) => s.page?.trim());
  const pageStrs = withPage.map((s) => s.page!.trim());
  const numeric: number[] = [];
  for (const p of pageStrs) {
    const matches = p.match(/\d+/g);
    if (matches) {
      for (const m of matches) {
        const v = parseInt(m, 10);
        if (Number.isFinite(v)) numeric.push(v);
      }
    }
  }
  let pageSpan = "—";
  if (numeric.length >= 2) {
    const lo = Math.min(...numeric);
    const hi = Math.max(...numeric);
    pageSpan = lo === hi ? `${lo}` : `${lo}–${hi}`;
  } else if (numeric.length === 1) {
    pageSpan = `${numeric[0]}`;
  } else if (pageStrs.length > 0) {
    pageSpan = `${pageStrs.length} labels`;
  }
  const chapters = new Set(chronological.map((s) => s.chapter?.trim()).filter(Boolean));
  const reinforcedTotal = chronological.reduce((acc, s) => acc + (s.reinforcedIdeas?.length ?? 0), 0);
  const kw = new Set(
    chronological.flatMap((s) =>
      s.notes.keywords.map((k) => stripMarkdownBoldMarkers(k).toLowerCase().trim()).filter(Boolean)
    ),
  );
  return {
    reportCount: n,
    pagesWithLabels: withPage.length,
    pageSpan,
    distinctChapters: chapters.size,
    reinforcedTotal,
    uniqueKeywords: kw.size,
  };
}

export function themesFallbackFromFacts(facts: string[]): string {
  const bits = facts
    .slice(0, 3)
    .map((f) => f.replace(/[.!?]+$/u, "").trim())
    .filter(Boolean);
  if (bits.length === 0) return "";
  return `Across all reports, several threads recur in the notes: ${bits.join(" ")}.`;
}

function fourthStatFromHints(h: InsightHints): { label: string; value: string } {
  if (h.reinforcedTotal > 0) {
    return {
      label: "Reinforced ideas",
      value: String(h.reinforcedTotal),
    };
  }
  if (h.distinctChapters > 0) {
    return { label: "Chapters named", value: String(h.distinctChapters) };
  }
  if (h.uniqueKeywords > 0) {
    return { label: "Unique keywords", value: String(h.uniqueKeywords) };
  }
  return { label: "Snapshots", value: String(h.reportCount) };
}

function normalizeBookInsightsPayload(parsed: unknown, hints: InsightHints): BookInsightsPayload {
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const headlineRaw = typeof o.headline === "string" ? o.headline.trim() : "";
  const headline =
    headlineRaw ||
    `${hints.reportCount} snapshot${hints.reportCount === 1 ? "" : "s"}; approximate page span ${hints.pageSpan}.`;

  const factsRaw = Array.isArray(o.facts) ? o.facts : [];
  const facts = factsRaw
    .map((f) => (typeof f === "string" ? f.trim().replace(/^[-•*\d.)\s]+/u, "") : ""))
    .filter((f) => f.length > 0)
    .map((f) => (f.length > 100 ? `${f.slice(0, 97)}…` : f))
    .slice(0, 5);

  while (facts.length < 5) {
    facts.push("Additional snapshots would widen coverage.");
  }

  const kickerRaw = typeof o.kicker === "string" ? o.kicker.trim() : "";
  const kicker =
    kickerRaw ||
    "More notes would tighten the picture of how themes evolve.";

  const stats: { label: string; value: string }[] = [
    { label: "Reports", value: String(hints.reportCount) },
    { label: "Pages labeled", value: String(hints.pagesWithLabels) },
    { label: "Page span", value: hints.pageSpan },
    fourthStatFromHints(hints),
  ];

  const statsRaw = Array.isArray(o.stats) ? o.stats : [];
  for (const item of statsRaw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const label = typeof s.label === "string" ? s.label.trim() : "";
    const value = typeof s.value === "string" ? s.value.trim() : "";
    if (!label || !value) continue;
    const dup = stats.some((x) => x.label.toLowerCase() === label.toLowerCase());
    if (!dup && stats.length < 5) {
      stats.push({ label, value: value.length > 24 ? `${value.slice(0, 21)}…` : value });
    }
  }

  const themesFromThemesKey = typeof o.themes === "string" ? o.themes.trim() : "";
  const themesFromAlt = typeof o.themesSynthesis === "string" ? o.themesSynthesis.trim() : "";
  let themesSynthesis = (themesFromThemesKey || themesFromAlt).replace(/\s+/g, " ");
  if (themesSynthesis.length > 420) {
    themesSynthesis = `${themesSynthesis.slice(0, 417)}…`;
  }
  if (!themesSynthesis) {
    themesSynthesis = themesFallbackFromFacts(facts);
  }

  return {
    headline,
    stats: stats.slice(0, 5),
    facts: facts.slice(0, 5),
    themesSynthesis,
    kicker: kicker.length > 100 ? `${kicker.slice(0, 97)}…` : kicker,
  };
}

/**
 * Cross-report insights for one book: compact JSON (stats + bullets) for quick reading (~30s–1min).
 */
export async function generateBookReportsInsights(
  book: BookItem,
  scans: ScanItem[],
): Promise<BookInsightsPayload> {
  if (scans.length === 0) {
    throw new Error("No reports to summarize yet.");
  }

  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY in your Expo environment.");
  }

  const chronological = [...scans].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const hints = buildInsightHints(book, chronological);

  const chapterHint =
    book.chapterRanges && book.chapterRanges.length > 0
      ? book.chapterRanges
          .map((r) => `${r.title}: p.${r.startPage}${r.endPage != null ? `–${r.endPage}` : ""}`)
          .join("; ")
      : "No chapter map saved for this book.";

  const reportLines = chronological.map((s, i) => {
    const page = s.page?.trim() || "";
    const ch = s.chapter?.trim() || "";
    const sum = stripMarkdownBoldMarkers(s.notes.summary).slice(0, 220);
    const ideas = s.notes.mainIdeas
      .slice(0, 4)
      .map((x) => stripMarkdownBoldMarkers(x))
      .join(" | ");
    const when = new Date(s.createdAt).toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    });
    return (
      `[${i + 1}] ${when}` +
      `${page ? ` | p.${page}` : ""}` +
      `${ch ? ` | ${ch}` : ""}\n` +
      `   ${sum || "(no summary)"}` +
      (ideas ? `\n   Ideas: ${ideas}` : "")
    );
  });

  const userText =
    `Book: "${book.title}" by ${book.author?.trim() || "Unknown author"}\n` +
    `Chapter map: ${chapterHint}\n` +
    `Verified counts (use in JSON; do not change these numbers): reports=${hints.reportCount}, pagesWithPrintedLabels=${hints.pagesWithLabels}, approxPageSpan="${hints.pageSpan}", distinctChapters=${hints.distinctChapters}, reinforcedIdeaMentions=${hints.reinforcedTotal}, uniqueKeywords=${hints.uniqueKeywords}\n\n` +
    `Reports oldest→newest:\n${reportLines.join("\n\n")}\n\n` +
    `Return ONLY valid JSON (no markdown fences) with this shape:\n` +
    `{"headline":"...","themes":"...","facts":["...","...","...","...","..."],"kicker":"..."}\n` +
    `Voice: impersonal and direct — like dashboard copy. Never use "you", "your", "the reader", or who logged what. State coverage, themes, and patterns as plain facts.\n` +
    `Rules:\n` +
    `- headline: ONE sentence, max 22 words: reading coverage through this book (page span, snapshot count, rough stretch through the text). No meta about the person.\n` +
    `- themes: 2–3 complete sentences of flowing prose only (no bullets, lists, or labels). Synthesize cross-report thematic patterns from the notes. Impersonal; max ~380 characters.\n` +
    `- facts: EXACTLY 5 strings. Each one punchy declarative insight (max ~95 characters) from the notes — themes, contrasts, recurring ideas, links between sections. No "Fact 1:" prefixes, no long paragraphs, no second-person.\n` +
    `- kicker: ONE short closing line, max 14 words, still impersonal (e.g. what the notes suggest next or what remains thin in the data).\n` +
    `- Scannable in under one minute. No extra keys.`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You output compact book-reading insights as JSON only. Be specific and grounded in the supplied notes. Do not address the user (no you/your/the reader). Do not describe who did what — only what the material shows: coverage, themes, patterns. Never invent quotes or page claims beyond the data.",
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userText }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawText = extractTextFromResponse(data);
  if (!rawText?.trim()) {
    const responseId = typeof data?.id === "string" ? data.id : "unknown";
    throw new Error(`Empty AI response. Response id: ${responseId}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch {
    throw new Error("Could not read AI insights. Try Summarize AI again.");
  }

  return normalizeBookInsightsPayload(parsed, hints);
}
