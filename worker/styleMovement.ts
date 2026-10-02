/**
 * Transformation movement: how far the expression moved from the source,
 * independent of whether it moved toward the writer (that is style similarity)
 * and of whether it stayed faithful (that is validation).
 *
 * Every dimension is a ratio in [0, 1], so the combined score is in [0, 1]
 * and no single dimension can dominate it.
 */

const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;
const FUNCTION_WORDS = new Set("a an the this that these those of in on at for with by from to into onto over under about across between among through during within without and or but nor so yet if because although though while when where which who whom whose what as than then there here it its is are was were be been being has have had do does did will would shall should can could may might must not no also only both either neither each such their they them he she his her we our us you your i my me".split(" "));

export const movementTokens = (text: string): string[] => text.toLowerCase().match(TOKEN) ?? [];
export const movementSentences = (text: string): string[] => text.split(/(?<=[.!?]["'”’)]?)\s+|\n+/u).map((part) => part.trim()).filter((part) => movementTokens(part).length >= 3);
const contentTokens = (tokens: string[]) => tokens.filter((token) => !FUNCTION_WORDS.has(token));
/** Function words stay, content words collapse: synonym swaps leave the skeleton untouched. */
const skeleton = (tokens: string[]) => tokens.map((token) => FUNCTION_WORDS.has(token) ? token : "_");

function lcsLength(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  let previous = new Array<number>(b.length + 1).fill(0);
  for (const left of a) {
    const current = [0];
    for (let index = 0; index < b.length; index += 1) current.push(left === b[index] ? (previous[index] ?? 0) + 1 : Math.max(previous[index + 1] ?? 0, current[index] ?? 0));
    previous = current;
  }
  return previous[b.length] ?? 0;
}
const similarity = (a: string[], b: string[]) => lcsLength(a, b) / Math.max(1, a.length, b.length);

export interface MovementMetrics {
  /** Share of source sentences that survive word-for-word. */
  exactSentenceRetention: number;
  /** Share of source sentences that survive as a near copy: the same word sequence or the same syntactic skeleton. */
  sentenceRetention: number;
  /** Share of source sentences no longer mapped one-to-one onto an output sentence of similar length (split or merged). */
  boundaryChange: number;
  /** How far shared content words were reordered inside matched sentences. */
  clauseOrderChange: number;
  /** Share of output sentences that do not open the way any source sentence opens. */
  openingChange: number;
  /** Change in content vocabulary (Jaccard distance over content-word types). */
  lexicalChange: number;
  /** Relative change in paragraph count; bounded, and deliberately the smallest weight. */
  paragraphChange: number;
  /** Boundary, clause-order and opening movement only: what vocabulary swaps cannot buy. */
  structuralScore: number;
  movementScore: number;
  tooLight: boolean;
  tooLightReasons: string[];
}

export const MOVEMENT_WEIGHTS = { sentenceRewrite: .3, clauseOrder: .2, boundary: .15, opening: .15, lexical: .15, paragraph: .05 } as const;
export const STRUCTURAL_WEIGHTS = { clauseOrder: .4, boundary: .3, opening: .3 } as const;
/** A sentence is a near copy when at least this share of its word sequence survives in order. */
export const NEAR_COPY_SIMILARITY = .7;
/** Same function-word frame around swapped content words. Checked only against the best word match, with some shared wording required, so unrelated sentences of similar shape do not count. */
export const SKELETON_COPY_SIMILARITY = .9;
const isSkeletonCopy = (sentence: string[], match: string[], wordSimilarity: number) => sentence.length >= 6 && wordSimilarity >= .35 && Math.abs(match.length - sentence.length) <= 2 && similarity(skeleton(sentence), skeleton(match)) >= SKELETON_COPY_SIMILARITY;
export const MOVEMENT_FLOOR = .3;
export const STRUCTURAL_FLOOR = .15;
export const MAX_SENTENCE_RETENTION = .5;
/** Movement at or above this level earns full ranking credit: more change is not better. */
export const SUFFICIENT_MOVEMENT = .6;

const ratio = (value: number) => Math.min(1, Math.max(0, value));

export function measureMovement(input: string, output: string): MovementMetrics {
  const source = movementSentences(input).map(movementTokens);
  const target = movementSentences(output).map(movementTokens);
  const targetKeys = new Set(target.map((tokens) => tokens.join(" ")));
  const matrix = source.map((sentence) => target.map((candidate) => similarity(sentence, candidate)));
  const best = (row: number[]) => row.reduce((bestIndex, value, index) => value > (row[bestIndex] ?? -1) ? index : bestIndex, 0);
  const bestSourceFor = target.map((_, column) => best(matrix.map((row) => row[column] ?? 0)));

  let exact = 0; let nearCopies = 0; let boundaryChanged = 0; let orderChange = 0;
  source.forEach((sentence, row) => {
    if (targetKeys.has(sentence.join(" "))) exact += 1;
    const scores = matrix[row] ?? [];
    const column = best(scores);
    const match = target[column];
    const wordCopy = (scores[column] ?? 0) >= NEAR_COPY_SIMILARITY;
    const skeletonCopy = Boolean(match) && isSkeletonCopy(sentence, match!, scores[column] ?? 0);
    if (wordCopy || skeletonCopy) nearCopies += 1;
    const oneToOne = Boolean(match) && bestSourceFor[column] === row && (scores[column] ?? 0) >= .3 && match!.length / sentence.length >= .75 && match!.length / sentence.length <= 1.34;
    if (!oneToOne) boundaryChanged += 1;
    if (match) {
      const matchContent = new Set(contentTokens(match)); const sentenceContent = new Set(contentTokens(sentence));
      const left = contentTokens(sentence).filter((token) => matchContent.has(token));
      const right = contentTokens(match).filter((token) => sentenceContent.has(token));
      if (left.length >= 3 && right.length >= 3) orderChange += 1 - similarity(left, right);
    }
  });
  const sourceCount = Math.max(1, source.length);
  const sourceOpenings = new Set(source.map((tokens) => tokens.slice(0, 2).join(" ")));
  const openingChange = target.length ? target.filter((tokens) => !sourceOpenings.has(tokens.slice(0, 2).join(" "))).length / target.length : 0;
  const sourceTypes = new Set(contentTokens(movementTokens(input))); const targetTypes = new Set(contentTokens(movementTokens(output)));
  const union = new Set([...sourceTypes, ...targetTypes]);
  const lexicalChange = 1 - [...sourceTypes].filter((token) => targetTypes.has(token)).length / Math.max(1, union.size);
  const paragraphs = (text: string) => text.split(/\n{2,}/).filter((part) => part.trim()).length;
  const sourceParagraphs = paragraphs(input); const targetParagraphs = paragraphs(output);

  const metrics = {
    exactSentenceRetention: ratio(exact / sourceCount),
    sentenceRetention: ratio(nearCopies / sourceCount),
    boundaryChange: ratio(boundaryChanged / sourceCount),
    clauseOrderChange: ratio(orderChange / sourceCount),
    openingChange: ratio(openingChange),
    lexicalChange: ratio(lexicalChange),
    paragraphChange: ratio(Math.abs(sourceParagraphs - targetParagraphs) / Math.max(1, sourceParagraphs, targetParagraphs)),
  };
  const empty = target.length === 0 || source.length === 0;
  const structuralScore = empty ? 0 : ratio(STRUCTURAL_WEIGHTS.clauseOrder * metrics.clauseOrderChange + STRUCTURAL_WEIGHTS.boundary * metrics.boundaryChange + STRUCTURAL_WEIGHTS.opening * metrics.openingChange);
  const movementScore = empty ? 0 : ratio(MOVEMENT_WEIGHTS.sentenceRewrite * (1 - metrics.sentenceRetention) + MOVEMENT_WEIGHTS.clauseOrder * metrics.clauseOrderChange + MOVEMENT_WEIGHTS.boundary * metrics.boundaryChange + MOVEMENT_WEIGHTS.opening * metrics.openingChange + MOVEMENT_WEIGHTS.lexical * metrics.lexicalChange + MOVEMENT_WEIGHTS.paragraph * metrics.paragraphChange);
  // Three independent floors. A rewrite has to clear all of them, so neither
  // vocabulary swaps alone nor a single reshuffled sentence can pass.
  const tooLightReasons = [
    movementScore < MOVEMENT_FLOOR ? "LOW_MOVEMENT" : undefined,
    structuralScore < STRUCTURAL_FLOOR ? "LOW_STRUCTURAL_MOVEMENT" : undefined,
    metrics.sentenceRetention > MAX_SENTENCE_RETENTION ? "SOURCE_SENTENCES_RETAINED" : undefined,
  ].filter((reason): reason is string => Boolean(reason));
  return { ...metrics, structuralScore, movementScore, tooLight: tooLightReasons.length > 0, tooLightReasons };
}

/** First words of output sentences that are still near copies of a source sentence. Prompt-only; never logged. */
export function nearCopiedSentences(input: string, output: string): string[] {
  const source = movementSentences(input).map(movementTokens);
  return movementSentences(output).filter((sentence) => {
    const tokens = movementTokens(sentence);
    return source.some((candidate) => { const score = similarity(candidate, tokens); return score >= NEAR_COPY_SIMILARITY || isSkeletonCopy(candidate, tokens, score); });
  });
}
