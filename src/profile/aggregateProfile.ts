import type { FrequencyItem, WriterProfile, WritingSession } from "../editor/eventTypes";
import { extractTextFeatures, median } from "./extractFeatures";

const average = (values: number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const weightedRate = (sessions: WritingSession[], getter: (session: WritingSession) => number): number => average(sessions.map(getter));
const histogram = (values: number[], bounds: number[]): number[] => bounds.map((upper, index) => values.filter((value) => value > (bounds[index - 1] ?? Number.NEGATIVE_INFINITY) && value <= upper).length);

function mergeFrequency(entries: Array<[string, number][]>, limit: number): FrequencyItem[] {
  const combined = new Map<string, number>();
  for (const list of entries) for (const [value, frequency] of list) combined.set(value, (combined.get(value) ?? 0) + frequency);
  return [...combined.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, frequency]) => ({ value, frequency }));
}

/**
 * Confidence is deterministic and intentionally conservative. Each dimension is
 * capped by the scarcest relevant signal; 100 requires 8 sessions, 4 task types,
 * 3,000 words, 6,000 events, and 100 revisions.
 */
export function calculateConfidence(sessions: WritingSession[]) {
  const words = sessions.reduce((sum, session) => sum + session.metrics.finalWordCount, 0);
  const events = sessions.reduce((sum, session) => sum + session.events.length, 0);
  const revisions = sessions.reduce((sum, session) => sum + session.metrics.revisionCount, 0);
  const diversity = new Set(sessions.map((session) => session.taskType)).size;
  const sessionScore = Math.min(1, sessions.length / 8);
  const diversityScore = Math.min(1, diversity / 4);
  const interaction = Math.round(100 * Math.min(sessionScore, Math.min(1, events / 6_000)));
  const linguistic = Math.round(100 * Math.min(sessionScore, Math.min(1, words / 3_000), diversityScore));
  const composition = Math.round(100 * Math.min(sessionScore, Math.min(1, revisions / 100), diversityScore));
  const overall = Math.round((interaction + linguistic + composition) / 3);
  return { overall, interaction, linguistic, composition, explanation: `Based on ${sessions.length}/8 sessions, ${words.toLocaleString()}/3,000 words, ${events.toLocaleString()}/6,000 events, ${revisions}/100 revisions, and ${diversity}/4 task types.` };
}

export function aggregateWriterProfile(sessions: WritingSession[], previous?: WriterProfile): WriterProfile {
  const now = new Date().toISOString();
  const textFeatures = sessions.map((session) => extractTextFeatures(session.finalDocument));
  const sentenceLengths = textFeatures.flatMap((feature) => feature.sentenceLengths);
  const paragraphLengths = textFeatures.flatMap((feature) => feature.paragraphLengths);
  const punctuationFrequency = textFeatures.reduce<Record<string, number>>((acc, feature) => {
    for (const [mark, frequency] of Object.entries(feature.punctuationFrequency)) acc[mark] = (acc[mark] ?? 0) + frequency;
    return acc;
  }, {});
  const intervals = sessions.map((session) => session.metrics.medianInterInputIntervalMs).filter(Boolean);
  const bursts = sessions.map((session) => session.metrics.medianBurstLength).filter(Boolean);
  const pauses = sessions.map((session) => session.metrics.medianPauseMs).filter(Boolean);
  const inserted = sessions.reduce((sum, session) => sum + session.metrics.totalCharactersInserted, 0);
  const deleted = sessions.reduce((sum, session) => sum + session.metrics.totalCharactersDeleted, 0);
  const replacements = sessions.reduce((sum, session) => sum + session.events.filter((event) => event.type === "replace").length, 0);
  const textEvents = sessions.reduce((sum, session) => sum + session.events.filter((event) => ["insert", "delete", "replace", "paste"].includes(event.type)).length, 0);
  return {
    version: (previous?.version ?? 0) + 1,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    sampleSessions: sessions.length,
    sampleWords: sessions.reduce((sum, session) => sum + session.metrics.finalWordCount, 0),
    sampleEvents: sessions.reduce((sum, session) => sum + session.events.length, 0),
    interaction: {
      medianInputIntervalMs: median(intervals), inputIntervalDistribution: histogram(intervals, [250, 500, 1_000, 2_000, Number.POSITIVE_INFINITY]),
      medianBurstLength: median(bursts), burstLengthDistribution: histogram(bursts, [5, 15, 30, 60, Number.POSITIVE_INFINITY]),
      medianPauseMs: median(pauses), pauseDistribution: sessions.reduce((acc, session) => session.metrics.pauseDistribution.map((bucket, index) => (acc[index] ?? 0) + bucket.count), [] as number[]),
      deletionRate: inserted ? deleted / inserted : 0,
      replacementRate: textEvents ? replacements / textEvents : 0,
      cursorReturnRate: textEvents ? sessions.reduce((sum, session) => sum + session.metrics.cursorReturnCount, 0) / textEvents : 0,
      selectionRate: textEvents ? sessions.reduce((sum, session) => sum + session.metrics.selectionCount, 0) / textEvents : 0,
      undoRate: textEvents ? sessions.reduce((sum, session) => sum + session.metrics.undoCount, 0) / textEvents : 0,
    },
    linguistic: {
      meanSentenceWords: average(sentenceLengths), sentenceLengthDistribution: histogram(sentenceLengths, [5, 10, 15, 25, Number.POSITIVE_INFINITY]),
      meanParagraphWords: average(paragraphLengths), paragraphLengthDistribution: histogram(paragraphLengths, [25, 50, 100, 200, Number.POSITIVE_INFINITY]),
      punctuationFrequency,
      commonWords: mergeFrequency(textFeatures.map((feature) => feature.words), 15),
      commonPhrases: mergeFrequency(textFeatures.map((feature) => feature.phrases), 10),
    },
    composition: {
      sentenceRevisionRate: weightedRate(sessions, (session) => session.metrics.sentenceCount ? session.metrics.revisionCount / session.metrics.sentenceCount : 0),
      paragraphRevisionRate: weightedRate(sessions, (session) => session.metrics.paragraphCount ? session.metrics.revisionCount / session.metrics.paragraphCount : 0),
      expansionRate: textEvents ? sessions.reduce((sum, session) => sum + session.events.filter((event) => event.type === "insert" && event.position < session.finalDocument.length).length, 0) / textEvents : 0,
      compressionRate: inserted ? deleted / inserted : 0,
      phraseReplacementRate: textEvents ? replacements / textEvents : 0,
    },
    confidence: calculateConfidence(sessions),
  };
}
