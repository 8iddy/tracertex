import { describe, expect, it } from "vitest";
import type { WriterProfile, WritingSession } from "../editor/eventTypes";
import { buildRhythmProfile, openingType } from "./rhythm";
import { buildStyleFingerprint, excerptFrom, heuristicExemplarRetriever, rhythmSourceTexts } from "./styleFingerprint";

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
  it("keeps punctuation and sentence boundaries in exemplars", () => {
    const text = "A budget is not a list of what you want to spend. It is a decision about what matters, made before the money arrives. When a household writes one down, three things usually happen: the fixed costs become visible, the small leaks become visible, and the argument finally has something concrete to point at. Most people skip the second step.";
    const excerpt = excerptFrom(text);
    expect(excerpt).toContain("spend. It is a decision about what matters, made before");
    expect(excerpt).toContain("happen: the fixed costs");
    expect(excerptFrom(`${text} ${text} ${text}`, 60).split(/\s+/).length).toBeLessThanOrEqual(70);
  });
  it("orders exemplars for a formal draft and leaves the personal sample out when others exist", () => {
    const fingerprint = buildStyleFingerprint([session("personal", "personal"), session("revise", "revision"), session("explain", "explanation"), session("argue", "argument")], profile);
    const formal = heuristicExemplarRetriever.retrieve("The policy should therefore improve delivery.", fingerprint, 4).map((item) => item.taskType);
    expect(formal).toEqual(["argument", "explanation", "revision"]);
    expect(heuristicExemplarRetriever.retrieve("Yesterday I felt tired and my day went slowly.", fingerprint, 4)[0]?.taskType).toBe("personal");
    const thin = buildStyleFingerprint([session("personal", "personal"), session("argue", "argument")], profile);
    expect(heuristicExemplarRetriever.retrieve("The policy should improve delivery.", thin, 4).map((item) => item.taskType)).toEqual(["argument", "personal"]);
  });
  it("measures actionable sentence rhythm from genuine writing only", () => {
    const authored = "Short claim. This second sentence is a good deal longer and carries a subordinate clause, because the writer chains ideas. When pressed, the writer opens with a clause. However, connectives appear too. In practice the lengths vary widely from one sentence to the next, which is the point; nothing settles.";
    const rhythm = buildRhythmProfile([authored]);
    expect(rhythm.sentenceCount).toBe(5);
    expect(rhythm.lengthQuantiles.p10).toBeLessThan(rhythm.lengthQuantiles.p90);
    expect(rhythm.shortSentenceShare).toBeCloseTo(.6);
    expect(rhythm.adjacentLengthDelta).toBeGreaterThan(5);
    expect(rhythm.openingTypes).toMatchObject({ subordinate: .2, connective: .2, prepositional: .2 });
    expect(rhythm.marksPer100Words.semicolon).toBeGreaterThan(0);
    expect(openingType("Nothing else is funded.")).toBe("subject");
    expect(openingType("Building on this, the group met.")).toBe("participial");
    const fingerprint = buildStyleFingerprint([session("a", "explanation"), session("fixture", "argument", false)], profile);
    expect(fingerprint.statistics.rhythm?.sentenceCount).toBe(8);
    // Revision tasks begin from supplied prose, so they inform rhythm only as a last resort.
    const withRevision = [session("a", "explanation"), session("b", "argument"), { ...session("r", "revision"), finalDocument: "Supplied passage text that the writer only edited lightly." }];
    expect(rhythmSourceTexts(withRevision)).toHaveLength(2);
    expect(rhythmSourceTexts([withRevision[2]!])).toHaveLength(1);
  });
});
