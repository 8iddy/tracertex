import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, Lightbulb, Pause, Play, RefreshCcw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { WriterEditor } from "../editor/WriterEditor";
import type { EventSource, TracerTextSettings } from "../editor/eventTypes";
import { getSettings } from "../storage/indexedDb";
import { calibrationPrompts, nextPrompt, type CalibrationPrompt } from "./prompts";
import { createSession, finalizeSession } from "./sessionController";

export function CalibrationPage({ onboarding = false }: { onboarding?: boolean }) {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const initialPrompt = onboarding ? (calibrationPrompts[user?.onboardingStep ?? 0] ?? calibrationPrompts[0]!) : (calibrationPrompts.find((item) => item.id === searchParams.get("prompt")) ?? calibrationPrompts[0]!);
  const [prompt, setPrompt] = useState<CalibrationPrompt>(initialPrompt);
  const active = useMemo(() => createSession(prompt), [prompt]);
  const [text, setText] = useState(prompt.startingDocument);
  const [settings, setSettings] = useState<TracerTextSettings>({ burstThresholdMs: 2_000, checkpointInterval: 25, syncSummaries: true });
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const textEventCount = useRef(0);
  const navigate = useNavigate();
  useEffect(() => { void getSettings().then(setSettings) }, []);
  useEffect(() => {
    if (paused) return;
    const update = () => setElapsedMs(Date.now() - active.startedAtMs);
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [active.startedAtMs, paused]);

  const changePrompt = () => {
    if (text !== prompt.startingDocument && !window.confirm("Start a different prompt? This unfinished sample will be discarded.")) return;
    const next = nextPrompt(prompt.id);
    setPrompt(next); setText(next.startingDocument); textEventCount.current = 0;
  };
  const onTextChange = (next: string, source: EventSource) => {
    setText(next);
    if (active.recorder.recordDocument(next, source)) {
      textEventCount.current += 1;
      if (textEventCount.current % settings.checkpointInterval === 0) active.recorder.checkpoint(next);
    }
  };
  const finish = async () => {
    if (!text.trim()) return;
    setFinishing(true); setError(undefined);
    try {
      const session = await finalizeSession(active, text, settings.burstThresholdMs, onboarding || settings.syncSummaries);
      if (!onboarding) { navigate(`/calibration/results/${session.id}`); return }
      const updated = await refreshUser();
      if (updated.onboardingStatus === "INITIAL_PROFILE_READY") navigate("/onboarding/complete", { replace: true });
      else if (updated.onboardingStep > (user?.onboardingStep ?? 0)) navigate("/onboarding/calibration", { replace: true });
      else setError("This session is saved locally, but onboarding progress could not sync. Check the connection and try again.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not finish this session.") }
    finally { setFinishing(false) }
  };
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const elapsed = `${String(Math.floor(elapsedMs / 60_000)).padStart(2, "0")}:${String(Math.floor(elapsedMs / 1_000) % 60).padStart(2, "0")}`;

  return <div className={`calibration-page instrument-page${onboarding ? " onboarding-calibration" : ""}`}>
    <div className="calibration-lane">
    <div className="calibration-session-line"><span><i className="status-dot" />{onboarding ? `Initial calibration ${calibrationPrompts.findIndex((item) => item.id === prompt.id) + 1} of ${calibrationPrompts.length}` : `Calibration session ${String(calibrationPrompts.findIndex((item) => item.id === prompt.id) + 1).padStart(2, "0")} / ${String(calibrationPrompts.length).padStart(2, "0")}`}</span><span>{prompt.label}</span></div>
    <section className="prompt-panel">
      <div><span className="prompt-type"><Lightbulb size={14} />Assigned prompt</span><h2>{prompt.prompt}</h2><p>{prompt.guidance}</p></div>
      {!onboarding && <button className="quiet-button" type="button" onClick={changePrompt}><RefreshCcw size={15} />Different prompt</button>}
    </section>
    <WriterEditor key={prompt.id} minimal disabled={paused} initialText={prompt.startingDocument} onTextChange={onTextChange} onSelectionChange={(anchor, focus) => active.recorder.recordSelection(anchor, focus)} onFocusChange={(focused) => active.recorder.record(focused ? "focus" : "blur")} onComposition={(phase, value, position) => active.recorder.recordComposition(phase, value, position)} onHistory={(action) => active.recorder.record(action)} />
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="calibration-actions"><div className="session-readout"><span><Clock3 size={15} /><b>{elapsed}</b> elapsed</span><span className="readout-separator" /><span><b>{wordCount}</b> {wordCount === 1 ? "word" : "words"}</span>{!onboarding && <span className="saved-state"><Check size={13} />Saved locally</span>}</div><div className="session-buttons">{!onboarding && <button className="secondary-button" type="button" onClick={() => setPaused((value) => !value)}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? "Resume" : "Pause"}</button>}<button className="primary-button" type="button" disabled={!text.trim() || finishing} onClick={() => void finish()}><Check size={16} />{finishing ? "Finishing…" : "Finish Session"}</button></div></div>
    </div>
  </div>;
}
