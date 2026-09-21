import { describe, expect, it, vi } from "vitest";
import type { WriterProfile } from "../src/editor/eventTypes";
import { buildStylePrompt, detectSourceRegister, parseCandidates, rankCandidates, splitDraftIntoSections, transformationDepth, transformWithProfile, writerProfileToStyleContext } from "./styleTransformer";

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
    expect(prompt).toContain("substantive section-level style transfer");
    expect(prompt).toContain("plainly (4)");
    expect(prompt).toContain("in practice (3)");
    expect(prompt).toContain("Preserve meaning, claims, numbers, percentages, dates");
    expect(prompt).toContain("confidence is informational");
    expect(prompt).toContain("Never introduce first-person perspective");
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
    expect(result.scores).toHaveLength(1);
    expect(result.diagnostics.sections[0]?.attempts[0]?.candidates).toHaveLength(2);
  });

  it("accepts object candidates and falls back once from malformed structured output", async () => {
    expect(parseCandidates('{"candidates":[{"id":"a","text":"One."},{"id":"b","text":"Two."}]}')).toEqual(["One.", "Two."]);
    const ai = { run: vi.fn().mockResolvedValueOnce({ choices: [{ message: { content: "not-json" } }] }).mockResolvedValueOnce({ choices: [{ message: { content: "{\"candidates\":[{\"id\":\"a\",\"text\":\"Revenue rose 12% in 2025, with a clear result.\"}]}" } }] }) } as unknown as Ai;
    await expect(transformWithProfile(ai, "Revenue rose 12% in 2025.", profile)).resolves.toMatchObject({ retried: false });
  });

  it("uses one candidate for a long draft to preserve the model output budget", async () => {
    const longDraft = `${"Revenue rose 12% in 2025. ".repeat(350)}`;
    const prompt = buildStylePrompt(longDraft, profile, undefined, false, 1);
    expect(prompt).toContain("exactly 1 genuinely different");
  });

  it("rejects broken factual candidates and detects a too-light rewrite", async () => {
    const scores = await rankCandidates("Revenue rose 12% in 2025.", ["Revenue rose 8% in 2025.", "In 2025, revenue rose by 12%."], undefined);
    expect(scores[0]?.valid).toBe(false);
    expect(scores[1]?.valid).toBe(true);
    expect(transformationDepth("One sentence. Another sentence.", "One sentence. Another sentence.").tooLight).toBe(true);
  });

  it("normalizes movement signals and catches the 75-percent boundary", () => {
    const depth = transformationDepth("One sentence has several stable words. Two sentence has several stable words. Three sentence has several stable words. Four sentence has several stable words.", "One sentence has several stable words. Two sentence has several stable words. Three sentence has several stable words. Several stable words four sentence has.");
    expect(depth.unchangedSentenceRatio).toBe(.75);
    expect(depth.paragraphRestructure).toBeGreaterThanOrEqual(0);
    expect(depth.paragraphRestructure).toBeLessThanOrEqual(1);
    expect(depth.clauseOrderChange).toBeGreaterThanOrEqual(0);
    expect(depth.movementScore).toBeGreaterThanOrEqual(0);
    expect(depth.movementScore).toBeLessThanOrEqual(1);
    expect(depth.tooLight).toBe(true);
  });

  it("splits long drafts at natural headings and preserves reference sections", () => {
    const sections = splitDraftIntoSections("1. Opportunity areas\n\nFirst section body with enough words to transform safely and clearly.\n\n2. Partners and why\n\nSecond section body with enough words to transform safely and clearly.\n\nReferences\n\nUK Government. (2024). Report.", 250);
    expect(sections).toHaveLength(3);
    expect(sections.map((section) => section.heading)).toEqual(["1. Opportunity areas", "2. Partners and why", "References"]);
    expect(sections[2]?.preserve).toBe(true);
  });

  it("reports semantic marker changes without rejecting a fact-safe rewrite", async () => {
    const [score] = await rankCandidates(
      "Revenue may rise 12% in 2025.",
      ["In 2025, revenue could increase by 12%."],
      undefined,
    );
    expect(score?.valid).toBe(true);
    expect(score?.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("certainty"),
      expect.stringContaining("direction"),
    ]));
  });

  it("preserves source register and blocks newly introduced first-person stance", async () => {
    const formalDraft = "The policy assessment therefore recommends targeted implementation. Evidence from the programme supports this recommendation.";
    expect(detectSourceRegister(formalDraft)).toBe("formal");
    expect(buildStylePrompt(formalDraft, profile)).toContain("FORMAL:");
    const [score] = await rankCandidates(formalDraft, ["I think the policy assessment recommends targeted implementation. My experience says the programme evidence supports it."], undefined);
    expect(score?.valid).toBe(false);
    expect(score?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("first-person")]));
  });

  it("blocks changed epistemic strength and penalizes mechanical fluency defects", async () => {
    const [stance] = await rankCandidates("Digital sensing should be used only if evidence supports it.", ["Digital sensing might be used only if evidence supports it."], undefined);
    expect(stance?.valid).toBe(false);
    expect(stance?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("epistemic stance")]));

    const [fluent, clumsy] = await rankCandidates("Teams coordinate systems.", ["Teams coordinate systems.", "Teams coordinate systems and partners and vendors and policymakers havent aligned."], undefined);
    expect(clumsy!.fluency).toBeLessThan(fluent!.fluency);
    expect(clumsy?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("apostrophe"), expect.stringContaining("conjunctions")]));
  });

  it("records privacy-safe initial and retry diagnostics without candidate text", async () => {
    const ai = { run: vi.fn()
      .mockResolvedValueOnce({ response: '{"candidates":[{"text":"I think revenue rose 12% in 2025."}]}' })
      .mockResolvedValueOnce({ response: '{"candidates":[{"text":"In 2025, revenue rose by 12%, showing a clear result."}]}' }) } as unknown as Ai;
    const result = await transformWithProfile(ai, "Revenue rose 12% in 2025.", profile);
    expect(result.retried).toBe(true);
    expect(result.diagnostics.sections[0]?.retryReasons).toContain("VALIDATION_FAILED");
    expect(result.diagnostics.sections[0]?.attempts.map((attempt) => attempt.attempt)).toEqual(["initial", "retry"]);
    expect(JSON.stringify(result.diagnostics)).not.toContain("revenue rose");
    expect(result.diagnostics.sections[0]?.attempts[0]?.candidates[0]?.diagnostics.registerViolations).toBe(1);
  });
});
