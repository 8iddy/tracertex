import type { OpeningType, RhythmProfile } from "../editor/eventTypes";

/**
 * Sentence-architecture measurements. A mean sentence length cannot tell a
 * model how to build a sentence; a length range, the spread, how sentences
 * open and how clauses are joined can. Everything here is deterministic and
 * derived from text alone, so the same code describes the writer's genuine
 * calibration writing, a source passage and a candidate rewrite.
 */

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
export const rhythmWords = (text: string): string[] => text.match(WORD) ?? [];
export const rhythmSentences = (text: string): string[] => text.split(/(?<=[.!?]["'”’)]?)\s+|\n+/u).map((part) => part.trim()).filter((part) => rhythmWords(part).length >= 2);

export const SHORT_SENTENCE_WORDS = 8;
export const LONG_SENTENCE_WORDS = 28;

const FIRST_PERSON = new Set(["i", "we", "my", "our", "me", "us", "i'm", "i've", "i'd", "we're", "we've"]);
const CONNECTIVE = new Set(["however", "therefore", "moreover", "furthermore", "also", "then", "so", "and", "but", "yet", "still", "instead", "meanwhile", "finally", "first", "second", "third", "thus", "hence", "similarly", "additionally", "consequently", "nevertheless", "overall", "indeed", "equally", "accordingly", "otherwise"]);
const SUBORDINATE = new Set(["although", "though", "because", "since", "while", "when", "if", "as", "once", "unless", "whereas", "given", "after", "before", "where", "until", "whether", "even"]);
const PREPOSITIONAL = new Set(["in", "on", "at", "for", "with", "by", "from", "to", "under", "over", "across", "during", "within", "without", "through", "among", "between", "despite", "beyond", "alongside", "against", "towards", "toward", "of"]);

const NOT_PARTICIPLES = new Set(["nothing", "something", "anything", "everything", "morning", "evening", "spring", "string", "thing", "bring", "being"]);

export const OPENING_TYPES: OpeningType[] = ["subject", "firstPerson", "connective", "subordinate", "prepositional", "participial"];

export function openingType(sentence: string): OpeningType {
  const first = (rhythmWords(sentence)[0] ?? "").toLowerCase().replace("’", "'");
  if (FIRST_PERSON.has(first)) return "firstPerson";
  if (CONNECTIVE.has(first)) return "connective";
  if (SUBORDINATE.has(first)) return "subordinate";
  if (PREPOSITIONAL.has(first)) return "prepositional";
  if (first.length > 4 && first.endsWith("ing") && !NOT_PARTICIPLES.has(first)) return "participial";
  return "subject";
}

const quantile = (sorted: number[], q: number): number => {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q; const lower = Math.floor(position); const upper = Math.ceil(position);
  return Math.round((sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (position - lower));
};
const round = (value: number, places = 2) => Number(value.toFixed(places));

/** Each text is measured on its own so adjacency never crosses a document boundary. */
export function buildRhythmProfile(texts: string[]): RhythmProfile {
  const perText = texts.map((text) => rhythmSentences(text)).filter((list) => list.length > 0);
  const all = perText.flat();
  const lengths = all.map((sentence) => rhythmWords(sentence).length);
  const sorted = [...lengths].sort((a, b) => a - b);
  const count = Math.max(1, all.length);
  const mean = lengths.reduce((sum, value) => sum + value, 0) / count;
  const deltas = perText.flatMap((list) => list.slice(1).map((sentence, index) => Math.abs(rhythmWords(sentence).length - rhythmWords(list[index] ?? "").length)));
  const totalWords = Math.max(1, lengths.reduce((sum, value) => sum + value, 0));
  const corpus = all.join(" ");
  const marks = (pattern: RegExp) => round(100 * (corpus.match(pattern)?.length ?? 0) / totalWords);
  const openingTypes = Object.fromEntries(OPENING_TYPES.map((type) => [type, round(all.filter((sentence) => openingType(sentence) === type).length / count)])) as Record<OpeningType, number>;
  return {
    sentenceCount: all.length,
    lengthQuantiles: { p10: quantile(sorted, .1), p25: quantile(sorted, .25), p50: quantile(sorted, .5), p75: quantile(sorted, .75), p90: quantile(sorted, .9) },
    lengthStdDev: round(Math.sqrt(lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count), 1),
    shortSentenceShare: round(lengths.filter((value) => value <= SHORT_SENTENCE_WORDS).length / count),
    longSentenceShare: round(lengths.filter((value) => value >= LONG_SENTENCE_WORDS).length / count),
    adjacentLengthDelta: round(deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0, 1),
    openingTypes,
    commasPerSentence: round((corpus.match(/,/g)?.length ?? 0) / count),
    marksPer100Words: { semicolon: marks(/;/g), colon: marks(/:/g), dash: marks(/\s[—–-]\s|—/g), parenthesis: marks(/\(/g) },
    coordinatedSentenceShare: round(all.filter((sentence) => /,?\s(?:and|but|so|or|yet)\s/i.test(sentence.replace(/^\S+\s/, ""))).length / count),
    subordinatedSentenceShare: round(all.filter((sentence) => /\b(?:because|although|though|which|while|when|if|since|whereas|unless|so that)\b/i.test(sentence)).length / count),
  };
}
