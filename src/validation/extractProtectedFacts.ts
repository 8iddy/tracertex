export type ProtectedFactType = "number" | "percentage" | "currency" | "date" | "url" | "doi" | "citation" | "proper_noun" | "quote";
export interface ProtectedFact { type: ProtectedFactType; value: string; sourcePosition: number }

const patterns: Array<[ProtectedFactType, RegExp]> = [
  ["url", /https?:\/\/[^\s)\]}>,]+/gi],
  ["doi", /\b10\.\d{4,9}\/[\w.()/:;-]+/gi],
  ["percentage", /\b\d+(?:\.\d+)?\s*%/g],
  ["currency", /(?:[$€£¥]\s?\d[\d,.]*|\b(?:USD|EUR|GBP|UGX)\s?\d[\d,.]*)/g],
  ["date", /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/gi],
  ["citation", /\([A-Z][\p{L}'’-]+(?:\s+et al\.)?,?\s+\d{4}[a-z]?\)|\[[0-9,\s–-]+\]/gu],
  ["quote", /[“"]([^”"\n]{2,})[”"]/g],
  ["number", /(?<![%\w])\d+(?:\.\d+)?(?![%\w])/g],
];

export function extractProtectedFacts(text: string): ProtectedFact[] {
  const facts: ProtectedFact[] = [];
  const occupied: Array<[number, number]> = [];
  for (const [type, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const value = match[0];
      if (occupied.some(([start, end]) => index >= start && index < end)) continue;
      facts.push({ type, value, sourcePosition: index });
      occupied.push([index, index + value.length]);
    }
  }
  return facts.sort((a, b) => a.sourcePosition - b.sourcePosition);
}
