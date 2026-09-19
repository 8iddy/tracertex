import type { ProtectedFact } from "./extractProtectedFacts";
import { extractProtectedFacts } from "./extractProtectedFacts";

export interface FactWarning { kind: "missing" | "changed" | "added"; type: ProtectedFact["type"]; input?: string; output?: string; message: string }
export interface ValidationResult { valid: boolean; warnings: FactWarning[] }

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();

export function compareProtectedFacts(input: string, output: string): ValidationResult {
  const source = extractProtectedFacts(input);
  const target = extractProtectedFacts(output);
  const unused = [...target];
  const warnings: FactWarning[] = [];
  for (const fact of source) {
    const exact = unused.findIndex((candidate) => candidate.type === fact.type && normalize(candidate.value) === normalize(fact.value));
    if (exact >= 0) { unused.splice(exact, 1); continue }
    const sameType = unused.findIndex((candidate) => candidate.type === fact.type);
    if (sameType >= 0) {
      const changed = unused.splice(sameType, 1)[0]!;
      warnings.push({ kind: "changed", type: fact.type, input: fact.value, output: changed.value, message: `Potential ${fact.type} mismatch: “${fact.value}” became “${changed.value}”.` });
    } else warnings.push({ kind: "missing", type: fact.type, input: fact.value, message: `Input ${fact.type} “${fact.value}” is missing from the output.` });
  }
  for (const fact of unused) warnings.push({ kind: "added", type: fact.type, output: fact.value, message: `Output adds ${fact.type} “${fact.value}”.` });
  return { valid: warnings.length === 0, warnings };
}
