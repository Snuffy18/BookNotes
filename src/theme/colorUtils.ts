function parseHex6(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "");
  if (normalized.length !== 6) {
    return null;
  }
  const n = parseInt(normalized, 16);
  if (Number.isNaN(n)) {
    return null;
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Linear blend between two #RRGGBB colors. `t` = 0 → `colorA`, `t` = 1 → `colorB`. */
export function mixHex(colorA: string, colorB: string, t: number): string {
  const a = parseHex6(colorA);
  const b = parseHex6(colorB);
  if (!a || !b) {
    return colorA;
  }
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const bl = Math.round(a.b + (b.b - a.b) * u);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

/** Appends alpha to #RRGGBB for use in React Native colors. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.trim().replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${normalized}${a}`;
}
