export type EntityExtractionType =
  | "person"
  | "place"
  | "concept"
  | "work"
  | "organization"
  | "event";

export type ExistingEntitySeed = {
  id: string;
  canonical_name: string;
  type: EntityExtractionType;
  aliases?: string[];
};

export type EntityExtractionPromptInput = {
  book_metadata: {
    title?: string;
    author?: string;
    context?: string;
  };
  page_text: string;
  page_number: number;
  existing_entities?: ExistingEntitySeed[];
};

/**
 * Builds a strict entity-extraction prompt for page-level knowledge-graph output.
 */
export function buildEntityExtractionPrompt(input: EntityExtractionPromptInput): string {
  const existingEntitiesJson =
    input.existing_entities && input.existing_entities.length > 0
      ? JSON.stringify(input.existing_entities)
      : "[]";

  const bookMetadataJson = JSON.stringify(input.book_metadata ?? {});

  return (
    "You are an entity extraction and knowledge graph specialist analyzing pages from a book that a reader has photographed and saved as meaningful to them.\n\n" +
    "## Your Task\n\n" +
    "From the provided page text, extract structured entities and the relationships between them. Your output will be merged into a growing knowledge graph that spans the entire book, so consistency and precision matter more than verbosity.\n\n" +
    "## Input\n\n" +
    "You will receive:\n" +
    "- `book_metadata`: title, author, and any context about the book\n" +
    "- `page_text`: OCR'd text from one or more pages\n" +
    "- `page_number`: where this came from\n" +
    "- `existing_entities` (optional): entities already extracted from earlier pages, so you can reuse canonical names instead of creating duplicates\n\n" +
    "## Entity Types to Extract\n\n" +
    "1. **People** — real or fictional. Include role/description.\n" +
    "2. **Places** — geographic, fictional, or conceptual locations.\n" +
    "3. **Concepts** — ideas, theories, frameworks, terms of art the author uses or defines.\n" +
    "4. **Works** — books, papers, films, artworks, or media referenced.\n" +
    "5. **Organizations** — companies, institutions, movements, schools of thought.\n" +
    "6. **Events** — historical or narrative events named in the text.\n\n" +
    "## Extraction Rules\n\n" +
    "- Canonicalize names using `existing_entities` when possible; add surface forms as aliases.\n" +
    "- Skip trivial mentions unless they are meaningful to the argument.\n" +
    "- Extract concepts only when they are materially developed.\n" +
    "- Prefer paraphrase; direct quote only when exact wording materially matters.\n\n" +
    "## Relationships\n\n" +
    "For each meaningful entity pair on this page, emit a relationship with brief evidence.\n" +
    "Examples: influenced_by, critiques, extends, contradicts, authored, founded, member_of, located_in, occurred_at, example_of, instance_of, opposed_to, references.\n\n" +
    "## Output Format\n\n" +
    "Return strictly valid JSON with shape:\n" +
    "{\n" +
    '  "entities": [\n' +
    "    {\n" +
    '      "id": "kebab-case-canonical-id",\n' +
    '      "canonical_name": "Full Proper Name",\n' +
    '      "type": "person | place | concept | work | organization | event",\n' +
    '      "aliases": ["other names used on this page"],\n' +
    '      "description": "One-sentence paraphrased description grounded in this page or general knowledge.",\n' +
    '      "salience": "high | medium | low",\n' +
    '      "first_seen_page": <page_number>\n' +
    "    }\n" +
    "  ],\n" +
    '  "relationships": [\n' +
    "    {\n" +
    '      "source_id": "entity-id",\n' +
    '      "target_id": "entity-id",\n' +
    '      "type": "relationship_type",\n' +
    '      "evidence": "Paraphrased reason this relationship is on this page.",\n' +
    '      "page": <page_number>\n' +
    "    }\n" +
    "  ],\n" +
    '  "page_summary": "Two-sentence paraphrase of what this page is about, for graph navigation."\n' +
    "}\n\n" +
    "## Quality Bar\n\n" +
    "- Prefer fewer high-quality entities over shallow extraction.\n" +
    "- If page has no meaningful entities, return empty arrays and a summary.\n" +
    "- Never invent unsupported relationships.\n" +
    "- If OCR is uncertain, use low salience and note uncertainty in description.\n\n" +
    "Use the following input data:\n" +
    `book_metadata: ${bookMetadataJson}\n` +
    `page_number: ${input.page_number}\n` +
    `existing_entities: ${existingEntitiesJson}\n` +
    `page_text:\n${input.page_text}`
  );
}
