import { assessSafety } from "./styleGuards";
import { movementTokens } from "./styleMovement";

/**
 * Minimal reversion repair. A recast that moved well but slipped on one claim
 * should not be thrown away, and asking the model again tends to return the
 * same slip. Instead the fewest possible sentences are put back to the source
 * wording so that every safety gate passes. Deterministic; no model call.
 */

interface Piece { text: string; paragraph: number; line: number }

function pieces(text: string): Piece[] {
  return text.split(/\n\s*\n/).flatMap((paragraph, paragraphIndex) => paragraph.split(/\n/).flatMap((line, lineIndex) =>
    line.split(/(?<=[.!?]["'”’)]?)\s+/u).map((part) => part.trim()).filter(Boolean).map((sentence) => ({ text: sentence, paragraph: paragraphIndex, line: lineIndex }))));
}

function render(list: Piece[]): string {
  let output = "";
  list.forEach((piece, index) => {
    const previous = list[index - 1];
    output += !previous ? "" : previous.paragraph !== piece.paragraph ? "\n\n" : previous.line !== piece.line ? "\n" : " ";
    output += piece.text;
  });
  return output;
}

const overlap = (a: Set<string>, b: Set<string>) => { let shared = 0; for (const token of a) if (b.has(token)) shared += 1; return (2 * shared) / Math.max(1, a.size + b.size); };
const hardFailures = (source: string, text: string) => { const report = assessSafety(source, text); return report.protectedFactFailures + report.protectedTermFailures + report.registerViolations + report.semanticHardFailures; };

export function repairBySentenceReversion(source: string, candidate: string): { text: string; revertedSentences: number } | undefined {
  const sourcePieces = pieces(source); const candidatePieces = pieces(candidate);
  if (!sourcePieces.length || !candidatePieces.length) return undefined;
  const sourceTokens = sourcePieces.map((piece) => new Set(movementTokens(piece.text)));
  // Each candidate sentence belongs to the source sentence it shares most with.
  const owner = candidatePieces.map((piece) => {
    const tokens = new Set(movementTokens(piece.text));
    return sourceTokens.reduce((best, candidateTokens, index) => overlap(tokens, candidateTokens) > overlap(tokens, sourceTokens[best]!) ? index : best, 0);
  });
  // A source sentence nothing maps to was merged into its neighbour, so it
  // travels with the previous sentence that does have a counterpart.
  const owned = new Set(owner);
  const unitOf: number[] = []; let unit = -1;
  sourcePieces.forEach((_, index) => { if (owned.has(index) || unit < 0) unit += 1; unitOf.push(unit); });
  const unitCount = unit + 1;

  const build = (reverted: Set<number>): string => {
    const emitted = new Set<number>(); const result: Piece[] = [];
    candidatePieces.forEach((piece, index) => {
      const pieceUnit = unitOf[owner[index]!]!;
      if (!reverted.has(pieceUnit)) { result.push(piece); return; }
      if (emitted.has(pieceUnit)) return;
      emitted.add(pieceUnit);
      sourcePieces.forEach((sourcePiece, sourceIndex) => { if (unitOf[sourceIndex] === pieceUnit) result.push({ text: sourcePiece.text, paragraph: piece.paragraph, line: piece.line }); });
    });
    return render(result);
  };

  if (hardFailures(source, candidate) === 0) return undefined;
  // Start from the source wording everywhere and put the candidate's sentences
  // back one unit at a time, keeping each only if the text stays safe. Several
  // offending sentences are handled as naturally as one.
  const reverted = new Set<number>(Array.from({ length: unitCount }, (_, index) => index));
  for (let index = 0; index < unitCount; index += 1) {
    const trial = new Set(reverted); trial.delete(index);
    if (hardFailures(source, build(trial)) === 0) reverted.delete(index);
  }
  if (reverted.size === unitCount || hardFailures(source, build(reverted)) > 0) return undefined;
  return { text: build(reverted), revertedSentences: sourcePieces.filter((_, index) => reverted.has(unitOf[index]!)).length };
}
