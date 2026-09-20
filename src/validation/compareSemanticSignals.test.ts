import { describe, expect, it } from "vitest";
import { compareSemanticSignals } from "./compareSemanticSignals";

describe("compareSemanticSignals", () => {
  it("flags removed negation and changed direction", () => {
    const warnings = compareSemanticSignals("The treatment did not decrease risk in adults.", "The treatment increased risk in adults.");
    expect(warnings.map((warning) => warning.category)).toEqual(expect.arrayContaining(["negation", "direction"]));
  });

  it("accepts unchanged semantic markers", () => {
    expect(compareSemanticSignals("It may increase risk compared with placebo in 2025.", "Compared with placebo, it may increase risk in 2025.")).toEqual([]);
  });
});
