import { describe, expect, it } from "vitest";
import type { WritingEvent } from "../editor/eventTypes";
import { calculateSessionMetrics } from "./extractFeatures";

describe("writing metrics", () => {
  it("calculates known synthetic events", () => {
    const base = { sessionId: "s", source: "keyboard" as const };
    const events: WritingEvent[] = [
      { ...base, id: "1", sequence: 1, timestamp: 0, type: "insert", position: 0, text: "Hello world." },
      { ...base, id: "2", sequence: 2, timestamp: 500, type: "delete", position: 5, text: " world" },
      { ...base, id: "3", sequence: 3, timestamp: 3_000, type: "insert", position: 5, text: " there." },
    ];
    const metrics = calculateSessionMetrics(events, "Hello there.");
    expect(metrics.totalCharactersInserted).toBe(19);
    expect(metrics.totalCharactersDeleted).toBe(6);
    expect(metrics.finalWordCount).toBe(2);
    expect(metrics.medianInterInputIntervalMs).toBe(1_500);
    expect(metrics.medianBurstLength).toBe(9.5);
    expect(metrics.revisionCount).toBe(1);
  });
});
