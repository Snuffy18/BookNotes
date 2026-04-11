import * as FileSystem from "expo-file-system/legacy";
import { buildStudyPreferencesInstructions } from "../study/buildStudyPrompt";
import type { GeneratedNotes } from "../types/note";
import type { StudyPreferencesSnapshot } from "../types/studyPreferences";
import { DEFAULT_STUDY_PREFERENCES } from "../types/studyPreferences";

const API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";

type NotesResponse = GeneratedNotes & {
  isBookPage?: boolean;
  rejectionReason?: string;
};

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

export async function generateNotesFromImage(
  imageUri: string,
  studyPreferences: StudyPreferencesSnapshot = DEFAULT_STUDY_PREFERENCES
): Promise<GeneratedNotes> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY in your Expo environment.");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const studyInstructions = buildStudyPreferencesInstructions(studyPreferences);

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
                " Analyze this image and return ONLY JSON with this schema: " +
                '{"isBookPage":boolean,"rejectionReason":"string","summary":"string","mainIdeas":["string"],"detailedNotes":"string","keywords":["string"],"quotes":["string"],"sectionHeadings":["string"]}. ' +
                "Set isBookPage=true ONLY if this is clearly a readable book page with meaningful text. " +
                "If image is blank, blurry, random scene/object, handwriting-only, or non-book content, set isBookPage=false and fill rejectionReason with a short message; keep notes fields empty. " +
                "If isBookPage=true, mainIdeas must have 3-6 bullet points and summary under 60 words. " +
                "quotes: extract notable quotations actually visible on the page — text in quotation marks, block quotes, pull quotes, dialogue, epigraphs, or clearly set-off citations. " +
                "Each array item is one quote string (verbatim or lightly cleaned for OCR). If there are no quotes on the page, use quotes:[]. Do not invent quotes. " +
                "sectionHeadings: list every section/chapter/subsection heading visibly printed on the page (e.g. numbered headings like 1.2, bold or larger titles, running headers, sidebar section titles). " +
                "Preserve top-to-bottom reading order. One string per heading. If there are no such headings, use sectionHeadings:[]. Do not invent headings or repeat body text. " +
                "If isBookPage=false, use quotes:[] and sectionHeadings:[].",
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

  return {
    summary: parsed.summary ?? "",
    mainIdeas: parsed.mainIdeas ?? [],
    detailedNotes: parsed.detailedNotes ?? "",
    keywords: parsed.keywords ?? [],
    ...(quotes.length > 0 ? { quotes } : {}),
    ...(sectionHeadings.length > 0 ? { sectionHeadings } : {}),
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
