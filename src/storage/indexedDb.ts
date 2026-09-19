import type { TracerTextExport, TracerTextSettings, WriterProfile, WritingEvent, WritingSession } from "../editor/eventTypes";

const DATABASE = "tracertext";
const VERSION = 2;
const DEFAULT_SETTINGS: TracerTextSettings = { burstThresholdMs: 2_000, checkpointInterval: 25, syncSummaries: true };
let activeLocalUserId: string | undefined;

const settingsKey = () => activeLocalUserId ? `app:${activeLocalUserId}` : "app";
const belongsToActiveUser = (record: { userId?: string }) => Boolean(activeLocalUserId && record.userId === activeLocalUserId);

export function getActiveLocalUserId(): string {
  if (!activeLocalUserId) throw new Error("An authenticated local user is required.");
  return activeLocalUserId;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const sessions = db.objectStoreNames.contains("sessions") ? request.transaction!.objectStore("sessions") : db.createObjectStore("sessions", { keyPath: "id" });
      const buffers = db.objectStoreNames.contains("eventBuffers") ? request.transaction!.objectStore("eventBuffers") : db.createObjectStore("eventBuffers", { keyPath: "sessionId" });
      const profiles = db.objectStoreNames.contains("profiles") ? request.transaction!.objectStore("profiles") : db.createObjectStore("profiles", { keyPath: "version" });
      if (!sessions.indexNames.contains("userId")) sessions.createIndex("userId", "userId", { unique: false });
      if (!buffers.indexNames.contains("userId")) buffers.createIndex("userId", "userId", { unique: false });
      if (!profiles.indexNames.contains("userId")) profiles.createIndex("userId", "userId", { unique: false });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setActiveLocalUser(userId: string): Promise<void> {
  activeLocalUserId = userId;
  const db = await openDatabase();
  const transaction = db.transaction(["sessions", "eventBuffers", "profiles", "settings"], "readwrite");
  for (const storeName of ["sessions", "eventBuffers", "profiles"] as const) {
    const store = transaction.objectStore(storeName);
    const records = await readRequest<Array<{ userId?: string }>>(store.getAll());
    for (const record of records) if (!record.userId) store.put({ ...record, userId });
  }
  const settings = transaction.objectStore("settings");
  const scoped = await readRequest<TracerTextSettings | undefined>(settings.get(settingsKey()));
  if (!scoped) {
    const legacy = await readRequest<TracerTextSettings | undefined>(settings.get("app"));
    if (legacy) settings.put(legacy, settingsKey());
  }
  await complete(transaction);
  db.close();
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
  const userId = getActiveLocalUserId();
  const db = await openDatabase();
  const transaction = db.transaction("eventBuffers", "readwrite");
  const store = transaction.objectStore("eventBuffers");
  const existing = await readRequest<{ sessionId: string; userId?: string; events: WritingEvent[] } | undefined>(store.get(sessionId));
  store.put({ sessionId, userId, events: [...(existing?.events ?? []), ...events] });
  await complete(transaction);
  db.close();
}

export async function saveSession(session: WritingSession): Promise<void> {
  const userId = getActiveLocalUserId();
  const db = await openDatabase();
  const transaction = db.transaction(["sessions", "eventBuffers"], "readwrite");
  transaction.objectStore("sessions").put({ ...session, userId });
  transaction.objectStore("eventBuffers").delete(session.id);
  await complete(transaction);
  db.close();
}

export async function getSessions(): Promise<WritingSession[]> {
  const db = await openDatabase();
  const result = await readRequest<WritingSession[]>(db.transaction("sessions").objectStore("sessions").getAll());
  db.close();
  return result.filter(belongsToActiveUser).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function getSession(id: string): Promise<WritingSession | undefined> {
  const db = await openDatabase();
  const result = await readRequest<WritingSession | undefined>(db.transaction("sessions").objectStore("sessions").get(id));
  db.close();
  return result && belongsToActiveUser(result) ? result : undefined;
}

export async function saveProfile(profile: WriterProfile): Promise<void> {
  const userId = getActiveLocalUserId();
  const db = await openDatabase();
  const transaction = db.transaction("profiles", "readwrite");
  transaction.objectStore("profiles").put({ ...profile, userId });
  await complete(transaction);
  db.close();
}

export async function getProfiles(): Promise<WriterProfile[]> {
  const db = await openDatabase();
  const profiles = await readRequest<WriterProfile[]>(db.transaction("profiles").objectStore("profiles").getAll());
  db.close();
  return profiles.filter(belongsToActiveUser).sort((a, b) => b.version - a.version);
}

export async function getLatestProfile(): Promise<WriterProfile | undefined> { return (await getProfiles())[0] }

export async function getSettings(): Promise<TracerTextSettings> {
  const db = await openDatabase();
  const settings = await readRequest<TracerTextSettings | undefined>(db.transaction("settings").objectStore("settings").get(settingsKey()));
  db.close();
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: TracerTextSettings): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("settings", "readwrite");
  transaction.objectStore("settings").put(settings, settingsKey());
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
  const userId = getActiveLocalUserId();
  for (const session of data.sessions) sessions.put({ ...session, userId });
  for (const profile of data.profiles) profiles.put({ ...profile, userId });
  transaction.objectStore("settings").put(data.settings, settingsKey());
  await complete(transaction);
  db.close();
}

export async function clearAllData(): Promise<void> {
  const userId = getActiveLocalUserId();
  const db = await openDatabase();
  const transaction = db.transaction(["sessions", "eventBuffers", "profiles", "settings"], "readwrite");
  for (const storeName of ["sessions", "eventBuffers", "profiles"] as const) {
    const store = transaction.objectStore(storeName);
    const keys = await readRequest<IDBValidKey[]>(store.index("userId").getAllKeys(userId));
    for (const key of keys) store.delete(key);
  }
  transaction.objectStore("settings").delete(settingsKey());
  await complete(transaction);
  db.close();
}
