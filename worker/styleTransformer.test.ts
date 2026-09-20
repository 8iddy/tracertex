import { describe, expect, it, vi } from "vitest";
import type { WriterProfile } from "../src/editor/eventTypes";
import { buildStylePrompt, transformWithProfile } from "./styleTransformer";

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
    expect(prompt).toContain("12.5 words");
    expect(prompt).toContain("plainly (4)");
    expect(prompt).toContain("in practice (3)");
    expect(prompt).toContain("Preserve meaning, claims, numbers, percentages, dates");
    expect(prompt).toContain("confidence is informational");
  });

  it("returns the model text and strips an accidental fence", async () => {
    const ai = { run: vi.fn().mockResolvedValue({ choices: [{ message: { content: "```text\nStyled draft.\n```" } }] }) } as unknown as Ai;
    await expect(transformWithProfile(ai, "Draft.", profile)).resolves.toBe("Styled draft.");
  });
});
