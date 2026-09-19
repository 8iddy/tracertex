import type { WriterProfile, WritingSession } from "../editor/eventTypes";

export interface SyncResult { synced: boolean; reason?: string }

async function post(path: string, body: unknown): Promise<SyncResult> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return response.ok ? { synced: true } : { synced: false, reason: `HTTP ${response.status}` };
  } catch {
    return { synced: false, reason: "Offline; saved locally" };
  }
}

export function syncSessionSummary(session: WritingSession): Promise<SyncResult> {
  const { events: _events, ...summary } = session;
  void _events;
  return post("/api/sessions", { ...summary, eventCount: session.events.length });
}

export function syncWriterProfile(profile: WriterProfile): Promise<SyncResult> { return post("/api/profiles", profile) }
