import { describe, expect, it } from "vitest";
import { compareProtectedFacts } from "./compareProtectedFacts";

describe("protected fact comparison", () => {
  it("flags a changed percentage", () => {
    const result = compareProtectedFacts("The intervention reduced stockouts by 38% in 2026.", "The intervention reduced stockouts by 35% in 2026.");
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "percentage", input: "38%", output: "35%" })]));
  });
  it("flags a missing citation", () => {
    const result = compareProtectedFacts("The result was robust (Abako et al., 2026).", "The result was robust.");
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ type: "citation", kind: "missing" })]));
  });
});
