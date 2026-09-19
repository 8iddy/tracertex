import type { CalibrationPrompt } from "./prompts";
import type { WritingSession } from "../editor/eventTypes";
import { EventRecorder } from "../editor/EventRecorder";
import { calculateSessionMetrics } from "../profile/extractFeatures";
import { aggregateWriterProfile } from "../profile/aggregateProfile";
import { getLatestProfile, getSessions, saveEventBatch, saveProfile, saveSession } from "../storage/indexedDb";
import { syncSessionSummary, syncWriterProfile } from "../storage/sync";

export interface ActiveSession { id: string; startedAtMs: number; prompt: CalibrationPrompt; recorder: EventRecorder }

export function createSession(prompt: CalibrationPrompt): ActiveSession {
  const id = crypto.randomUUID();
  const startedAtMs = Date.now();
  return { id, startedAtMs, prompt, recorder: new EventRecorder(id, prompt.startingDocument, startedAtMs, (events) => saveEventBatch(id, events)) };
}

export async function finalizeSession(active: ActiveSession, finalDocument: string, burstThresholdMs: number, sync: boolean): Promise<WritingSession> {
  active.recorder.checkpoint(finalDocument);
  await active.recorder.flush();
  const events = active.recorder.getEvents();
  const session: WritingSession = {
    id: active.id,
    promptId: active.prompt.id,
    prompt: active.prompt.prompt,
    taskType: active.prompt.taskType,
    startedAt: new Date(active.startedAtMs).toISOString(),
    completedAt: new Date().toISOString(),
    startingDocument: active.prompt.startingDocument,
    finalDocument,
    events,
    metrics: calculateSessionMetrics(events, finalDocument, burstThresholdMs),
  };
  await saveSession(session);
  const sessions = await getSessions();
  const profile = aggregateWriterProfile(sessions, await getLatestProfile());
  await saveProfile(profile);
  if (sync) await Promise.all([syncSessionSummary(session), syncWriterProfile(profile)]);
  return session;
}
