import { compareProtectedFacts } from "../src/validation/compareProtectedFacts";
import { extractProtectedFacts } from "../src/validation/extractProtectedFacts";

/**
 * Semantic and register safety. These checks decide whether a candidate may be
 * used at all; they never reward or penalise how much the expression moved.
 */

const FIRST_PERSON = /\b(?:I|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi;

/**
 * Stance classes. The first four carry epistemic or deontic strength and may
 * neither appear nor disappear nor lose an occurrence. "will" and "would" are
 * too frequent for counting to mean much, so they are guarded against being
 * introduced, removed wholesale, or swapped on the same verb.
 */
const STANCE_CLASSES: Array<{ name: string; counted: boolean; pattern: RegExp }> = [
  { name: "filler", counted: true, pattern: /\b(?:I guess|I think|maybe|perhaps)\b/gi },
  { name: "tentative", counted: true, pattern: /\b(?:may|might|could|possibly|appears?|suggests?|likely|unlikely)\b/gi },
  { name: "advice", counted: true, pattern: /\b(?:should|recommend(?:s|ed|ing|ation)?|ought to)\b/gi },
  { name: "obligation", counted: true, pattern: /\b(?:must|requir(?:e|es|ed|ing)|certain(?:ly|ty)?|definit(?:e|ely)|undoubtedly|always|never)\b/gi },
  { name: "certain", counted: false, pattern: /\b(?:will|shall)\b/gi },
  { name: "conditional", counted: false, pattern: /\bwould\b/gi },
];
const MODAL_CLASS: Record<string, string> = { may: "tentative", might: "tentative", could: "tentative", should: "advice", must: "obligation", require: "obligation", requires: "obligation", required: "obligation", will: "certain", shall: "certain", would: "conditional" };
const HEAD_SKIP = new Set(["not", "also", "be", "been", "have", "then", "only", "still", "therefore", "now", "however", "never", "always", "first", "in", "turn", "each", "to", "both", "either", "all", "at", "least"]);
const NEGATION = /\b(?:no|not|never|neither|nor|without|cannot)\b|n['’]t\b/gi;

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;
const stanceWords = (text: string) => STANCE_CLASSES.filter((entry) => entry.counted).flatMap(({ pattern }) => [...text.matchAll(pattern)].map((match) => match[0].toLowerCase()));
const negationCount = (text: string) => count(text, NEGATION);
/** Splitting a sentence can repeat a modal or a negation, so a bounded increase is not a change of meaning. */
const withinIncrease = (source: number, output: number) => output >= source && output <= source + Math.max(1, Math.ceil(source / 2));
/** Short stems so "signing" and "signed", or "submission" and "submitted", anchor to the same verb. */
const stem = (word: string) => word.slice(0, 4);

const LIMITERS = /\b(?:only|at least|at most|no later than|no more than|no fewer than|fewer than|less than|more than|up to|unless|until|except)\b/gi;
const SEQUENCE_MARKERS = /\b(?:first|second|third|fourth|fifth|finally|lastly)\b/gi;
const CAUSAL_LINKS = /\b(?:because|therefore|thus|hence|consequently|as a result|due to|owing to|given that|so that|leads? to|results? in|caus(?:e|es|ed|ing))\b|\bsince\b(?!\s+\d)|(?:[,;]\s+|^|[.!?]\s+)so\b(?!\s+that)/gim;

/**
 * Conditions, enumeration and cause. A limiter or sequence marker may repeat
 * when a sentence is split but may not vanish; a causal link may not be
 * created, and at most one may be absorbed by restructuring.
 */
export function markerChanges(input: string, output: string): string[] {
  const reasons: string[] = [];
  const listed = (pattern: RegExp) => [...new Set([...input.matchAll(pattern)].map((match) => match[0].trim().toLowerCase().replace(/^[,;.!?]\s*/, "")))].join(", ");
  if (!withinIncrease(count(input, LIMITERS), count(output, LIMITERS))) reasons.push(`A condition or limit changed force. The source limits its claims with: ${listed(LIMITERS) || "nothing"}. Keep each one on its claim and add none.`);
  if (!withinIncrease(count(input, SEQUENCE_MARKERS), count(output, SEQUENCE_MARKERS))) reasons.push(`An enumeration changed. The source numbers its points with: ${listed(SEQUENCE_MARKERS) || "nothing"}. Keep each marker on its point and add none.`);
  const sourceCausal = count(input, CAUSAL_LINKS); const targetCausal = count(output, CAUSAL_LINKS);
  if (targetCausal > sourceCausal) reasons.push(`A cause-and-effect link was created that the source does not state. The source has ${sourceCausal} (${listed(CAUSAL_LINKS) || "none"}). Remove every "because", "since", "so" or "therefore" that joins points the source merely places side by side.`);
  else if (targetCausal < sourceCausal - 1) reasons.push(`Cause-and-effect links were lost. The source states ${sourceCausal}: ${listed(CAUSAL_LINKS)}. Keep each one.`);
  return reasons;
}

/**
 * For every modal, the words it governs up to the end of its clause. Used to
 * tell a repeated modal ("should A. It should B.") from a swapped one
 * ("should A" becoming "must A").
 */
interface ModalScope { modal: string; modalClass: string; head: string | undefined; headWord: string | undefined; governed: Set<string>; subject: Set<string>; object: Set<string>; passive: boolean }

function modalScopes(text: string): ModalScope[] {
  return text.split(/[.;:!?\n]+/).flatMap((clause) => {
    // Commas are kept as tokens so the subject and object segments stop at them.
    const words: string[] = clause.toLowerCase().match(/[\p{L}\p{N}]+|,/gu) ?? [];
    return words.flatMap((word, index) => {
      const modalClass = MODAL_CLASS[word];
      if (!modalClass) return [];
      const rest = words.slice(index + 1).filter((token) => token !== ",");
      const headWord = rest.find((candidate) => candidate.length > 2 && !HEAD_SKIP.has(candidate) && !MODAL_CLASS[candidate]);
      const before = words.slice(0, index); const subjectTokens = before.slice(before.lastIndexOf(",") + 1);
      const headIndex = headWord ? words.indexOf(headWord, index + 1) : -1;
      const after = headIndex >= 0 ? words.slice(headIndex + 1) : []; const objectTokens = after.slice(0, after.indexOf(",") >= 0 ? after.indexOf(",") : after.length);
      const content = (tokens: string[]) => new Set(tokens.filter((token) => token.length > 3 || /\d/.test(token)).map(stem));
      return [{ modal: word, modalClass, head: headWord ? stem(headWord) : undefined, headWord, governed: new Set(rest.map(stem)), subject: content(subjectTokens), object: content(objectTokens), passive: words[index + 1] === "be" || (words[index + 1] === "not" && words[index + 2] === "be") }];
    });
  });
}

const shares = (a: Set<string>, b: Set<string>) => [...a].some((token) => b.has(token));

/**
 * Who does what to whom. When a sentence is rebuilt around the same verb in
 * the same voice, what stood before the verb must not end up after it:
 * "45% would support tooling" is not "tooling would support 45%".
 */
function roleReversals(input: string, output: string): string[] {
  const sourceScopes = modalScopes(input);
  return modalScopes(output).flatMap((scope) => {
    const peers = sourceScopes.filter((candidate) => candidate.head && candidate.head === scope.head && candidate.passive === scope.passive);
    const consistent = peers.some((peer) => shares(peer.subject, scope.subject) || (!peer.subject.size && !scope.subject.size));
    const reversed = peers.some((peer) => shares(peer.subject, scope.object) && shares(peer.object, scope.subject));
    return reversed && !consistent ? [`“${scope.modal} ${scope.headWord}” now has its subject and object exchanged, which changes who does what.`] : [];
  });
}

/** Specific, quotable reasons a claim's strength changed. Prompt and user facing; never logged. */
export function stanceChanges(input: string, output: string): string[] {
  const reasons: string[] = [];
  for (const { name, counted, pattern } of STANCE_CLASSES) {
    const source = count(input, pattern); const target = count(output, pattern);
    const words = [...new Set([...output.matchAll(pattern), ...input.matchAll(pattern)].map((match) => match[0].toLowerCase()))].join("/");
    if (source === 0 && target > 0) reasons.push(`“${words}” was introduced; the source makes no ${name} claim.`);
    else if (source > 0 && target === 0) reasons.push(`Every “${words}” was removed; the source qualifies ${source} claim${source === 1 ? "" : "s"} that way.`);
    else if (counted && target < source) reasons.push(`“${words}” qualifies ${source} claim${source === 1 ? "" : "s"} in the source but only ${target} in the output.`);
    else if (counted && !withinIncrease(source, target)) reasons.push(`“${words}” is used ${target} times; the source uses it ${source} times.`);
  }
  const sourceScopes = modalScopes(input);
  const sourceStems = new Set((input.toLowerCase().match(/[\p{L}]+/gu) ?? []).map(stem));
  // A verb the source also uses must be governed by the same class of modal
  // there. A modal on a verb the source left unqualified is a changed claim.
  for (const { modal, modalClass, head, headWord } of modalScopes(output)) {
    if (head && sourceStems.has(head) && !sourceScopes.some((scope) => scope.modalClass === modalClass && scope.governed.has(head))) {
      const original = input.split(/(?<=[.!?])\s+|\n+/).find((sentence) => (sentence.toLowerCase().match(/[\p{L}]+/gu) ?? []).some((word) => stem(word) === head));
      reasons.push(`“${modal} … ${headWord}” is not how the source qualifies that point.${original ? ` The source says: “${original.trim()}”` : ""}`);
    }
  }
  return [...reasons, ...roleReversals(input, output)];
}

export interface Guardrails { firstPerson: boolean; stance: boolean; negation: boolean; warnings: string[]; stanceReasons: string[] }

export function authorshipGuardrails(input: string, output: string): Guardrails {
  const firstPerson = !input.match(FIRST_PERSON)?.length && Boolean(output.match(FIRST_PERSON)?.length);
  const stanceReasons = stanceChanges(input, output); const stance = stanceReasons.length > 0;
  const negation = !withinIncrease(negationCount(input), negationCount(output));
  const warnings = [
    firstPerson ? "Output introduces first-person perspective that is absent from the source." : undefined,
    stance ? "Output materially changes the source's epistemic stance or recommendation strength." : undefined,
    negation ? "Output adds or removes a negation." : undefined,
  ].filter((warning): warning is string => Boolean(warning));
  return { firstPerson, stance, negation, warnings, stanceReasons };
}

const LEADING_FUNCTION_WORD = /^(?:The|A|An|This|That|These|Those|In|On|At|For|With|By|From|To|Under|Over|Across|During|Within|Through|Among|Between|Both|Its|Their|Each|Such|Although|While|When|If|As|Because|Since|However|Therefore|Moreover|First|Second|Third|Finally)\s+/;
const CAPITALISED = "[A-Z][\\p{L}'’-]*[\\p{Ll}][\\p{L}'’-]*";

/**
 * Names, institutions, programme titles and acronyms. Extraction is
 * deliberately conservative: acronyms, multi-word capitalised sequences, and
 * single capitalised words that are not merely the first word of a sentence.
 */
export function extractProtectedTerms(text: string): string[] {
  const terms = new Set<string>();
  for (const match of text.matchAll(/\b[A-Z][A-Z0-9]+(?:[-–][A-Z0-9]+)*\b/g)) terms.add(match[0]);
  // A figure's magnitude and currency prefix are part of the figure: "US$5 million" is not "$5 billion".
  for (const match of text.matchAll(/(?:[A-Z]{2,3})?[$€£¥]?\s?\d[\d,.]*\s(?:thousand|million|billion|trillion)\b/g)) terms.add(match[0].trim());
  for (const match of text.matchAll(new RegExp(`\\b${CAPITALISED}(?:\\s+(?:(?:of|for|the|de)\\s+)*${CAPITALISED})+`, "gu"))) {
    const term = match[0].replace(LEADING_FUNCTION_WORD, "").trim();
    if (term) terms.add(term);
  }
  for (const match of text.matchAll(new RegExp(`(?<=[\\p{Ll}\\d,;:)]\\s)${CAPITALISED}`, "gu"))) terms.add(match[0]);
  // A single word that only ever occurs inside a longer protected term adds nothing.
  return [...terms].filter((term) => term.length > 1 && !(!/\s/.test(term) && [...terms].some((other) => other !== term && other.split(/\s+/).includes(term))));
}

/**
 * A term that opened a source sentence may legitimately lose its capital when
 * the sentence is recast, so its first letter is compared case-insensitively.
 */
export function missingProtectedTerms(input: string, output: string): string[] {
  return extractProtectedTerms(input).filter((term) => !output.includes(term) && !output.includes(term.charAt(0).toLowerCase() + term.slice(1)));
}

const CONTENT_WORD = /[\p{L}][\p{L}'’-]{3,}/gu;
const stems = (text: string) => new Set((text.toLowerCase().match(CONTENT_WORD) ?? []).map((word) => word.slice(0, 5)));

/** Share of the source's content vocabulary (crudely stemmed) that is still present. */
export function contentCoverage(input: string, output: string): number {
  const source = stems(input); const target = stems(output);
  return source.size ? [...source].filter((stem) => target.has(stem)).length / source.size : 1;
}

export const MIN_CONTENT_COVERAGE = .45;
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export interface SafetyReport {
  valid: boolean;
  protectedFactFailures: number;
  protectedTermFailures: number;
  registerViolations: number;
  semanticHardFailures: number;
  contentCoverage: number;
  /** User-facing review notes. May quote the draft, so they are returned to the writer but never logged. */
  warnings: string[];
  /** Corrective notes for the next model pass. Prompt-only; never logged. */
  corrections: string[];
}

export function assessSafety(input: string, output: string): SafetyReport {
  const facts = compareProtectedFacts(input, output);
  const guardrails = authorshipGuardrails(input, output);
  const missingTerms = missingProtectedTerms(input, output);
  const coverage = contentCoverage(input, output);
  const markers = markerChanges(input, output);
  const sourceWords = words(input); const lengthRatio = words(output) / Math.max(1, sourceWords);
  // Very short passages legitimately change length a lot; longer ones do not
  // lose a third of their words or grow by half without dropping or inventing content.
  const lengthDrift = sourceWords >= 20 && (lengthRatio < .65 || lengthRatio > 1.5);
  const drift = sourceWords >= 20 && coverage < MIN_CONTENT_COVERAGE;
  const semanticHardFailures = [guardrails.stance, guardrails.negation, lengthDrift, drift].filter(Boolean).length + markers.length;
  const warnings = [
    ...facts.warnings.map((warning) => warning.message),
    ...missingTerms.map((term) => `Protected name or term “${term}” is missing from the output.`),
    ...guardrails.warnings,
    ...markers,
    lengthDrift ? "Output length differs too much from the source to have kept the same content." : undefined,
    drift ? "Output no longer covers enough of the source's content." : undefined,
  ].filter((warning): warning is string => Boolean(warning));
  const corrections = [
    ...facts.warnings.map((warning) => warning.kind === "added" ? `Remove “${warning.output}”: it is not in the source.` : `Restore “${warning.input}” exactly as written in the source.`),
    ...missingTerms.map((term) => `Restore the name or term “${term}” exactly.`),
    guardrails.firstPerson ? "Remove every first-person word (I, we, my, our): the source has none." : undefined,
    ...guardrails.stanceReasons.map((reason) => `A claim's strength changed: ${reason} Qualify each claim exactly as strongly as the source does.`),
    ...markers,
    guardrails.negation ? "A negation was dropped or added. Every negated statement in the source stays negated, and nothing else becomes negated." : undefined,
    lengthDrift ? (lengthRatio < 1 ? "Content was dropped: carry every point of the source." : "Content was added: say only what the source says.") : undefined,
    drift ? "Too much of the source's subject matter is gone: keep its terminology and every point it makes." : undefined,
  ].filter((note): note is string => Boolean(note));
  return { valid: facts.valid && missingTerms.length === 0 && !guardrails.firstPerson && semanticHardFailures === 0, protectedFactFailures: facts.warnings.length, protectedTermFailures: missingTerms.length, registerViolations: guardrails.firstPerson ? 1 : 0, semanticHardFailures, contentCoverage: coverage, warnings, corrections };
}

export function fluencyPenalty(candidate: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  const repeatedWords = (candidate.match(/\b(\w+)\s+\1\b/gi) ?? []).length;
  const doubledPunctuation = (candidate.match(/\.\s*\./g) ?? []).length;
  const missingApostrophes = (candidate.match(/\b(?:hasnt|havent|hadnt|isnt|arent|wasnt|werent|dont|doesnt|didnt|cant|couldnt|shouldnt|wouldnt|wont)\b/gi) ?? []).length;
  const conjunctionChains = (candidate.match(/\b(and|or)\b[^,.;:\n]{0,45}\b\1\b[^,.;:\n]{0,45}\b\1\b/gi) ?? []).length;
  const casualFillers = (candidate.match(/\b(?:I think|I guess|I can say|my experience|you know|kind of|sort of)\b/gi) ?? []).length;
  if (missingApostrophes) warnings.push("Output contains a contraction with a missing apostrophe.");
  if (conjunctionChains) warnings.push("Output mechanically repeats conjunctions in a list or clause chain.");
  if (casualFillers) warnings.push("Output contains conversational filler or a personal aside.");
  return { score: Math.max(0, 100 - repeatedWords * 20 - doubledPunctuation * 25 - missingApostrophes * 30 - conjunctionChains * 18 - casualFillers * 25), warnings };
}

/**
 * The content that must survive, extracted deterministically from the source.
 * Handing the model a short checklist makes preservation cheap, so it does not
 * have to protect content by leaving whole sentences untouched.
 */
export function buildContentLedger(source: string): string {
  const unique = (values: string[]) => [...new Set(values)];
  const facts = unique(extractProtectedFacts(source).map((fact) => fact.value));
  const terms = extractProtectedTerms(source);
  const stance = stanceWords(source);
  const counts = unique(stance).map((word) => `${word} ×${stance.filter((item) => item === word).length}`);
  const negations = negationCount(source);
  return [
    "CONTENT LEDGER (extracted from the passage; everything here must appear in your output exactly as written)",
    `- Figures, dates, citations, quotations, URLs: ${facts.join(" | ") || "none"}`,
    `- Names, institutions, programmes, acronyms: ${terms.join(" | ") || "none"}`,
    `- Certainty and recommendation words: ${counts.join(", ") || "none in the source, so add none"}. Each stays on the claim it qualifies. None may be dropped, swapped for another, or added to a claim that had none. When a sentence is split, its modal may be repeated.`,
    `- Negations (no, not, never, without, cannot, n't): ${negations} in the source. Every negated statement stays negated; nothing else becomes negated.`,
    `- Limits and conditions (${[...new Set([...source.matchAll(LIMITERS)].map((match) => match[0].toLowerCase()))].join(", ") || "none"}): each stays on its claim with the same force. "only if" never becomes "if".`,
    `- Numbering of points (${[...new Set([...source.matchAll(SEQUENCE_MARKERS)].map((match) => match[0].toLowerCase()))].join(", ") || "none"}): keep each marker on its point.`,
    `- Cause-and-effect links: the source states ${count(source, CAUSAL_LINKS)}. Do not create a "because", "since", "so" or "therefore" between points the source merely places side by side, and do not drop one it states.`,
    "Everything not on this ledger is expression, and expression is what you are here to change.",
  ].join("\n");
}
