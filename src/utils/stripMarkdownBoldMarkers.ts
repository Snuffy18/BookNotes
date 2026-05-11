export function stripMarkdownBoldMarkers(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
}
