import { describe, expect, it } from "vitest";
import { assessSafety, buildContentLedger, extractProtectedTerms, missingProtectedTerms } from "./styleGuards";
import { repairBySentenceReversion } from "./styleRepair";

const valid = (input: string, output: string) => assessSafety(input, output).valid;

describe("semantic and register safety", () => {
  it("rejects first-person voice that the source does not have", () => {
    const report = assessSafety("The assessment recommends targeted implementation.", "I think the assessment recommends targeted implementation.");
    expect(report.valid).toBe(false);
    expect(report.registerViolations).toBe(1);
  });

  it("rejects strengthened certainty", () => {
    expect(valid("Digital sensing should be used where evidence supports it.", "Digital sensing must be used where evidence supports it.")).toBe(false);
    expect(valid("Losses may exceed 40% in some states.", "Losses will exceed 40% in some states.")).toBe(false);
    expect(valid("The demonstrator would take three technologies to market.", "The demonstrator will take three technologies to market.")).toBe(false);
    expect(valid("Manufacturers are needed to produce equipment at an affordable price.", "Manufacturers must produce equipment at an affordable price.")).toBe(false);
  });

  it("rejects materially weakened certainty", () => {
    expect(valid("Digital sensing should be used where evidence supports it.", "Digital sensing might be used where evidence supports it.")).toBe(false);
    expect(valid("Applications must be submitted by month 10.", "Applications could be submitted by month 10.")).toBe(false);
    expect(valid("The programme funds three trials.", "The programme may fund three trials.")).toBe(false);
  });

  it("accepts a repeated modal when a sentence is split, and a modal of the same strength", () => {
    expect(valid("These indicators should be tracked but should not be used to judge early performance.", "These indicators should be tracked. They should not be used to judge early performance.")).toBe(true);
    expect(valid("Budget lines should be held in a hard currency account and scheduled early.", "Budget lines should be held in a hard currency account. They should also be scheduled early.")).toBe(true);
    expect(valid("Revenue may rise 12% in 2025.", "In 2025, revenue could increase by 12%.")).toBe(true);
  });

  it("rejects a dropped negation, a weakened condition, an invented cause and a lost enumeration", () => {
    expect(valid("Technologies that do not pass this assessment should not proceed.", "Technologies that pass this assessment should proceed.")).toBe(false);
    expect(valid("It should be funded only if one manufacturer commits.", "It should be funded if one manufacturer commits.")).toBe(false);
    expect(valid("Candidate technologies are assessed in the selection phase, which starts in January.", "Candidate technologies are assessed because the selection phase starts in January.")).toBe(false);
    expect(valid("A second risk is that licensing arrangements remain unclear.", "Licensing arrangements remain unclear.")).toBe(false);
  });

  it("rejects an exchanged subject and object around the same verb", () => {
    const source = "Approximately 45% of this amount would support tooling and design work.";
    expect(valid(source, "Tooling and design work would support approximately 45% of this amount.")).toBe(false);
    expect(valid(source, "Tooling and design work would be supported by approximately 45% of this amount.")).toBe(true);
  });

  it("protects numbers, dates, currency, citations, URLs and proper names", () => {
    const source = "The Federal Ministry of Innovation, Science and Technology (FMIST) approved US$5 million on March 12, 2024 for 24 months (Adeyemi, 2023), covering 45% of costs. Details are at https://example.org/sta-s and were confirmed in Lagos.";
    const recast = "On March 12, 2024 the Federal Ministry of Innovation, Science and Technology (FMIST) approved US$5 million for 24 months, covering 45% of costs (Adeyemi, 2023). The details were confirmed in Lagos and are at https://example.org/sta-s.";
    expect(valid(source, recast)).toBe(true);
    for (const [from, to] of [["US$5 million", "US$6 million"], ["March 12, 2024", "March 21, 2024"], ["24 months", "18 months"], ["(Adeyemi, 2023)", "(Adeyemi, 2022)"], ["45%", "54%"], ["https://example.org/sta-s", "https://example.org/other"], ["Lagos", "Abuja"], ["(FMIST)", ""], ["Federal Ministry of Innovation", "federal ministry"]] as const) {
      expect(valid(source, recast.replace(from, to)), `${from} → ${to}`).toBe(false);
    }
  });

  it("extracts names and acronyms without treating sentence-initial words as names", () => {
    const terms = extractProtectedTerms("Three groups are needed. The Standards Organisation of Nigeria (SON) certifies equipment in Kano, and STA-S funds R4D work.");
    expect(terms).toEqual(expect.arrayContaining(["Standards Organisation of Nigeria", "SON", "Kano", "STA-S", "R4D"]));
    expect(terms).not.toContain("Three");
    expect(missingProtectedTerms("Nigerian institutes hold the prototypes.", "The prototypes are held by institutes.")).toEqual([]);
    expect(missingProtectedTerms("The prototypes are held by Nigerian institutes.", "The prototypes are held by institutes.")).toEqual(["Nigerian"]);
  });

  it("rejects high lexical change that drifts away from the source's content", () => {
    const source = "Post-harvest technology commercialisation offers a near-term route from research into market use, because validated prototypes for storage and processing already exist in the institutes.";
    const drifted = "Farm innovation creates rapid pathways toward wider prosperity, since proven ideas about logistics and packaging are ready inside many organisations across the whole region today.";
    const report = assessSafety(source, drifted);
    expect(report.contentCoverage).toBeLessThan(.45);
    expect(report.valid).toBe(false);
  });

  it("turns the source's protected content into a ledger for the model", () => {
    const ledger = buildContentLedger("FMIST should fund the trial only if SON agrees by March 12, 2024, because US$5 million is not enough.");
    expect(ledger).toContain("US$5 million");
    expect(ledger).toContain("March 12, 2024");
    expect(ledger).toContain("FMIST | SON");
    expect(assessSafety("The budget is US$5 million.", "The budget is US$5 billion.").valid).toBe(false);
    expect(ledger).toContain("should ×1");
    expect(ledger).toContain("only");
    expect(ledger).toContain("1 in the source");
  });
});

describe("minimal reversion repair", () => {
  const source = "The demonstrator would take three validated technologies from prototype to certified product over 24 months. It should be funded only if at least one manufacturer commits to the work. Exchange rate volatility is a third risk, because imported components are priced in US dollars.";

  it("reverts only the sentence that changed a claim and keeps the rest of the recast", () => {
    const candidate = "Over 24 months, three validated technologies would be taken by the demonstrator from prototype to certified product. Funding should be provided if at least one manufacturer commits to the work. Because imported components are priced in US dollars, exchange rate volatility is a third risk.";
    expect(assessSafety(source, candidate).valid).toBe(false);
    const repaired = repairBySentenceReversion(source, candidate)!;
    expect(repaired.revertedSentences).toBe(1);
    expect(assessSafety(source, repaired.text).valid).toBe(true);
    expect(repaired.text).toContain("It should be funded only if at least one manufacturer commits to the work.");
    expect(repaired.text).toContain("Over 24 months, three validated technologies would be taken");
    expect(repaired.text).toContain("Because imported components are priced in US dollars");
  });

  it("returns nothing for a candidate that is already safe or cannot be saved in part", () => {
    expect(repairBySentenceReversion(source, source)).toBeUndefined();
    expect(repairBySentenceReversion("Losses may exceed 40%.", "Losses will exceed 50%.")).toBeUndefined();
  });
});
