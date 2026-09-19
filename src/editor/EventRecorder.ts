import type { EventSource, WritingEvent } from "./eventTypes";
import { diffText } from "./sessionPlayback";

type EventSink = (events: WritingEvent[]) => Promise<void> | void;

export class EventRecorder {
  private sequence = 0;
  private previousDocument: string;
  private buffer: WritingEvent[] = [];
  private allEvents: WritingEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly sessionId: string,
    startingDocument: string,
    private readonly startedAtMs: number,
    private readonly sink?: EventSink,
    private readonly batchSize = 20,
  ) { this.previousDocument = startingDocument }

  recordDocument(nextDocument: string, source: EventSource = "unknown"): WritingEvent | null {
    const diff = diffText(this.previousDocument, nextDocument);
    if (!diff) return null;
    const base = this.base();
    let event: WritingEvent;
    if (!diff.removedText) {
      event = source === "paste"
        ? { ...base, type: "paste", position: diff.position, text: diff.insertedText, source }
        : { ...base, type: "insert", position: diff.position, text: diff.insertedText, source };
    } else if (!diff.insertedText) {
      event = { ...base, type: "delete", position: diff.position, text: diff.removedText, source };
    } else {
      event = { ...base, type: "replace", position: diff.position, removedText: diff.removedText, insertedText: diff.insertedText, source };
    }
    this.previousDocument = nextDocument;
    this.push(event);
    return event;
  }

  record(type: "focus" | "blur" | "undo" | "redo"): void { this.push({ ...this.base(), type }) }

  recordSelection(anchor: number, focus: number): void {
    const last = this.allEvents.at(-1);
    if (anchor === focus) {
      if (last?.type === "cursor" && last.position === anchor) return;
      this.push({ ...this.base(), type: "cursor", position: anchor });
    } else {
      this.push({ ...this.base(), type: "selection", anchor, focus });
    }
  }

  recordComposition(phase: "start" | "update" | "end", text: string, position: number): void {
    this.push({ ...this.base(), type: "composition", phase, text, position, source: "composition" });
  }

  checkpoint(document = this.previousDocument): void { this.push({ ...this.base(), type: "checkpoint", document }) }

  getEvents(): WritingEvent[] { return [...this.allEvents].sort((a, b) => a.sequence - b.sequence) }

  async flush(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    const batch = this.buffer.splice(0);
    if (batch.length && this.sink) await this.sink(batch);
  }

  private base() {
    return { id: crypto.randomUUID(), sessionId: this.sessionId, timestamp: Math.max(0, Date.now() - this.startedAtMs), sequence: ++this.sequence };
  }

  private push(event: WritingEvent): void {
    this.allEvents.push(event);
    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) void this.flush();
    else {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => void this.flush(), 1_000);
    }
  }
}
