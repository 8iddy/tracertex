import type { StyleFingerprint, WriterProfile, WritingSession } from "../editor/eventTypes";
import { extractTextFeatures, paragraphs, sentences } from "./extractFeatures";

const WORD = /[\p{L}\p{N}'’-]+/gu;
const words = (text: string) => text.match(WORD) ?? [];
const countTerms = (text: string, terms: string[]) => Object.fromEntries(terms.map((term) => [term, (text.match(new RegExp(`\\b${term}\\b`, "giu")) ?? []).length]).filter(([, count]) => count));
const top = (items: Array<[string, number]>, limit: number) => items.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value]) => value);
const transitions = ["however", "therefore", "moreover", "instead", "for example", "for instance", "meanwhile", "although", "because", "while", "first", "finally"];
const hedges = ["may", "might", "could", "likely", "possibly", "perhaps", "generally", "often", "typically", "suggests"];
const functionWords = ["and", "but", "or", "so", "because", "although", "while", "however", "that", "which", "with", "for", "from", "into", "this", "these"];

export interface ExemplarRetriever {
  retrieve(draft: string, fingerprint: StyleFingerprint, limit: number): StyleFingerprint["representativeExcerpts"];
}

const registerFor = (draft: string): string[] => {
  const lower = draft.toLowerCase();
  if (/\b(should|recommend|policy|therefore|must)\b/.test(lower)) return ["argument", "explanation"];
  if (/\b(i |my |me |yesterday|felt)\b/.test(lower)) return ["personal"];
  if (/\b(how|why|process|system|explain)\b/.test(lower)) return ["explanation", "argument"];
  return ["argument", "explanation", "personal", "revision"];
};

/** Lightweight retrieval; an embedding retriever can later implement this interface. */
export const heuristicExemplarRetriever: ExemplarRetriever = {
  retrieve(draft, fingerprint, limit) {
    const preferred = registerFor(draft);
    return [...fingerprint.representativeExcerpts].sort((a, b) => preferred.indexOf(a.taskType) - preferred.indexOf(b.taskType)).slice(0, Math.min(6, Math.max(3, limit)));
  },
};

export function selectRepresentativeExcerpts(sessions: WritingSession[]): StyleFingerprint["representativeExcerpts"] {
  const selected: StyleFingerprint["representativeExcerpts"] = [];
  const usedTypes = new Set<string>();
  for (const session of sessions.sort((a, b) => b.completedAt.localeCompare(a.completedAt))) {
    if (usedTypes.has(session.taskType)) continue;
    const text = session.finalDocument.trim();
    const excerpt = paragraphs(text).find((part) => words(part).length >= 50) ?? text;
    const excerptWords = words(excerpt);
    if (excerptWords.length < 30) continue;
    selected.push({ sessionId: session.id, taskType: session.taskType, text: excerptWords.slice(0, 120).join(" ") });
    usedTypes.add(session.taskType);
    if (selected.length === 6) break;
  }
  return selected;
}

export function buildStyleFingerprint(sessions: WritingSession[], profile: WriterProfile, previous?: StyleFingerprint): StyleFingerprint {
  const eligible = sessions.filter((session) => session.styleEligible !== false && session.finalDocument.trim().length > 0);
  const corpus = eligible.map((session) => session.finalDocument).join("\n\n");
  const features = extractTextFeatures(corpus);
  const opens = sentences(corpus).map((sentence) => words(sentence).slice(0, 3).join(" ").toLowerCase()).filter(Boolean);
  const phrases = top(features.phrases, 18);
  const excerpts = selectRepresentativeExcerpts(eligible);
  const sourceWordCount = words(corpus).length;
  const evidence = Math.min(100, Math.round(sourceWordCount / 8));
  const exemplarConfidence = Math.min(100, excerpts.length * 20);
  return {
    writerProfileId: profile.id,
    version: (previous?.version ?? 0) + 1,
    createdAt: previous?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(),
    sourceSessionIds: eligible.map((session) => session.id), sourceWordCount,
    statistics: {
      meanSentenceWords: profile.linguistic.meanSentenceWords, sentenceLengthDistribution: profile.linguistic.sentenceLengthDistribution,
      meanParagraphWords: profile.linguistic.meanParagraphWords, paragraphLengthDistribution: profile.linguistic.paragraphLengthDistribution,
      punctuationFrequency: features.punctuationFrequency, transitionFrequency: countTerms(corpus, transitions), hedgeFrequency: countTerms(corpus, hedges), functionWordFrequency: countTerms(corpus, functionWords),
      sentenceOpeningPatterns: top([...new Map(opens.map((item) => [item, opens.filter((candidate) => candidate === item).length])).entries()], 8), commonPhrases: phrases,
    },
    rhetoricalPatterns: { sentenceConstruction: [], paragraphMovement: [], qualificationPatterns: [], argumentPatterns: [], transitionPatterns: [], lexicalPreferences: [], avoidedPatterns: [] },
    representativeExcerpts: excerpts,
    confidence: { statistics: evidence, rhetoricalPatterns: 0, exemplars: exemplarConfidence, overall: Math.round((evidence + exemplarConfidence) / 2) },
  };
}
