import type { PauseBucket, PauseContextCounts, SessionMetrics, WritingEvent } from "../editor/eventTypes";

export const DEFAULT_BURST_THRESHOLD_MS = 2_000;

const mean = (values: number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
export const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
const words = (text: string): string[] => text.trim().match(/[\p{L}\p{N}'’-]+/gu) ?? [];
export const sentences = (text: string): string[] => text.split(/(?<=[.!?])(?:["'”’])?\s+|\n+/u).map((part) => part.trim()).filter(Boolean);
export const paragraphs = (text: string): string[] => text.split(/\n+/).map((part) => part.trim()).filter(Boolean);

function mutationSize(event: WritingEvent): number {
  if (event.type === "insert" || event.type === "paste") return event.text.length;
  if (event.type === "replace") return event.insertedText.length;
  return 0;
}

function pauseBucket(interval: number): PauseBucket["label"] {
  if (interval < 500) return "< 500 ms";
  if (interval < 1_000) return "500 ms–1 s";
  if (interval < 2_000) return "1–2 s";
  if (interval < 5_000) return "2–5 s";
  if (interval < 10_000) return "5–10 s";
  return "> 10 s";
}

function classifyPauseContext(document: string, position: number, counts: PauseContextCounts): void {
  const previous = document[position - 1] ?? "";
  if (previous === "\n") counts.paragraphBoundary += 1;
  else if (/[.!?]/.test(previous)) counts.sentenceBoundary += 1;
  else if (previous === ",") counts.afterComma += 1;
  else if (/[:;—–-]/.test(previous)) counts.afterPunctuation += 1;
  else if (/\s/.test(previous)) counts.betweenWords += 1;
  else counts.insideWord += 1;
}

export function calculateSessionMetrics(events: WritingEvent[], finalDocument: string, burstThresholdMs = DEFAULT_BURST_THRESHOLD_MS): SessionMetrics {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const textEvents = ordered.filter((event) => event.type === "insert" || event.type === "delete" || event.type === "replace" || event.type === "paste");
  const intervals = textEvents.slice(1).map((event, index) => event.timestamp - (textEvents[index]?.timestamp ?? event.timestamp)).filter((value) => value >= 0);
  const pauses = intervals.filter((value) => value > burstThresholdMs);
  const burstLengths: number[] = [];
  let currentBurst = 0;
  textEvents.forEach((event, index) => {
    if (index > 0 && event.timestamp - (textEvents[index - 1]?.timestamp ?? 0) > burstThresholdMs) {
      if (currentBurst) burstLengths.push(currentBurst);
      currentBurst = 0;
    }
    currentBurst += mutationSize(event);
  });
  if (currentBurst) burstLengths.push(currentBurst);

  const pauseLabels: PauseBucket["label"][] = ["< 500 ms", "500 ms–1 s", "1–2 s", "2–5 s", "5–10 s", "> 10 s"];
  const pauseDistribution = pauseLabels.map((label) => ({ label, count: intervals.filter((value) => pauseBucket(value) === label).length }));
  const pauseContexts: PauseContextCounts = { insideWord: 0, betweenWords: 0, afterComma: 0, afterPunctuation: 0, sentenceBoundary: 0, paragraphBoundary: 0 };
  textEvents.slice(1).forEach((event, index) => {
    if ((intervals[index] ?? 0) >= 500 && "position" in event) classifyPauseContext(finalDocument, event.position, pauseContexts);
  });

  const inserted = textEvents.reduce((sum, event) => sum + mutationSize(event), 0);
  const deleted = textEvents.reduce((sum, event) => sum + (event.type === "delete" ? event.text.length : event.type === "replace" ? event.removedText.length : 0), 0);
  const sentenceParts = sentences(finalDocument);
  const paragraphParts = paragraphs(finalDocument);
  const finalWords = words(finalDocument).length;
  const replacementCount = textEvents.filter((event) => event.type === "replace").length;
  return {
    durationMs: ordered.at(-1)?.timestamp ?? 0,
    totalCharactersInserted: inserted,
    totalCharactersDeleted: deleted,
    finalCharacterCount: finalDocument.length,
    finalWordCount: finalWords,
    meanInterInputIntervalMs: mean(intervals),
    medianInterInputIntervalMs: median(intervals),
    meanBurstLength: mean(burstLengths),
    medianBurstLength: median(burstLengths),
    meanPauseMs: mean(pauses),
    medianPauseMs: median(pauses),
    pauseDistribution,
    pauseContexts,
    deletionRate: inserted ? deleted / inserted : 0,
    replacementRate: textEvents.length ? replacementCount / textEvents.length : 0,
    cursorReturnCount: ordered.filter((event) => event.type === "cursor" && event.position < finalDocument.length).length,
    selectionCount: ordered.filter((event) => event.type === "selection").length,
    undoCount: ordered.filter((event) => event.type === "undo").length,
    redoCount: ordered.filter((event) => event.type === "redo").length,
    sentenceCount: sentenceParts.length,
    paragraphCount: paragraphParts.length,
    meanSentenceWords: mean(sentenceParts.map((sentence) => words(sentence).length)),
    meanParagraphWords: mean(paragraphParts.map((paragraph) => words(paragraph).length)),
    revisionCount: replacementCount + textEvents.filter((event) => event.type === "delete").length,
  };
}

export function extractTextFeatures(text: string) {
  const sentenceLengths = sentences(text).map((sentence) => words(sentence).length);
  const paragraphLengths = paragraphs(text).map((paragraph) => words(paragraph).length);
  const punctuationFrequency: Record<string, number> = {};
  for (const mark of text.match(/[.,;:!?—–()]/g) ?? []) punctuationFrequency[mark] = (punctuationFrequency[mark] ?? 0) + 1;
  const normalizedWords = words(text.toLowerCase()).filter((word) => word.length > 2);
  const count = (items: string[]) => Object.entries(items.reduce<Record<string, number>>((acc, item) => { acc[item] = (acc[item] ?? 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1]);
  const phrases = normalizedWords.slice(0, -1).map((word, index) => `${word} ${normalizedWords[index + 1] ?? ""}`);
  return { sentenceLengths, paragraphLengths, punctuationFrequency, words: count(normalizedWords), phrases: count(phrases) };
}
