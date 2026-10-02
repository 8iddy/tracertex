import { afterEach, describe, expect, it, vi } from "vitest";
import type { StyleFingerprint, WriterProfile, WritingSession } from "../src/editor/eventTypes";
import { buildStyleFingerprint } from "../src/profile/styleFingerprint";
import { BRIEFING_BENCHMARK, BRIEFING_BENCHMARK_RECORDED_OUTPUT, SYNTHETIC_CALIBRATION } from "./fixtures/briefingBenchmark";
import { architectureBrief, buildSentenceRecastPrompt, parseNumberedSentences, passageBrief, rhythmFor } from "./stylePrompts";
import { type CandidateScore, auditFindings, buildStructuralPrompt, buildVoicePrompt, cleanModelText, detectSourceRegister, deterministicStyleScorer, measureMovement, parseCandidates, rankCandidates, selectFromPool, spliceRecastSentences, splitDraftIntoSections, transformationDepth, transformWithProfile, writerProfileToStyleContext } from "./styleTransformer";

const profile = {
  version: 2, createdAt: "2026-01-01", updatedAt: "2026-01-02", sampleSessions: 4, sampleWords: 500, sampleEvents: 900,
  interaction: { medianInputIntervalMs: 100, inputIntervalDistribution: [], medianBurstLength: 5, burstLengthDistribution: [], medianPauseMs: 200, pauseDistribution: [], deletionRate: .1, replacementRate: .1, cursorReturnRate: .1, selectionRate: .1, undoRate: .1 },
  linguistic: { meanSentenceWords: 12.5, sentenceLengthDistribution: [1, 2, 3, 4, 5], meanParagraphWords: 54, paragraphLengthDistribution: [1, 2, 3, 4, 5], punctuationFrequency: { ",": 8 }, commonWords: [{ value: "plainly", frequency: 4 }], commonPhrases: [{ value: "in practice", frequency: 3 }] },
  composition: { sentenceRevisionRate: .2, paragraphRevisionRate: .1, expansionRate: .3, compressionRate: .15, phraseReplacementRate: .05 },
  confidence: { overall: 37, interaction: 40, linguistic: 37, composition: 34, explanation: "Measured" },
} satisfies WriterProfile;

const sessionsFrom = (samples: Array<{ taskType: WritingSession["taskType"]; text: string }>): WritingSession[] => samples.map((sample, index) => ({ id: `session-${index}`, promptId: `prompt-${index}`, prompt: "Prompt", taskType: sample.taskType, startedAt: "2026-01-01", completedAt: `2026-01-0${index + 1}`, startingDocument: "", finalDocument: sample.text, events: [], metrics: {} as WritingSession["metrics"], styleEligible: true }));
const fingerprint: StyleFingerprint = buildStyleFingerprint(sessionsFrom(SYNTHETIC_CALIBRATION), { ...profile, id: "profile" });

const promptOf = (options: unknown) => (options as { messages: Array<{ content: string }> }).messages[1]!.content;
const tagged = (prompt: string, tag: string) => prompt.match(new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`))?.[1] ?? "";

/** A model stand-in. Pass 2 echoes its draft; the corrective pass echoes its sentences unless told otherwise. */
function fakeAi(structural: (passage: string) => string, recast?: (sentences: string) => string) {
  const run = vi.fn(async (_model: string, options: unknown) => {
    const prompt = promptOf(options);
    if (prompt.startsWith("PASS 1")) return { response: structural(tagged(prompt, "passage")) };
    if (prompt.startsWith("PASS 2")) return { response: tagged(prompt, "current_draft") };
    return { response: recast ? recast(tagged(prompt, "sentences")) : tagged(prompt, "sentences") };
  });
  return { ai: { run } as unknown as Ai, run };
}

const recordedSections = () => {
  const source = splitDraftIntoSections(BRIEFING_BENCHMARK); const recorded = splitDraftIntoSections(BRIEFING_BENCHMARK_RECORDED_OUTPUT);
  return new Map(source.map((section, index) => [section.body, recorded[index]?.body ?? section.body]));
};
const replayBenchmark = () => { const sections = recordedSections(); return fakeAi((passage) => sections.get(passage) ?? passage); };

afterEach(() => { vi.restoreAllMocks(); });

describe("prompts and style context", () => {
  it("turns measurements into usable style direction without treating confidence as a gate", () => {
    const context = writerProfileToStyleContext(profile);
    expect(context).toContain("medium-length sentences");
    expect(context).toContain("compact paragraphs");
    expect(context).toContain("plainly (4)");
    expect(context).toContain("never prevents a substantive rewrite");
  });

  it("asks for structure before vocabulary and gives the model measured, actionable rhythm", () => {
    const passage = splitDraftIntoSections(BRIEFING_BENCHMARK)[1]!.body;
    const prompt = buildStructuralPrompt(passage, fingerprint, "formal");
    expect(prompt.indexOf("Sentence boundaries")).toBeLessThan(prompt.indexOf("Clause order"));
    expect(prompt).toContain("wording is handled in the next pass");
    expect(prompt).toContain("WRITER'S SENTENCE ARCHITECTURE");
    expect(prompt).toMatch(/most sentences run \d+–\d+ words \(median \d+\)/);
    expect(prompt).toMatch(/word counts in order: \d+, \d+/);
    expect(prompt).toContain("CONTENT LEDGER");
    expect(prompt).toContain("FIIRO");
    expect(architectureBrief(rhythmFor(fingerprint), "formal")).not.toContain("first-person");
    expect(passageBrief(passage, rhythmFor(fingerprint), "formal")).toContain("longer than this writer's");
  });

  it("keeps a formal source formal and separates stable style from incidental habits", () => {
    expect(detectSourceRegister(BRIEFING_BENCHMARK)).toBe("formal");
    const prompt = buildStructuralPrompt("The policy assessment therefore recommends targeted implementation. Evidence from the programme supports this recommendation.", fingerprint);
    expect(prompt).toContain("SOURCE REGISTER — FORMAL");
    expect(prompt).toContain("Incidental, never transfer it");
    expect(prompt).toContain("Stable, transfer it");
  });

  it("does not hand a conversational personal sample to a formal source", () => {
    const personal = SYNTHETIC_CALIBRATION.find((sample) => sample.taskType === "personal")!.text;
    const prompt = buildStructuralPrompt(splitDraftIntoSections(BRIEFING_BENCHMARK)[4]!.body, fingerprint, "formal");
    expect(prompt).not.toContain(personal.slice(0, 40));
    expect(prompt).not.toContain("I just wanted to watch it");
    expect(prompt).not.toContain("(personal writing)");
    expect(prompt).toContain("Cities should charge for parking at the kerb, even where it has always been free.");
  });

  it("withholds the source from the audit pass unless content has to be restored", () => {
    const source = "The demonstrator would take three validated technologies to market over 24 months.";
    const plain = buildVoicePrompt(source, "Over 24 months, the demonstrator would take three validated technologies to market.", ["1 sentence opens with the same words as a source sentence."], profile, fingerprint);
    expect(plain).not.toContain("<content_reference>");
    expect(plain).toContain("MEASURED FINDINGS");
    expect(plain).toContain("opens with the same words");
    const corrective = buildVoicePrompt(source, "The demonstrator will take three technologies to market.", [], profile, fingerprint, { corrective: true, includeSource: true, repairs: ["Restore “24” exactly as written in the source."] });
    expect(corrective).toContain("REPAIRS REQUIRED FIRST");
    expect(corrective).toContain("<content_reference>");
    expect(corrective).toContain("Do not restore their construction");
  });

  it("parses numbered corrective output and tolerates the older JSON envelope", () => {
    expect([...parseNumberedSentences("1: First rebuilt.\n2) Second rebuilt.\nnoise\n9: out of range", 2)]).toEqual([[0, "First rebuilt."], [1, "Second rebuilt."]]);
    expect(buildSentenceRecastPrompt(["One sentence here.", "Another sentence here."], fingerprint, "formal")).toContain("1: One sentence here.\n2: Another sentence here.");
    expect(parseCandidates('{"candidates":[{"id":"a","text":"One."},{"id":"b","text":"Two."}]}')).toEqual(["One.", "Two."]);
    expect(cleanModelText('{"candidates":[{"text":"Wrapped text."}]}')).toBe("Wrapped text.");
    expect(cleanModelText("<passage>\nPlain text.\n</passage>")).toBe("Plain text.");
  });
});

describe("style similarity", () => {
  it("scores a candidate against the writer's measured rhythm, so exemplars shape ranking", async () => {
    const clipped = "The budget is fixed. It covers tooling. Trials come next. Each phase is short. Costs stay low. Nothing else is funded.";
    const layered = "The budget, which was agreed after a long review of the available options, covers the tooling that manufacturers need before trials can begin, although the precise allocation between the phases has not yet been settled by the steering group. Each later phase, which depends on the results of the one before it, is funded only when the earlier work has been assessed and the findings have been shared with every partner involved in the programme.";
    const clippedWriter = buildStyleFingerprint(sessionsFrom([{ taskType: "explanation", text: "I keep notes short. Each one has a date. I file them by week. Old ones get archived. Nothing is deleted. It works for me. I check them on Friday. That is the whole system." }, { taskType: "argument", text: "Short meetings are better. People stay alert. Decisions come faster. Nobody drifts off. The agenda stays tight. Long ones waste time. I have seen both. The short ones win." }]), { ...profile, id: "clipped" });
    const layeredWriter = buildStyleFingerprint(sessionsFrom([{ taskType: "explanation", text: "When a household writes a budget down, which most never do because the task seems tedious, three things usually happen, although not always in the same order or with the same force. The fixed costs, which had been invisible because they left the account automatically, become visible for the first time, and the argument about priorities, which had been conducted in generalities, finally has something concrete to point at. Planning only makes sense after that month of noticing, since a plan built on guesses, however carefully it is laid out, will fail as soon as the first unexpected bill arrives." }, { taskType: "argument", text: "Cities should charge for parking at the kerb, even where it has always been free, because the space is costly to provide and the cost is at present carried by every resident, including those who do not own a car. When a price is set, even a low one, drivers stay for shorter periods and spaces turn over, which helps the shops that depend on passing trade, although critics say, with some justice, that charges fall hardest on poorer drivers who have no alternative to driving. That concern, which is real and which any serious scheme has to answer, can be met with resident permits and discounts that protect those who depend on a car, without giving up the principle that a scarce public space should carry a price. Free parking, which looks like a gift to everyone, hides a cost that falls on people who never use it, and pricing it brings that cost into the open, where it can be debated and adjusted as conditions change." }]), { ...profile, id: "layered" });
    expect(await deterministicStyleScorer.score(clipped, clippedWriter, "neutral")).toBeGreaterThan(await deterministicStyleScorer.score(layered, clippedWriter, "neutral"));
    expect(await deterministicStyleScorer.score(layered, layeredWriter, "neutral")).toBeGreaterThan(await deterministicStyleScorer.score(clipped, layeredWriter, "neutral"));
    // The same passage is briefed differently for the two writers.
    expect(buildStructuralPrompt(layered, clippedWriter)).toContain("longer than this writer's");
    expect(buildStructuralPrompt(clipped, layeredWriter)).toContain("shorter than this writer's");
  });

  it("reports whether a candidate moved toward the writer relative to the untouched source", async () => {
    const source = splitDraftIntoSections(BRIEFING_BENCHMARK)[1]!.body;
    const [copy, recast] = await rankCandidates(source, [source, recordedSections().get(source)!], fingerprint, deterministicStyleScorer, "formal");
    expect(copy!.diagnostics.styleGain).toBe(0);
    expect(recast!.diagnostics.styleGain).toBeGreaterThan(0);
  });
});

describe("candidate ranking and selection", () => {
  it("rejects broken facts and never lets a safe source copy count as a transformation", async () => {
    const source = "Revenue rose 12% in 2025.";
    const [wrong, copy, moved] = await rankCandidates(source, ["Revenue rose 8% in 2025.", source, "In 2025, revenue rose by 12%."], undefined);
    expect(wrong?.valid).toBe(false);
    expect(copy).toMatchObject({ valid: true, eligible: false, meaning: 100, fluency: 100, movement: 0 });
    expect(copy!.diagnostics.tooLightReasons.length).toBeGreaterThan(0);
    expect(moved).toMatchObject({ valid: true, eligible: true });
    expect(transformationDepth(source, source).tooLight).toBe(true);
  });

  it("reports semantic marker changes without rejecting a fact-safe rewrite", async () => {
    const [score] = await rankCandidates("Revenue may rise 12% in 2025.", ["In 2025, revenue could increase by 12%."], undefined);
    expect(score?.valid).toBe(true);
    expect(score?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("certainty"), expect.stringContaining("direction")]));
    expect(score!.meaning).toBeLessThan(100);
  });

  it("blocks first-person stance, changed certainty and conversational filler in a formal source", async () => {
    const formal = "The policy assessment therefore recommends targeted implementation. Evidence from the programme supports this recommendation.";
    const [firstPerson] = await rankCandidates(formal, ["I think the policy assessment recommends targeted implementation. My experience says the programme evidence supports it."], undefined);
    expect(firstPerson?.valid).toBe(false);
    expect(firstPerson?.diagnostics.registerViolations).toBe(1);
    expect(firstPerson?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("first-person")]));

    const [weakened, strengthened] = await rankCandidates("Digital sensing should be used only if evidence supports it.", ["Digital sensing might be used only if evidence supports it.", "Digital sensing must be used only if evidence supports it."], undefined);
    expect(weakened?.valid).toBe(false);
    expect(strengthened?.valid).toBe(false);
    expect(weakened?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("epistemic stance")]));

    const [fluent, clumsy] = await rankCandidates("Teams coordinate systems.", ["Teams coordinate systems.", "Teams coordinate systems and partners and vendors and policymakers havent aligned, you know."], undefined);
    expect(clumsy!.fluency).toBeLessThan(fluent!.fluency);
    expect(clumsy!.fluency).toBeLessThan(75);
    expect(clumsy?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("apostrophe"), expect.stringContaining("conjunctions"), expect.stringContaining("filler")]));
  });

  it("caps movement credit so ranking never prefers a rewrite for changing more", async () => {
    const source = splitDraftIntoSections(BRIEFING_BENCHMARK)[2]!.body;
    const [recast] = await rankCandidates(source, [recordedSections().get(source)!], fingerprint, deterministicStyleScorer, "formal");
    const withoutMovement = .35 * recast!.style + .25 * recast!.meaning + .15 * recast!.fluency;
    expect(recast!.total - withoutMovement).toBeLessThanOrEqual(25);
    expect(recast!.total).toBeLessThanOrEqual(100);
  });

  const entry = (attempt: string, overrides: Partial<CandidateScore> & { movementScore?: number }) => ({ attempt, score: { candidate: attempt, meaning: 100, style: 70, fluency: 100, movement: 40, total: 80, valid: true, eligible: true, warnings: [], corrections: [], ...overrides, diagnostics: { movementScore: overrides.movementScore ?? .4 } as CandidateScore["diagnostics"] } });

  it("compares every attempt and keeps a better initial candidate over a weaker retry", () => {
    expect(selectFromPool([entry("structural", { total: 82 }), entry("voice", { total: 78 }), entry("retry", { total: 74.7 })])).toMatchObject({ selected: { attempt: "structural" }, belowMovementFloor: false });
    expect(selectFromPool([entry("structural", { total: 77.95 }), entry("retry", { total: 84 })]).selected?.attempt).toBe("retry");
  });

  it("never selects a too-light or unsafe candidate over an eligible one, whatever its total", () => {
    const pool = [entry("structural", { total: 95, eligible: false, movementScore: .05 }), entry("voice", { total: -1, valid: false, eligible: false, movementScore: .7 }), entry("retry", { total: 71 })];
    expect(selectFromPool(pool).selected?.attempt).toBe("retry");
  });

  it("falls back to the safe candidate that moved furthest and flags it when none clears the floor", () => {
    const pool = [entry("structural", { eligible: false, total: 79, movementScore: .22 }), entry("retry", { eligible: false, total: 81, movementScore: .12 }), entry("voice", { eligible: false, valid: false, total: -1, movementScore: .6 })];
    expect(selectFromPool(pool)).toMatchObject({ selected: { attempt: "structural" }, belowMovementFloor: true });
    expect(selectFromPool([entry("voice", { eligible: false, valid: false, total: -1 })])).toMatchObject({ selected: undefined, belowMovementFloor: true });
  });
});

describe("section pipeline", () => {
  const section = "The demonstrator would take three validated technologies from prototype to certified product over 24 months. Exchange rate volatility is a third risk, because imported components are priced in US dollars.";
  const rebuilt = ["Over 24 months, three validated technologies would be taken by the demonstrator from prototype to certified product.", "Because imported components are priced in US dollars, exchange rate volatility is a third risk."];

  it("adds the retry to the pool so initial and retry candidates compete", async () => {
    const { ai, run } = fakeAi((passage) => passage, () => rebuilt.map((sentence, index) => `${index + 1}: ${sentence}`).join("\n"));
    const result = await transformWithProfile(ai, section, profile, fingerprint);
    const diagnostics = result.diagnostics.sections[0]!;
    expect(diagnostics.attempts.map((attempt) => attempt.attempt)).toEqual(["structural", "voice", "retry"]);
    expect(diagnostics.retryReasons).toEqual(["TOO_LIGHT"]);
    expect(diagnostics.attempts[0]!.candidates[0]).toMatchObject({ valid: true, eligible: false, movement: 0 });
    expect(diagnostics.selectedAttempt).toBe("retry");
    expect(diagnostics.modelCalls).toBe(3);
    expect(run).toHaveBeenCalledTimes(3);
    expect(result.retried).toBe(true);
    expect(result.transformed).toBe(rebuilt.join(" "));
  });

  it("skips the retry when an earlier candidate is already eligible", async () => {
    const { ai, run } = fakeAi(() => rebuilt.join(" "));
    const result = await transformWithProfile(ai, section, profile, fingerprint);
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.retried).toBe(false);
    expect(result.diagnostics.sections[0]!.selectedAttempt).toBe("structural");
  });

  it("splices only rebuilt sentences that are safe and no longer near copies", () => {
    const stuck = section.split(/(?<=\.)\s+/);
    const spliced = spliceRecastSentences(section, stuck, new Map([[0, rebuilt[0]!.replace("24 months", "18 months")], [1, rebuilt[1]!]]));
    expect(spliced).toBe(`${stuck[0]} ${rebuilt[1]}`);
    expect(spliceRecastSentences(section, stuck, new Map([[0, stuck[0]!], [1, stuck[1]!.replace("is a third risk", "remains a third risk")]]))).toBeUndefined();
  });

  it("repairs an unsafe recast by reverting only the offending sentence, without another model call", async () => {
    const third = "Budget lines for tooling should be held in a hard currency account, and procurement should be scheduled early in each phase.";
    const thirdRebuilt = "Procurement should be scheduled early in each phase, and budget lines for tooling should be held in a hard currency account.";
    const unsafe = `${rebuilt[0]!.replace("would be taken", "will be taken")} ${rebuilt[1]} ${thirdRebuilt}`;
    const { ai, run } = fakeAi(() => unsafe);
    const result = await transformWithProfile(ai, `${section} ${third}`, profile, fingerprint);
    const diagnostics = result.diagnostics.sections[0]!;
    expect(diagnostics.attempts.map((attempt) => attempt.attempt)).toEqual(["structural", "structural-repaired", "voice"]);
    expect(diagnostics.attempts[0]!.candidates[0]).toMatchObject({ valid: false, total: -1 });
    expect(diagnostics.selectedAttempt).toBe("structural-repaired");
    expect(result.transformed).toBe(`The demonstrator would take three validated technologies from prototype to certified product over 24 months. ${rebuilt[1]} ${thirdRebuilt}`);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("fails as too light when the model only returns the source, and logs no draft text", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { ai } = fakeAi((passage) => passage);
    await expect(transformWithProfile(ai, section, profile, fingerprint)).rejects.toThrow("TRANSFORMATION_TOO_LIGHT");
    const logged = errors.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("TRANSFORMATION_TOO_LIGHT");
    expect(logged).not.toContain("demonstrator");
    expect(logged).not.toContain("US dollars");
  });

  it("builds the audit from measurement rather than asking for a harder rewrite", () => {
    const findings = auditFindings(section, section, fingerprint);
    expect(findings.join(" ")).toContain("2 sentences still follow the source almost word for word");
    expect(findings.join(" ")).toContain("open with the same words");
    expect(auditFindings(section, rebuilt.join(" "), fingerprint).join(" ")).not.toContain("almost word for word");
  });
});

describe("long structured documents", () => {
  it("splits at natural headings, keeps numbered headings and preserves the reference list to the end", () => {
    const sections = splitDraftIntoSections(BRIEFING_BENCHMARK);
    expect(sections.map((item) => item.heading)).toEqual(["Briefing note: UK–Nigeria science and technology partnership opportunities under STA-S", "1. Opportunity areas", "2. Why this fits STA-S", "3. Partners and why", "4. Demonstrator", "5. Risks and mitigation", "6. Early indicators of success", "References"]);
    expect(sections.at(-1)).toMatchObject({ preserve: true });
    expect(sections.at(-1)!.body).toContain("https://www.gov.uk/government/publications/sta-s-programme-guidance");
    expect(sections.slice(1, 7).every((item) => !item.preserve && item.body.split(/\s+/).length <= 250)).toBe(true);
    // A numbered recommendation that is a full sentence is prose, not a heading.
    expect(splitDraftIntoSections("1. Scope\n\n1. Establish a joint steering group by March 2026 and publish its terms of reference.")).toHaveLength(1);
  });

  it("transforms the benchmark section by section and keeps its protected substance", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { ai, run } = replayBenchmark();
    const result = await transformWithProfile(ai, BRIEFING_BENCHMARK, profile, fingerprint);
    const output = result.transformed;

    // Sections and headings survive, in order.
    const headings = splitDraftIntoSections(BRIEFING_BENCHMARK).map((item) => item.heading);
    expect(splitDraftIntoSections(output).map((item) => item.heading)).toEqual(headings);
    // The reference list is untouched.
    const references = BRIEFING_BENCHMARK.slice(BRIEFING_BENCHMARK.indexOf("References"));
    expect(output.endsWith(references)).toBe(true);
    // Numbers, currency, percentages and dates.
    for (const fact of ["US$5 million", "45%", "30%", "25%", "40%", "24 months", "January 2026", "March 2024", "2019", "2023", "month 10", "month 18", "first 12 months", "nine months", "three years"]) expect(output, fact).toContain(fact);
    // Names, institutions and programmes.
    for (const name of ["Federal Institute of Industrial Research Oshodi (FIIRO)", "Nigerian Stored Products Research Institute (NSPRI)", "Science and Technology Accelerator for Sustainability (STA-S)", "Manufacturers Association of Nigeria (MAN)", "Federal Ministry of Innovation, Science and Technology (FMIST)", "Standards Organisation of Nigeria (SON)", "Innovate UK", "Natural Resources Institute", "University of Greenwich", "Lagos, Kano and Aba", "Ghana and Kenya", "National Agricultural Technology Review"]) expect(output, name).toContain(name);
    // Recommendations keep their strength: nothing dropped, nothing escalated.
    const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;
    expect(count(output, /\bshould\b/g)).toBeGreaterThanOrEqual(count(BRIEFING_BENCHMARK, /\bshould\b/g));
    expect(count(output, /\bmust\b/g)).toBe(count(BRIEFING_BENCHMARK, /\bmust\b/g));
    expect(count(output, /\bwill\b/g)).toBe(count(BRIEFING_BENCHMARK, /\bwill\b/g));
    expect(output).toContain("only if at least one manufacturer commits");
    expect(output).toMatch(/single demonstrator is recommended/);
    expect(output).not.toMatch(/\b(?:I|we|my|our)\b/);
    expect(result.scores.every((score) => score.valid)).toBe(true);
    expect(result.diagnostics.globalValidation).toMatchObject({ protectedFactFailures: 0, hardFailures: 0 });

    // Movement against the diagnostic baseline (retention 88.6% initial, 75% retry).
    const movement = result.diagnostics.movement;
    expect(movement.sentenceRetention).toBeLessThan(.5);
    expect(movement.exactSentenceRetention).toBeLessThan(.35);
    expect(movement.boundaryChange).toBeGreaterThan(.15);
    expect(movement.openingChange).toBeGreaterThan(.5);
    expect(movement.structuralScore).toBeGreaterThan(.25);
    expect(movement.movementScore).toBeGreaterThanOrEqual(.3);
    expect(movement.tooLightReasons).toEqual([]);
    expect(measureMovement(BRIEFING_BENCHMARK, BRIEFING_BENCHMARK).movementScore).toBe(0);

    // One bounded pass structure: never three whole-document rewrites in one call.
    expect(result.diagnostics.modelCalls).toBe(run.mock.calls.length);
    expect(run.mock.calls.length).toBeLessThanOrEqual(6 * 3);
    for (const [, options] of run.mock.calls) expect(promptOf(options).split(/\s+/).length).toBeLessThan(2500);
    expect(log).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("keeps raw draft, exemplar and output text out of the telemetry payload", async () => {
    const { ai } = replayBenchmark();
    const result = await transformWithProfile(ai, BRIEFING_BENCHMARK, profile, fingerprint);
    const telemetry = JSON.stringify({ message: "transformation diagnostics", userId: "user", ...result.diagnostics });
    const fourWordRuns = (text: string) => { const words = text.split(/\s+/).filter(Boolean); return words.slice(0, -3).map((_, index) => words.slice(index, index + 4).join(" ")); };
    const privateRuns = [BRIEFING_BENCHMARK, result.transformed, ...SYNTHETIC_CALIBRATION.map((sample) => sample.text)].flatMap(fourWordRuns);
    expect(privateRuns.filter((run) => telemetry.includes(run))).toEqual([]);
    for (const word of ["FIIRO", "NSPRI", "Nigeria", "demonstrator", "parking", "budget"]) expect(telemetry).not.toContain(word);
    // What telemetry does carry: counts, scores and reasons.
    expect(telemetry).toContain("movementScore");
    expect(telemetry).toContain("selectedAttempt");
    expect(telemetry).toContain("modelCalls");
  });
});
