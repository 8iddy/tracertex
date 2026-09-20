import type { AppUser, CalibrationTaskType } from "../src/editor/eventTypes";
import { progressForCompletedTasks } from "../src/auth/onboarding";
import { D1UserRepository, ensureApplicationUser, getVerifiedIdentity } from "./auth";
import { transformWithProfile } from "./styleTransformer";
import type { WriterProfile } from "../src/editor/eventTypes";

const REQUIRED_TASKS: CalibrationTaskType[] = ["personal", "explanation", "argument", "revision"];
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) throw new Error("Request body is too large");
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object");
  return body as Record<string, unknown>;
}

async function authenticatedUser(env: Env, ctx: ExecutionContext): Promise<AppUser | undefined> {
  const identity = await getVerifiedIdentity(ctx.access);
  if (!identity) return undefined;
  return ensureApplicationUser(new D1UserRepository(env.DB), identity, new Date().toISOString());
}

async function updateOnboardingProgress(env: Env, user: AppUser): Promise<void> {
  if (user.onboardingStatus !== "CALIBRATION_IN_PROGRESS") return;
  const rows = await env.DB.prepare("SELECT DISTINCT task_type FROM sessions WHERE user_id = ?").bind(user.id).all<{ task_type: CalibrationTaskType }>();
  const completed = rows.results.map((row) => row.task_type).filter((task): task is CalibrationTaskType => REQUIRED_TASKS.includes(task));
  const progress = progressForCompletedTasks(completed);
  await env.DB.prepare("UPDATE users SET onboarding_status = ?, onboarding_step = ? WHERE id = ?").bind(progress.status, progress.step, user.id).run();
}

async function saveSession(request: Request, env: Env, user: AppUser): Promise<Response> {
  const body = await parseBody(request);
  const id = String(body.id ?? "");
  const taskType = String(body.taskType ?? "") as CalibrationTaskType;
  if (!id) return json({ error: "Session id is required" }, 400);
  if (!REQUIRED_TASKS.includes(taskType)) return json({ error: "Unsupported calibration task type" }, 400);
  const metrics = body.metrics && typeof body.metrics === "object" ? body.metrics as Record<string, unknown> : {};
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions (id, user_id, prompt_id, prompt, task_type, started_at, completed_at, final_word_count, final_character_count, event_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at, final_word_count=excluded.final_word_count, final_character_count=excluded.final_character_count, event_count=excluded.event_count
      WHERE sessions.user_id=excluded.user_id`)
      .bind(id, user.id, String(body.promptId ?? ""), String(body.prompt ?? ""), taskType, String(body.startedAt ?? ""), String(body.completedAt ?? ""), Number(metrics.finalWordCount ?? 0), Number(metrics.finalCharacterCount ?? 0), Number(body.eventCount ?? 0)),
    env.DB.prepare(`INSERT INTO session_metrics (session_id, user_id, metrics_json, updated_at) VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET metrics_json=excluded.metrics_json, updated_at=excluded.updated_at WHERE session_metrics.user_id=excluded.user_id`)
      .bind(id, user.id, JSON.stringify(metrics)),
  ]);
  await updateOnboardingProgress(env, user);
  return json({ ok: true, id }, 201);
}

async function saveProfile(request: Request, env: Env, user: AppUser): Promise<Response> {
  const body = await parseBody(request);
  const version = Number(body.version ?? 0);
  if (!version) return json({ error: "Profile version is required" }, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO writer_profiles (id, user_id, version, profile_json, sample_sessions, sample_words, sample_events, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, version) DO UPDATE SET profile_json=excluded.profile_json, sample_sessions=excluded.sample_sessions, sample_words=excluded.sample_words, sample_events=excluded.sample_events, updated_at=excluded.updated_at`)
    .bind(id, user.id, version, JSON.stringify({ ...body, id, userId: user.id }), Number(body.sampleSessions ?? 0), Number(body.sampleWords ?? 0), Number(body.sampleEvents ?? 0), String(body.createdAt ?? ""), String(body.updatedAt ?? "")).run();
  const profile = await env.DB.prepare("SELECT id FROM writer_profiles WHERE user_id = ? AND version = ?").bind(user.id, version).first<{ id: string }>();
  if (profile) await env.DB.prepare("UPDATE users SET active_profile_id = ? WHERE id = ?").bind(profile.id, user.id).run();
  return json({ ok: true, version }, 201);
}

async function transformDraft(request: Request, env: Env, user: AppUser): Promise<Response> {
  const body = await parseBody(request);
  const draft = typeof body.draft === "string" ? body.draft.trim() : "";
  if (!draft) return json({ error: "A completed draft is required." }, 400);
  if (draft.length > 60_000) return json({ error: "Drafts must be 60,000 characters or fewer." }, 413);
  const row = await env.DB.prepare(`SELECT p.profile_json FROM writer_profiles p
    JOIN users u ON u.active_profile_id = p.id
    WHERE u.id = ? AND p.user_id = u.id`).bind(user.id).first<{ profile_json: string }>();
  if (!row) return json({ error: "Complete calibration to create an active Writer Profile." }, 409);
  const profile = JSON.parse(row.profile_json) as WriterProfile;
  const transformed = await transformWithProfile(env.AI, draft, profile);
  return json({ transformed, provider: "Cloudflare Workers AI", model: "@cf/google/gemma-4-26b-a4b-it", profileVersion: profile.version, profileConfidence: profile.confidence.overall });
}

async function startOnboarding(env: Env, user: AppUser): Promise<AppUser> {
  if (user.onboardingStatus !== "NEW") return user;
  await env.DB.prepare("UPDATE users SET onboarding_status = 'CALIBRATION_IN_PROGRESS', onboarding_step = 0 WHERE id = ?").bind(user.id).run();
  return { ...user, onboardingStatus: "CALIBRATION_IN_PROGRESS", onboardingStep: 0 };
}

async function completeOnboarding(env: Env, user: AppUser): Promise<AppUser | undefined> {
  if (user.onboardingStatus !== "INITIAL_PROFILE_READY") return undefined;
  const completedAt = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET onboarding_status = 'COMPLETE', onboarding_step = 4, onboarding_completed_at = ? WHERE id = ?").bind(completedAt, user.id).run();
  return { ...user, onboardingStatus: "COMPLETE", onboardingStep: 4, onboardingCompletedAt: completedAt };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, phase: 2 });
      if (url.pathname.startsWith("/api/")) {
        const user = await authenticatedUser(env, ctx);
        if (!user) return json({ error: "Cloudflare Access authentication is required." }, 401);
        if (url.pathname === "/api/me" && request.method === "GET") return json(user);
        if (url.pathname === "/api/onboarding/start" && request.method === "POST") return json(await startOnboarding(env, user));
        if (url.pathname === "/api/onboarding/complete" && request.method === "POST") {
          const completed = await completeOnboarding(env, user);
          return completed ? json(completed) : json({ error: "Complete all four calibration tasks first." }, 409);
        }
        if (url.pathname === "/api/sessions" && request.method === "POST") return await saveSession(request, env, user);
        if (url.pathname === "/api/profiles" && request.method === "POST") return await saveProfile(request, env, user);
        if (url.pathname === "/api/transform" && request.method === "POST") return await transformDraft(request, env, user);
        return json({ error: "Not found" }, 404);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      console.error(JSON.stringify({ message: "request failed", error: message, method: request.method, path: url.pathname }));
      return json({ error: "Unexpected server error." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
