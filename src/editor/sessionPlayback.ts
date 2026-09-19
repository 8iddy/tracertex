import type { WritingEvent } from "./eventTypes";

export function applyEvent(document: string, event: WritingEvent): string {
  switch (event.type) {
    case "insert":
    case "paste":
      return document.slice(0, event.position) + event.text + document.slice(event.position);
    case "delete":
      return document.slice(0, event.position) + document.slice(event.position + event.text.length);
    case "replace":
      return document.slice(0, event.position) + event.insertedText + document.slice(event.position + event.removedText.length);
    case "checkpoint":
      return event.document;
    default:
      return document;
  }
}

export function reconstructDocument(startingDocument: string, events: WritingEvent[], throughSequence = Number.POSITIVE_INFINITY): string {
  return [...events]
    .filter((event) => event.sequence <= throughSequence)
    .sort((a, b) => a.sequence - b.sequence)
    .reduce(applyEvent, startingDocument);
}

export interface TextDiff { position: number; removedText: string; insertedText: string }

export function diffText(before: string, after: string): TextDiff | null {
  if (before === after) return null;
  let start = 0;
  const shortest = Math.min(before.length, after.length);
  while (start < shortest && before[start] === after[start]) start += 1;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  return { position: start, removedText: before.slice(start, beforeEnd), insertedText: after.slice(start, afterEnd) };
}
