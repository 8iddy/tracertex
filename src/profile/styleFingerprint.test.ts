import { describe, expect, it } from "vitest";
import type { WriterProfile, WritingSession } from "../editor/eventTypes";
import { buildStyleFingerprint, heuristicExemplarRetriever } from "./styleFingerprint";

const profile = { id: "profile", version: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01", sampleSessions: 4, sampleWords: 700, sampleEvents: 20, interaction: { medianInputIntervalMs: 0, inputIntervalDistribution: [], medianBurstLength: 0, burstLengthDistribution: [], medianPauseMs: 0, pauseDistribution: [], deletionRate: 0, replacementRate: 0, cursorReturnRate: 0, selectionRate: 0, undoRate: 0 }, linguistic: { meanSentenceWords: 15, sentenceLengthDistribution: [], meanParagraphWords: 70, paragraphLengthDistribution: [], punctuationFrequency: {}, commonWords: [], commonPhrases: [] }, composition: { sentenceRevisionRate: 0, paragraphRevisionRate: 0, expansionRate: 0, compressionRate: 0, phraseReplacementRate: 0 }, confidence: { overall: 37, interaction: 37, linguistic: 37, composition: 37, explanation: "Measured" } } satisfies WriterProfile;
const session = (id: string, taskType: WritingSession["taskType"], eligible = true): WritingSession => ({ id, promptId: id, prompt: "Prompt", taskType, startedAt: "2026-01-01", completedAt: "2026-01-01", startingDocument: "", finalDocument: `${"I explain this point with a careful example and because the evidence matters. ".repeat(8)}`, events: [], metrics: {} as WritingSession["metrics"], styleEligible: eligible });

describe("style fingerprint", () => {
  it("uses only genuine eligible calibration writing and selects excerpts", () => {
    const fingerprint = buildStyleFingerprint([session("a", "explanation"), session("fixture", "argument", false)], profile);
    expect(fingerprint.sourceSessionIds).toEqual(["a"]);
    expect(fingerprint.representativeExcerpts[0]?.sessionId).toBe("a");
  });
  it("versions fingerprints when new eligible writing arrives", () => {
    const first = buildStyleFingerprint([session("a", "explanation")], profile);
    const next = buildStyleFingerprint([session("a", "explanation"), session("b", "argument")], profile, first);
    expect(next.version).toBe(2);
    expect(next.sourceSessionIds).toContain("b");
  });
  it("retrieves genuine examples in a task/register-aware order", () => {
    const fingerprint = buildStyleFingerprint([session("explain", "explanation"), session("argue", "argument")], profile);
    expect(heuristicExemplarRetriever.retrieve("The policy should improve delivery.", fingerprint, 4)[0]?.taskType).toBe("argument");
  });
});
