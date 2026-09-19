import { useEffect, useState } from "react";
import { ArrowRight, Clock3, FileText, Keyboard } from "lucide-react";
import { Link } from "react-router-dom";
import type { WritingSession } from "../editor/eventTypes";
import { getSessions } from "../storage/indexedDb";
import { generateSampleSession } from "../storage/sampleData";

const duration = (ms: number) => `${Math.max(1, Math.round(ms / 60_000))} min`;

export function SessionList() {
  const [sessions, setSessions] = useState<WritingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => void getSessions().then((value) => { setSessions(value); setLoading(false) });
  useEffect(load, []);
  const sample = async () => { await generateSampleSession(); load() };
  return <div className="page narrow-page">
    <header className="page-header"><div><span className="eyebrow">Genuine recordings only</span><h1>Session History</h1><p>Open a completed Writing Session to inspect its metrics and replay how the document developed.</p></div>{import.meta.env.DEV && <button className="quiet-button" type="button" onClick={() => void sample()}>Generate sample session</button>}</header>
    {loading ? <p className="empty-state">Loading local sessions…</p> : sessions.length === 0 ? <div className="empty-state"><Keyboard size={28} /><h2>No completed sessions yet</h2><p>Complete a calibration prompt to create your first genuine recording.</p><Link className="primary-button" to="/calibration">Start calibration <ArrowRight size={16} /></Link></div> : <div className="session-list">{sessions.map((session) => <Link to={`/sessions/${session.id}`} key={session.id} className="session-row"><div className="session-date"><strong>{new Date(session.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><small>{new Date(session.completedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></div><div className="session-main"><span className="task-pill">{session.taskType}</span><h2>{session.prompt}</h2><p>{session.finalDocument.slice(0, 150)}{session.finalDocument.length > 150 ? "…" : ""}</p></div><div className="session-stats"><span><FileText size={14} />{session.metrics.finalWordCount} words</span><span><Clock3 size={14} />{duration(session.metrics.durationMs)}</span><span>{session.events.length} events</span></div><ArrowRight className="row-arrow" size={18} /></Link>)}</div>}
  </div>;
}
