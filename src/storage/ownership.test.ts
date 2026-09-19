import { beforeEach, describe, expect, it } from "vitest";
import type { WritingSession } from "../editor/eventTypes";
import { calculateSessionMetrics } from "../profile/extractFeatures";
import { getSessions, saveSession, setActiveLocalUser } from "./indexedDb";

const session = (id: string): WritingSession => {
  const text = `Writing sample ${id}.`;
  const events: WritingSession["events"] = [{ id: `${id}-event`, sessionId: id, sequence: 1, timestamp: 10, type: "insert", position: 0, text, source: "keyboard" }];
  return { id, promptId: id, prompt: "Prompt", taskType: "personal", startedAt: new Date(0).toISOString(), completedAt: new Date(1).toISOString(), startingDocument: "", finalDocument: text, events, metrics: calculateSessionMetrics(events, text) };
};

describe("local user ownership", () => {
  beforeEach(async () => { await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("tracertext"); request.onsuccess = () => resolve(); request.onerror = () => resolve() }) });

  it("returns only records owned by the active authenticated user", async () => {
    await setActiveLocalUser("user-a");
    await saveSession(session("a"));
    await setActiveLocalUser("user-b");
    await saveSession(session("b"));
    expect((await getSessions()).map((item) => item.id)).toEqual(["b"]);
    await setActiveLocalUser("user-a");
    expect((await getSessions()).map((item) => item.id)).toEqual(["a"]);
  });
});
