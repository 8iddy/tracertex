import { useEffect, useMemo, useState } from "react";
import { Clock3, FileText, Keyboard, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import type { WritingSession } from "../editor/eventTypes";
import { getSessions } from "../storage/indexedDb";
import { generateSampleSession } from "../storage/sampleData";
import { SessionReplay } from "./SessionReplay";

const duration = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};

export function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WritingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const load = () => void getSessions().then((items) => { setSessions(items); setLoading(false) });
  useEffect(load, []);
  const selected = sessions.find((session) => session.id === id) ?? sessions[0];
  const filtered = useMemo(() => sessions.filter((session) => `${session.prompt} ${session.taskType} ${session.finalDocument}`.toLowerCase().includes(query.toLowerCase())), [query, sessions]);
  const sample = async () => { const session = await generateSampleSession(); await getSessions().then(setSessions); navigate(`/sessions/${session.id}`) };

  if (loading) return <div className="page"><div className="empty-state">Loading local sessions…</div></div>;
  if (!selected) return <div className="page"><div className="empty-state"><Keyboard size={28} /><h2>No completed sessions yet</h2><p>Complete a calibration prompt to create a genuine recorded session.</p>{import.meta.env.DEV && <button className="secondary-button" type="button" onClick={() => void sample()}>Generate sample session</button>}</div></div>;

  return <div className="sessions-workspace">
    <aside className="sessions-ledger"><header><div><h1>Sessions</h1><span>{sessions.length} {sessions.length === 1 ? "record" : "records"}</span></div><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter sessions…" aria-label="Filter sessions" /></label></header><div className="ledger-list">{filtered.map((session) => <button type="button" onClick={() => navigate(`/sessions/${session.id}`)} className={`ledger-row${session.id === selected.id ? " active" : ""}`} key={session.id}><div><h2>{session.prompt}</h2><time>{new Date(session.completedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time></div><span className="task-pill">{session.taskType}</span><p><FileText size={12} />{session.metrics.finalWordCount} words <i /> <Clock3 size={12} />{duration(session.metrics.durationMs)}</p></button>)}</div><footer><span>Session archive</span><div><b>{sessions.length}</b> sessions</div><div><b>{sessions.reduce((sum, session) => sum + session.events.length, 0).toLocaleString()}</b> recorded events</div>{import.meta.env.DEV && <button type="button" onClick={() => void sample()}>Generate sample</button>}</footer></aside>
    <section className="session-inspector"><header className="session-inspector-header"><div><span className="session-title-kicker"><i className="status-dot" />{selected.taskType}</span><h1>{selected.prompt}</h1><p>{new Date(selected.completedAt).toLocaleString()} · {selected.events.length.toLocaleString()} recorded events</p></div><div className="session-summary"><span><FileText size={14} />{selected.metrics.finalWordCount} words</span><span><Clock3 size={14} />{duration(selected.metrics.durationMs)}</span></div></header><SessionReplay key={selected.id} session={selected} /></section>
  </div>;
}
