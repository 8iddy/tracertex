import { describe, expect, it } from "vitest";
import { MOVEMENT_WEIGHTS, STRUCTURAL_WEIGHTS, measureMovement, nearCopiedSentences } from "./styleMovement";

const SOURCE = "Post-harvest and agrifood technology commercialisation offers a near-term route from Nigerian research into market use. Nigerian research institutes have developed storage and processing technologies over several decades, but few of these technologies have reached farmers at scale. Both institutes hold portfolios of validated prototypes, including hermetic storage systems and solar dryers. The evidence suggests that losses for perishable crops may exceed 40% in some states.";

describe("movement model", () => {
  it("treats an identical rewrite and a one-phrase shuffle as too light", () => {
    expect(measureMovement(SOURCE, SOURCE)).toMatchObject({ movementScore: 0, sentenceRetention: 1, tooLight: true });
    const shuffled = SOURCE.replace("offers a near-term route from Nigerian research into market use", "offers a route from Nigerian research into market use in the near term");
    const depth = measureMovement(SOURCE, shuffled);
    expect(depth.exactSentenceRetention).toBe(.75);
    // The reshuffled sentence is not an exact match, but it is still a near copy.
    expect(depth.sentenceRetention).toBe(1);
    expect(depth.tooLight).toBe(true);
  });

  it("does not let the 75% retention boundary bypass the movement requirement", () => {
    const rewritten = SOURCE.replace("The evidence suggests that losses for perishable crops may exceed 40% in some states.", "In some states, according to the evidence, perishable crops may see losses above 40%.");
    const depth = measureMovement(SOURCE, rewritten);
    expect(depth.sentenceRetention).toBe(.75);
    expect(depth.tooLight).toBe(true);
    expect(depth.tooLightReasons).toContain("SOURCE_SENTENCES_RETAINED");
  });

  it("treats roughly 1% lexical movement with high sentence retention as too light", () => {
    const rewritten = SOURCE.replace("including hermetic", "such as hermetic");
    const depth = measureMovement(SOURCE, rewritten);
    expect(depth.lexicalChange).toBeLessThan(.06);
    expect(depth.sentenceRetention).toBeGreaterThanOrEqual(.75);
    expect(depth.tooLight).toBe(true);
  });

  it("lets substantial structural movement pass even when the vocabulary is kept", () => {
    const recast = "A near-term route from Nigerian research into market use is offered by post-harvest and agrifood technology commercialisation. Over several decades, Nigerian research institutes have developed storage and processing technologies. Few of these technologies have reached farmers at scale. Portfolios of validated prototypes, including hermetic storage systems and solar dryers, are held by both institutes. In some states, the evidence suggests, losses for perishable crops may exceed 40%.";
    const depth = measureMovement(SOURCE, recast);
    expect(depth.lexicalChange).toBeLessThan(.15);
    expect(depth.sentenceRetention).toBeLessThanOrEqual(.5);
    expect(depth.structuralScore).toBeGreaterThanOrEqual(.15);
    expect(depth.tooLight).toBe(false);
  });

  it("does not accept vocabulary swaps on an unchanged sentence frame", () => {
    const swapped = "Post-harvest and agrifood technology marketing provides a short-term path from Nigerian science into commercial use. Nigerian science centres have built storage and processing tools over many years, but few of these tools have reached growers at volume. Both centres hold collections of tested models, including sealed storage units and solar driers. The data suggests that losses for perishable produce may exceed 40% in some regions.";
    const depth = measureMovement(SOURCE, swapped);
    expect(depth.lexicalChange).toBeGreaterThan(.3);
    expect(depth.sentenceRetention).toBeGreaterThan(.5);
    expect(depth.tooLight).toBe(true);
  });

  it("keeps every dimension and the combined score inside 0–1", () => {
    const cases: Array<[string, string]> = [
      [SOURCE, ""], ["", SOURCE], [SOURCE, SOURCE],
      [SOURCE, "Completely unrelated words appear here in a single long sentence that shares nothing with the original text at all."],
      [SOURCE, SOURCE.split(". ").join(".\n\n")],
      ["One short line.", Array.from({ length: 40 }, (_, index) => `Paragraph number ${index} says something new.`).join("\n\n")],
    ];
    for (const [input, output] of cases) {
      const depth = measureMovement(input, output);
      for (const key of ["exactSentenceRetention", "sentenceRetention", "boundaryChange", "clauseOrderChange", "openingChange", "lexicalChange", "paragraphChange", "structuralScore", "movementScore"] as const) {
        expect(depth[key]).toBeGreaterThanOrEqual(0);
        expect(depth[key]).toBeLessThanOrEqual(1);
      }
    }
    expect(Object.values(MOVEMENT_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
    expect(Object.values(STRUCTURAL_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
  });

  it("bounds the paragraph contribution so re-paragraphing alone can never pass", () => {
    const reparagraphed = SOURCE.split(/(?<=\.)\s+/).join("\n\n");
    const depth = measureMovement(SOURCE, reparagraphed);
    expect(depth.paragraphChange).toBeLessThanOrEqual(1);
    expect(depth.movementScore).toBeLessThanOrEqual(MOVEMENT_WEIGHTS.paragraph);
    expect(depth.tooLight).toBe(true);
  });

  it("lists the sentences that are still near copies for the audit pass", () => {
    const partly = SOURCE.replace("The evidence suggests that losses for perishable crops may exceed 40% in some states.", "In some states, according to the evidence, perishable crops may see losses above 40%.");
    const copied = nearCopiedSentences(SOURCE, partly);
    expect(copied).toHaveLength(3);
    expect(copied.join(" ")).not.toContain("according to the evidence");
  });
});
