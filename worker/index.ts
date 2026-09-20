import type { AppUser, CalibrationTaskType } from "../src/editor/eventTypes";
import { progressForCompletedTasks } from "../src/auth/onboarding";
import { D1UserRepository, ensureApplicationUser, getVerifiedIdentity } from "./auth";
import { transformWithProfile } from "./styleTransformer";
import { buildStyleFingerprint } from "../src/profile/styleFingerprint";
import type { StyleFingerprint, WriterProfile, WritingSession } from "../src/editor/eventTypes";

const REQUIRED_TASKS: CalibrationTaskType[] = ["personal", "explanation", "argument", "revision"];
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });

async function synthesizeStyleSummary(ai: Ai, fingerprint: StyleFingerprint): Promise<StyleFingerprint["rhetoricalPatterns"] | undefined> {
  if (fingerprint.representativeExcerpts.length < 2) return undefined;
  const examples = fingerprint.representativeExcerpts.map((item, index) => `Example ${index + 1} (${item.taskType}):\n${item.text}`).join("\n\n");
  try {
    const result = await ai.run("@cf/google/gemma-4-26b-a4b-it", { messages: [{ role: "system", content: "Analyze observable writing behavior only. Never infer identity, personality, intelligence, demographics, politics, or psychology. Return compact JSON." }, { role: "user", content: `From these genuine samples, identify only evidence-supported, actionable writing tendencies. Do not repeat topic nouns. Return JSON with arrays named sentenceConstruction, paragraphMovement, qualificationPatterns, argumentPatterns, transitionPatterns, lexicalPreferences, avoidedPatterns.\n\n${examples}` }], chat_template_kwargs: { enable_thinking: false }, max_tokens: 700, temperature: 0.15 });
    const raw = typeof result === "object" && result && "response" in result && typeof result.response === "string" ? result.response : typeof result === "object" && result && "choices" in result && Array.isArray(result.choices) ? (result.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content : undefined;
    if (typeof raw !== "string") return undefined;
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as Partial<StyleFingerprint["rhetoricalPatterns"]>;
    const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
    return { sentenceConstruction: list(parsed.sentenceConstruction), paragraphMovement: list(parsed.paragraphMovement), qualificationPatterns: list(parsed.qualificationPatterns), argumentPatterns: list(parsed.argumentPatterns), transitionPatterns: list(parsed.transitionPatterns), lexicalPreferences: list(parsed.lexicalPreferences), avoidedPatterns: list(parsed.avoidedPatterns) };
  } catch { return undefined; }
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) throw new Error("Request body is too large");
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object");
  return body as Record<string, unknown>;
}

async function authenticatedUser(request: Request, env: Env, ctx: ExecutionContext): Promise<AppUser | undefined> {
  const identity = await getVerifiedIdentity(ctx.access, request, { audience: env.ACCESS_AUD, teamDomain: env.ACCESS_TEAM_DOMAIN });
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
    env.DB.prepare(`INSERT INTO sessions (id, user_id, prompt_id, prompt, task_type, started_at, completed_at, final_word_count, final_character_count, event_count, final_document, style_eligible, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at, final_word_count=excluded.final_word_count, final_character_count=excluded.final_character_count, event_count=excluded.event_count, final_document=excluded.final_document, style_eligible=excluded.style_eligible
      WHERE sessions.user_id=excluded.user_id`)
      .bind(id, user.id, String(body.promptId ?? ""), String(body.prompt ?? ""), taskType, String(body.startedAt ?? ""), String(body.completedAt ?? ""), Number(metrics.finalWordCount ?? 0), Number(metrics.finalCharacterCount ?? 0), Number(body.eventCount ?? 0), String(body.finalDocument ?? ""), body.styleEligible === false ? 0 : 1),
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
  if (profile) {
    const rows = await env.DB.prepare("SELECT id, prompt_id, prompt, task_type, started_at, completed_at, final_document, style_eligible FROM sessions WHERE user_id = ? AND style_eligible = 1 AND final_document IS NOT NULL AND length(final_document) > 0 ORDER BY completed_at DESC").bind(user.id).all<{ id: string; prompt_id: string; prompt: string; task_type: CalibrationTaskType; started_at: string; completed_at: string; final_document: string; style_eligible: number }>();
    const sessions: WritingSession[] = rows.results.map((row) => ({ id: row.id, userId: user.id, promptId: row.prompt_id, prompt: row.prompt, taskType: row.task_type, startedAt: row.started_at, completedAt: row.completed_at, startingDocument: "", finalDocument: row.final_document, events: [], metrics: { durationMs: 0, totalCharactersInserted: 0, totalCharactersDeleted: 0, finalCharacterCount: row.final_document.length, finalWordCount: row.final_document.trim().split(/\s+/).filter(Boolean).length, meanInterInputIntervalMs: 0, medianInterInputIntervalMs: 0, meanBurstLength: 0, medianBurstLength: 0, meanPauseMs: 0, medianPauseMs: 0, pauseDistribution: [], pauseContexts: { insideWord: 0, betweenWords: 0, afterComma: 0, afterPunctuation: 0, sentenceBoundary: 0, paragraphBoundary: 0 }, deletionRate: 0, replacementRate: 0, cursorReturnCount: 0, selectionCount: 0, undoCount: 0, redoCount: 0, sentenceCount: 0, paragraphCount: 0, meanSentenceWords: 0, meanParagraphWords: 0, revisionCount: 0 }, styleEligible: Boolean(row.style_eligible) }));
    const previous = await env.DB.prepare("SELECT fingerprint_json FROM style_fingerprints WHERE user_id = ? ORDER BY version DESC LIMIT 1").bind(user.id).first<{ fingerprint_json: string }>();
    const fingerprint = buildStyleFingerprint(sessions, { ...(body as unknown as WriterProfile), id: profile.id, userId: user.id }, previous ? JSON.parse(previous.fingerprint_json) as StyleFingerprint : undefined);
    // Higher-level labels remain evidence-bound and are cached with this fingerprint.
    fingerprint.rhetoricalPatterns = {
      sentenceConstruction: [fingerprint.statistics.meanSentenceWords > 20 ? "Develops ideas through connected clauses." : "Prefers relatively direct sentence construction."],
      paragraphMovement: [fingerprint.statistics.meanParagraphWords > 75 ? "Develops a point before moving to the next paragraph." : "Moves between compact, focused paragraphs."],
      qualificationPatterns: Object.keys(fingerprint.statistics.hedgeFrequency).length ? ["Uses observed qualification markers when appropriate."] : [],
      argumentPatterns: sessions.some((session) => session.taskType === "argument") ? ["Makes claims with explicit supporting reasons."] : [],
      transitionPatterns: Object.keys(fingerprint.statistics.transitionFrequency).length ? ["Uses observed transitions selectively."] : [], lexicalPreferences: [], avoidedPatterns: ["Does not imitate accidental typos or topic-specific nouns."],
    };
    const synthesized = await synthesizeStyleSummary(env.AI, fingerprint);
    if (synthesized) fingerprint.rhetoricalPatterns = synthesized;
    fingerprint.confidence.rhetoricalPatterns = synthesized ? fingerprint.confidence.statistics : 0;
    fingerprint.confidence.overall = Math.round((fingerprint.confidence.statistics + fingerprint.confidence.exemplars + fingerprint.confidence.rhetoricalPatterns) / 3);
    const fingerprintId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO style_fingerprints (id, user_id, writer_profile_id, version, fingerprint_json, source_session_count, source_word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(fingerprintId, user.id, profile.id, fingerprint.version, JSON.stringify({ ...fingerprint, id: fingerprintId, writerProfileId: profile.id }), fingerprint.sourceSessionIds.length, fingerprint.sourceWordCount, fingerprint.createdAt, fingerprint.updatedAt).run();
  }
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
  const fingerprintRow = await env.DB.prepare("SELECT fingerprint_json FROM style_fingerprints WHERE user_id = ? ORDER BY version DESC LIMIT 1").bind(user.id).first<{ fingerprint_json: string }>();
  let result;
  try { result = await transformWithProfile(env.AI, draft, profile, fingerprintRow ? JSON.parse(fingerprintRow.fingerprint_json) as StyleFingerprint : undefined); }
  catch (error) {
    const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "GENERATION_FAILED";
    console.error(JSON.stringify({ message: "transformation failed", code, userId: user.id }));
    return json({ error: "We couldn’t complete this transformation. Your original draft is unchanged. Please try again.", code }, 422);
  }
  return json({ transformed: result.transformed, provider: "Cloudflare Workers AI", model: "@cf/google/gemma-4-26b-a4b-it", profileVersion: profile.version, profileConfidence: profile.confidence.overall, candidateScores: result.scores.map((score) => ({ meaning: score.meaning, style: score.style, fluency: score.fluency, total: score.total, valid: score.valid, warnings: score.warnings })), retried: result.retried });
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
        const user = await authenticatedUser(request, env, ctx);
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
