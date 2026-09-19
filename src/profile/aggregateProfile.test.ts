import { describe, expect, it } from "vitest";
import type { WritingSession } from "../editor/eventTypes";
import { aggregateWriterProfile } from "./aggregateProfile";
import { calculateSessionMetrics } from "./extractFeatures";

const makeSession = (id: string, text: string, taskType: WritingSession["taskType"]): WritingSession => ({ id, promptId: id, prompt: "Prompt", taskType, startedAt: new Date(0).toISOString(), completedAt: new Date(1).toISOString(), startingDocument: "", finalDocument: text, events: [{ id: `${id}-e`, sessionId: id, sequence: 1, timestamp: 100, type: "insert", position: 0, text, source: "keyboard" }], metrics: calculateSessionMetrics([{ id: `${id}-e`, sessionId: id, sequence: 1, timestamp: 100, type: "insert", position: 0, text, source: "keyboard" }], text) });

describe("profile aggregation", () => {
  it("combines multiple sessions and increments versions", () => {
    const profile = aggregateWriterProfile([makeSession("1", "One short sentence.", "personal"), makeSession("2", "Another sentence. It has a second part.", "explanation")]);
    expect(profile.sampleSessions).toBe(2);
    expect(profile.sampleWords).toBe(10);
    expect(profile.linguistic.meanSentenceWords).toBeCloseTo(10 / 3);
    expect(profile.confidence.overall).toBeLessThan(50);
    expect(aggregateWriterProfile([], profile).version).toBe(2);
  });
});
