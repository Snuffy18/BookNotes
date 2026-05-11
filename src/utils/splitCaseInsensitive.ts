export type SplitPart = { hit: boolean; value: string };

export function splitCaseInsensitive(text: string, needle: string): SplitPart[] {
  if (!needle) return [{ hit: false, value: text }];
  const regex = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const raw = text.split(regex);
  const lowerNeedle = needle.toLowerCase();
  return raw.filter((s) => s !== "").map((s) => ({
    hit: s.toLowerCase() === lowerNeedle,
    value: s,
  }));
}
