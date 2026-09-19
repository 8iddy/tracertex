interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object");
  return body as Record<string, unknown>;
}

async function saveSession(request: Request, env: Env): Promise<Response> {
  const body = await parseBody(request);
  const id = String(body.id ?? "");
  if (!id) return json({ error: "Session id is required" }, 400);
  const metrics = body.metrics && typeof body.metrics === "object" ? body.metrics as Record<string, unknown> : {};
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions (id, prompt_id, prompt, task_type, started_at, completed_at, final_word_count, final_character_count, event_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at, final_word_count=excluded.final_word_count, final_character_count=excluded.final_character_count, event_count=excluded.event_count`)
      .bind(id, String(body.promptId ?? ""), String(body.prompt ?? ""), String(body.taskType ?? ""), String(body.startedAt ?? ""), String(body.completedAt ?? ""), Number(metrics.finalWordCount ?? 0), Number(metrics.finalCharacterCount ?? 0), 0),
    env.DB.prepare(`INSERT INTO session_metrics (session_id, metrics_json, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(session_id) DO UPDATE SET metrics_json=excluded.metrics_json, updated_at=excluded.updated_at`).bind(id, JSON.stringify(metrics)),
  ]);
  return json({ ok: true, id }, 201);
}

async function saveProfile(request: Request, env: Env): Promise<Response> {
  const body = await parseBody(request);
  const version = Number(body.version ?? 0);
  if (!version) return json({ error: "Profile version is required" }, 400);
  await env.DB.prepare(`INSERT INTO writer_profiles (version, profile_json, sample_sessions, sample_words, sample_events, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(version) DO UPDATE SET profile_json=excluded.profile_json, updated_at=excluded.updated_at`)
    .bind(version, JSON.stringify(body), Number(body.sampleSessions ?? 0), Number(body.sampleWords ?? 0), Number(body.sampleEvents ?? 0), String(body.createdAt ?? ""), String(body.updatedAt ?? "")).run();
  return json({ ok: true, version }, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, phase: 1 });
      if (url.pathname === "/api/sessions" && request.method === "POST") return await saveSession(request, env);
      if (url.pathname === "/api/profiles" && request.method === "POST") return await saveProfile(request, env);
      if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
