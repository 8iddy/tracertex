export type SemanticCategory = "certainty" | "causality" | "negation" | "direction" | "population" | "timeframe" | "comparison-group";
export interface SemanticWarning { category: SemanticCategory; message: string }

const patterns: Record<SemanticCategory, RegExp> = {
  certainty: /\b(may|might|could|can|likely|unlikely|possibly|probably|suggests?|appears?|indicates?|must|will|always|never|certainly)\b/gi,
  causality: /\b(because|causes?|caused|leads? to|led to|results? in|resulted in|due to|therefore|consequently|associated with|correlat(?:es?|ed|ion))\b/gi,
  negation: /\b(no|not|never|neither|nor|without|cannot|can't|didn't|doesn't|isn't|aren't|won't)\b/gi,
  direction: /\b(increas(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|higher|lower|more|less|improv(?:e|es|ed|ing)|wors(?:e|ened|ening)|rise|rose|fall|fell)\b/gi,
  population: /\b(participants?|patients?|children|adults?|students?|workers?|women|men|respondents?|users?|households?|companies|organizations?)\b/gi,
  timeframe: /\b(?:19|20)\d{2}\b|\b(?:day|week|month|quarter|year|annual|daily|weekly|monthly|long[- ]term|short[- ]term)s?\b/gi,
  "comparison-group": /\b(compared (?:with|to)|versus|vs\.?|control group|baseline|placebo|than)\b/gi,
};

const terms = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((match) => match[0].toLowerCase()).sort();

export function compareSemanticSignals(input: string, output: string): SemanticWarning[] {
  const warnings: SemanticWarning[] = [];
  for (const [category, pattern] of Object.entries(patterns) as [SemanticCategory, RegExp][]) {
    const before = terms(input, pattern);
    const after = terms(output, pattern);
    if (before.join("|") !== after.join("|")) {
      warnings.push({ category, message: `Review ${category.replace("-", " ")}: semantic markers changed (${before.length} in the original, ${after.length} in the result).` });
    }
  }
  return warnings;
}
