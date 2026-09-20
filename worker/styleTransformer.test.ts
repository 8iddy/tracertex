import { describe, expect, it, vi } from "vitest";
import type { WriterProfile } from "../src/editor/eventTypes";
import { buildStylePrompt, parseCandidates, rankCandidates, transformationDepth, transformWithProfile, writerProfileToStyleContext } from "./styleTransformer";

const profile = {
  version: 2, createdAt: "2026-01-01", updatedAt: "2026-01-02", sampleSessions: 4, sampleWords: 500, sampleEvents: 900,
  interaction: { medianInputIntervalMs: 100, inputIntervalDistribution: [], medianBurstLength: 5, burstLengthDistribution: [], medianPauseMs: 200, pauseDistribution: [], deletionRate: .1, replacementRate: .1, cursorReturnRate: .1, selectionRate: .1, undoRate: .1 },
  linguistic: { meanSentenceWords: 12.5, sentenceLengthDistribution: [1, 2, 3, 4, 5], meanParagraphWords: 54, paragraphLengthDistribution: [1, 2, 3, 4, 5], punctuationFrequency: { ",": 8 }, commonWords: [{ value: "plainly", frequency: 4 }], commonPhrases: [{ value: "in practice", frequency: 3 }] },
  composition: { sentenceRevisionRate: .2, paragraphRevisionRate: .1, expansionRate: .3, compressionRate: .15, phraseReplacementRate: .05 },
  confidence: { overall: 37, interaction: 40, linguistic: 37, composition: 34, explanation: "Measured" },
} satisfies WriterProfile;

describe("styleTransformer", () => {
  it("uses measured profile features without treating confidence as a gate", () => {
    const prompt = buildStylePrompt("Revenue rose 12% in 2025.", profile);
    expect(prompt).toContain("substantive style transfer");
    expect(prompt).toContain("plainly (4)");
    expect(prompt).toContain("in practice (3)");
    expect(prompt).toContain("Preserve meaning, claims, numbers, percentages, dates");
    expect(prompt).toContain("confidence is informational");
  });

  it("turns measurements into usable style direction", () => {
    const context = writerProfileToStyleContext(profile);
    expect(context).toContain("medium-length sentences");
    expect(context).toContain("compact paragraphs");
    expect(context).toContain("never prevents a substantive rewrite");
  });

  it("parses multiple candidates and returns the safest ranked rewrite", async () => {
    const ai = { run: vi.fn().mockResolvedValue({ choices: [{ message: { content: "```json\n{\"candidates\":[\"Revenue rose 12% in 2025, and the result was clear.\",\"In 2025, revenue rose by 12%; the outcome was clear.\"]}\n```" } }] }) } as unknown as Ai;
    const result = await transformWithProfile(ai, "Revenue rose 12% in 2025.", profile);
    expect(result.transformed).toContain("12%");
    expect(result.scores).toHaveLength(2);
  });

  it("accepts object candidates and falls back once from malformed structured output", async () => {
    expect(parseCandidates('{"candidates":[{"id":"a","text":"One."},{"id":"b","text":"Two."}]}')).toEqual(["One.", "Two."]);
    const ai = { run: vi.fn().mockResolvedValueOnce({ choices: [{ message: { content: "not-json" } }] }).mockResolvedValueOnce({ choices: [{ message: { content: "{\"candidates\":[{\"id\":\"a\",\"text\":\"Revenue rose 12% in 2025, with a clear result.\"}]}" } }] }) } as unknown as Ai;
    await expect(transformWithProfile(ai, "Revenue rose 12% in 2025.", profile)).resolves.toMatchObject({ retried: false });
  });

  it("rejects broken factual candidates and detects a too-light rewrite", async () => {
    const scores = await rankCandidates("Revenue rose 12% in 2025.", ["Revenue rose 8% in 2025.", "In 2025, revenue rose by 12%."], undefined);
    expect(scores[0]?.valid).toBe(false);
    expect(scores[1]?.valid).toBe(true);
    expect(transformationDepth("One sentence. Another sentence.", "One sentence. Another sentence.").tooLight).toBe(true);
  });
});
