import type { WritingEvent, WritingSession } from "../editor/eventTypes";
import { calculateSessionMetrics } from "../profile/extractFeatures";
import { aggregateWriterProfile } from "../profile/aggregateProfile";
import { getLatestProfile, getSessions, saveProfile, saveSession } from "./indexedDb";

export async function generateSampleSession(): Promise<WritingSession> {
  const sessionId = crypto.randomUUID();
  const final = "I start most mornings quietly, before the messages and small obligations begin to accumulate. That first hour is useful because I can follow an idea without having to defend it from interruptions.\n\nYesterday I used the time to revise a project note. I cut the opening paragraph, moved the practical example earlier, and added the detail I had been avoiding. The result was shorter, but it finally said what I meant.";
  const mutations = [
    { type: "insert", position: 0, text: "I start most mornings quietly, before the messages begin." },
    { type: "replace", position: 40, removedText: "messages begin", insertedText: "messages and small obligations begin to accumulate" },
    { type: "insert", position: 72, text: " That first hour is useful because I can follow an idea without interruptions." },
    { type: "replace", position: 126, removedText: "interruptions", insertedText: "having to defend it from interruptions" },
    { type: "insert", position: 162, text: "\n\nYesterday I used the time to revise a project note. I cut the opening paragraph, moved the practical example earlier, and added the detail I had been avoiding. The result was longer, but it finally said what I meant." },
    { type: "replace", position: 342, removedText: "longer", insertedText: "shorter" },
  ] as const;
  const events: WritingEvent[] = mutations.map((mutation, index) => ({ ...mutation, id: crypto.randomUUID(), sessionId, sequence: index + 1, timestamp: [3_100, 8_800, 18_200, 24_700, 38_600, 75_000][index]!, source: "keyboard" } as WritingEvent));
  events.push({ id: crypto.randomUUID(), sessionId, sequence: events.length + 1, timestamp: 76_000, type: "checkpoint", document: final });
  const session: WritingSession = { id: sessionId, promptId: "dev-sample", prompt: "Describe a part of your daily routine that helps you think clearly.", taskType: "personal", startedAt: new Date(Date.now() - 76_000).toISOString(), completedAt: new Date().toISOString(), startingDocument: "", finalDocument: final, events, metrics: calculateSessionMetrics(events, final) };
  await saveSession(session);
  const sessions = await getSessions();
  await saveProfile(aggregateWriterProfile(sessions, await getLatestProfile()));
  return session;
}
