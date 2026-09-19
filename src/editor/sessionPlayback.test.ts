import { describe, expect, it } from "vitest";
import type { WritingEvent } from "./eventTypes";
import { diffText, reconstructDocument } from "./sessionPlayback";

const event = (value: Partial<WritingEvent> & { type: WritingEvent["type"]; sequence: number }): WritingEvent => ({ id: `e${value.sequence}`, sessionId: "s1", timestamp: value.sequence * 100, ...value } as WritingEvent);

describe("event reconstruction", () => {
  it("reconstructs insert, delete, and replacement mutations", () => {
    const events: WritingEvent[] = [
      event({ type: "insert", sequence: 1, position: 0, text: "Hello", source: "keyboard" }),
      event({ type: "insert", sequence: 2, position: 5, text: " world", source: "keyboard" }),
      event({ type: "delete", sequence: 3, position: 5, text: " world", source: "keyboard" }),
      event({ type: "insert", sequence: 4, position: 5, text: " there", source: "keyboard" }),
    ];
    expect(reconstructDocument("", events)).toBe("Hello there");
  });

  it("uses sequence rather than timestamps and ends exactly on the final document", () => {
    const events: WritingEvent[] = [event({ type: "insert", sequence: 2, timestamp: 5, position: 5, text: " there", source: "keyboard" }), event({ type: "insert", sequence: 1, timestamp: 9, position: 0, text: "Hello", source: "keyboard" })];
    expect(reconstructDocument("", events)).toBe("Hello there");
  });

  it("finds a minimal replacement", () => expect(diffText("Hello world", "Hello there")).toEqual({ position: 6, removedText: "world", insertedText: "there" }));
});
