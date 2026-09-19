import type { TracerTextExport, TracerTextSettings, WriterProfile, WritingEvent, WritingSession } from "../editor/eventTypes";

const DATABASE = "tracertext";
const VERSION = 1;
const DEFAULT_SETTINGS: TracerTextSettings = { burstThresholdMs: 2_000, checkpointInterval: 25, syncSummaries: true };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("eventBuffers")) db.createObjectStore("eventBuffers", { keyPath: "sessionId" });
      if (!db.objectStoreNames.contains("profiles")) db.createObjectStore("profiles", { keyPath: "version" });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) });
}

export async function saveEventBatch(sessionId: string, events: WritingEvent[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("eventBuffers", "readwrite");
  const store = transaction.objectStore("eventBuffers");
  const existing = await readRequest<{ sessionId: string; events: WritingEvent[] } | undefined>(store.get(sessionId));
  store.put({ sessionId, events: [...(existing?.events ?? []), ...events] });
  await complete(transaction);
  db.close();
}

export async function saveSession(session: WritingSession): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["sessions", "eventBuffers"], "readwrite");
  transaction.objectStore("sessions").put(session);
  transaction.objectStore("eventBuffers").delete(session.id);
  await complete(transaction);
  db.close();
}

export async function getSessions(): Promise<WritingSession[]> {
  const db = await openDatabase();
  const result = await readRequest<WritingSession[]>(db.transaction("sessions").objectStore("sessions").getAll());
  db.close();
  return result.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function getSession(id: string): Promise<WritingSession | undefined> {
  const db = await openDatabase();
  const result = await readRequest<WritingSession | undefined>(db.transaction("sessions").objectStore("sessions").get(id));
  db.close();
  return result;
}

export async function saveProfile(profile: WriterProfile): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("profiles", "readwrite");
  transaction.objectStore("profiles").put(profile);
  await complete(transaction);
  db.close();
}

export async function getProfiles(): Promise<WriterProfile[]> {
  const db = await openDatabase();
  const profiles = await readRequest<WriterProfile[]>(db.transaction("profiles").objectStore("profiles").getAll());
  db.close();
  return profiles.sort((a, b) => b.version - a.version);
}

export async function getLatestProfile(): Promise<WriterProfile | undefined> { return (await getProfiles())[0] }

export async function getSettings(): Promise<TracerTextSettings> {
  const db = await openDatabase();
  const settings = await readRequest<TracerTextSettings | undefined>(db.transaction("settings").objectStore("settings").get("app"));
  db.close();
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: TracerTextSettings): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("settings", "readwrite");
  transaction.objectStore("settings").put(settings, "app");
  await complete(transaction);
  db.close();
}

export async function exportAllData(): Promise<TracerTextExport> {
  return { format: "tracertext-export", schemaVersion: 1, exportedAt: new Date().toISOString(), sessions: await getSessions(), profiles: await getProfiles(), settings: await getSettings() };
}

export function validateExport(value: unknown): value is TracerTextExport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TracerTextExport>;
  return candidate.format === "tracertext-export" && candidate.schemaVersion === 1 && Array.isArray(candidate.sessions) && Array.isArray(candidate.profiles) && typeof candidate.settings === "object";
}

export async function importAllData(data: TracerTextExport): Promise<void> {
  if (!validateExport(data)) throw new Error("This is not a supported TracerText export.");
  const db = await openDatabase();
  const transaction = db.transaction(["sessions", "profiles", "settings"], "readwrite");
  const sessions = transaction.objectStore("sessions");
  const profiles = transaction.objectStore("profiles");
  for (const session of data.sessions) sessions.put(session);
  for (const profile of data.profiles) profiles.put(profile);
  transaction.objectStore("settings").put(data.settings, "app");
  await complete(transaction);
  db.close();
}

export async function clearAllData(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["sessions", "eventBuffers", "profiles", "settings"], "readwrite");
  for (const store of ["sessions", "eventBuffers", "profiles", "settings"]) transaction.objectStore(store).clear();
  await complete(transaction);
  db.close();
}
