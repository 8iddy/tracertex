import type { WritingEvent } from "../editor/eventTypes";

export interface TimelineItem { sequence: number; timestamp: number; label: string }
const labelFor = (event: WritingEvent): string => {
  switch (event.type) {
    case "insert": return event.text.includes("\n") ? "New paragraph started" : "Text added";
    case "paste": return "Text pasted";
    case "delete": return event.text.length > 12 ? "Passage deleted" : "Text deleted";
    case "replace": return event.removedText.includes(".") || event.insertedText.includes(".") ? "Sentence revised" : "Phrase replaced";
    case "selection": return "Text selected";
    case "cursor": return "Cursor moved";
    case "undo": return "Change undone";
    case "redo": return "Change restored";
    case "focus": return "Writing resumed";
    case "blur": return "Writing paused";
    case "composition": return event.phase === "start" ? "Composition input began" : "Composition input updated";
    case "checkpoint": return "Document checkpoint saved";
  }
};

export function buildTimeline(events: WritingEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [{ sequence: 0, timestamp: 0, label: "Session started" }];
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    const label = labelFor(event);
    const previous = items.at(-1);
    if (previous?.label === label && event.timestamp - previous.timestamp < 3_000) continue;
    if (event.type === "cursor" && previous?.label === "Cursor moved") continue;
    items.push({ sequence: event.sequence, timestamp: event.timestamp, label });
  }
  return items;
}

export function formatElapsed(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
