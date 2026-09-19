# TracerText

TracerText is a private, single-user writing environment that measures how its owner actually writes. Phase 1 records genuine writing sessions, derives deterministic writing metrics, builds a versioned Writer Profile, and replays only event histories that the application truly captured. It does not use an LLM.

The former AI-text detector implementation remains in `frontend/`, `backend/`, `gpu-worker/`, `ml/`, and `infra/` as legacy code. The active personal-writing application is at the repository root.

## Current phase

Phase 1 — writing capture foundation.

Implemented:

- Lexical rich-text calibration editor with restrained formatting
- four calibration task types, including revision
- mutation-first event recording with monotonic sequence numbers
- insert, delete, replace, paste, selection, cursor, focus, blur, undo, redo, composition, and checkpoint events
- in-memory batching to IndexedDB; no per-event network requests
- deterministic session metrics, pause buckets, pause contexts, and two-second burst definition
- persistent Session History, detail metrics, deterministic timeline, and replay at 0.5×–10×
- versioned Writer Profile with Interaction, Linguistic, and Composition sections
- transparent, conservative confidence scoring
- complete JSON export and matching restore
- development-only sample session generation
- Cloudflare Worker Static Assets and private D1 summary/profile synchronization
- initial D1 migration; raw events stay local
- deterministic protected-fact comparison prepared behind the Phase 2 boundary

The Write screen intentionally remains locked. Phase 2 will not start until real-browser Phase 1 acceptance has been completed.

## Architecture

```text
Lexical editor
  → EventRecorder memory buffer
  → IndexedDB (raw events + complete local sessions)
  → local metrics/profile aggregation
  → Cloudflare Worker API
  → D1 (summaries and profile versions only)
```

`sequence` is canonical for event ordering. Timestamps measure elapsed session time but never determine replay order. Checkpoints are explicit recovery states and make the final replay document verifiable.

Key directories:

- `src/editor/` — Lexical editor, event schema/recorder, deterministic replay
- `src/calibration/` — prompts and session lifecycle
- `src/profile/` — metric extraction, aggregation, confidence
- `src/sessions/` — history, details, timeline, replay controls
- `src/storage/` — IndexedDB, sync, development sample data
- `src/export/` — portable data export
- `src/validation/` — provider-independent Phase 2 validation primitives
- `worker/` — Cloudflare Worker API and static-asset entry point
- `migrations/` — versioned D1 schema

## Local development

Requirements: Node.js 20.19+ (or 22.12+) and npm.

```bash
npm install
npm run dev
```

The Vite application runs at `http://localhost:5173`. It works without the Worker; failed summary sync is non-blocking and all session data remains local.

For the complete local Worker and D1 environment:

```bash
npm run build
npm run db:migrate:local
npx wrangler dev
```

## Cloudflare configuration requiring owner action

1. Authenticate once with `npx wrangler login`.
2. Create the private database: `npx wrangler d1 create tracertext`.
3. Replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID.
4. Apply the migration: `npx wrangler d1 migrations apply tracertext --remote`.
5. Build and deploy: `npm run build && npx wrangler deploy`.
6. Protect the deployed application with Cloudflare Access before storing private writing summaries.

No R2 bucket or Workers AI binding is needed in Phase 1.

## Storage and privacy model

Raw event streams, source prompts, and final documents are stored in browser IndexedDB. D1 receives session metadata, aggregate metrics, and Writer Profile versions. Event streams are removed from the network payload before synchronization. There is no analytics package, tracking pixel, advertisement system, public profile, or custom authentication. Local development has no authentication; production access is expected to use Cloudflare Access.

The export format is a JSON object with `format: "tracertext-export"` and `schemaVersion: 1`. It includes sessions, prompts, documents, raw events, metrics, profile versions, and settings. Restore validates these markers before writing data.

## Writer Profile and confidence

Each completed session creates a new immutable profile version. The profile aggregates:

- Interaction: input timing, burst/pause distribution, deletion, replacement, cursor, selection, and undo rates.
- Linguistic: sentence and paragraph lengths, punctuation, common words, and common two-word phrases.
- Composition: revision, expansion, compression, and phrase-replacement rates.

Confidence is deterministic and deliberately conservative. Full confidence requires at least 8 sessions, all 4 task types, 3,000 words, 6,000 events, and 100 revisions. Interaction, language, and composition use only their relevant signals; overall is their arithmetic mean. The Profile screen shows the exact observed counts and thresholds.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run cf:check
```

Tests cover event reconstruction, replay ordering/finality, known synthetic metrics, multi-session aggregation, serialization, changed percentages, and missing citations.

## Current limitations

- Rich formatting is available while writing, but Phase 1 stores and replays the canonical plain-text document. Exact rich-text mark replay is deferred until after capture reliability is validated.
- Cursor offsets are currently captured at Lexical selection-node granularity and are descriptive; mutation events and checkpoints are authoritative for replay.
- IndexedDB is browser-profile specific. Use regular JSON exports for backups.
- D1 synchronization is one-way and summary-only; restoring a new browser requires a JSON export.
- Cloudflare Access configuration is external to this repository.
- Phase 1 includes no transformation, semantic validation call, DOCX handling, or LLM dependency.

## Future phases

The next milestone is Phase 1 acceptance testing in a real browser: complete each task type, edit earlier sentences, refresh, replay to exact final text, verify profile updates, and export/restore. Only after those checks pass should Phase 2 add the provider-independent transformation workflow, editable side-by-side output, deterministic and semantic validation, and TXT/Markdown/DOCX export.
