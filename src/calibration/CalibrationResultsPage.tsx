import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileText, History, Keyboard, MousePointer2, Replace } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { WriterProfile, WritingSession } from "../editor/eventTypes";
import { getLatestProfile, getSession } from "../storage/indexedDb";
import { nextPrompt } from "./prompts";

const formatDuration = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};

export function CalibrationResultsPage() {
  const { id = "" } = useParams();
  const [session, setSession] = useState<WritingSession>();
  const [profile, setProfile] = useState<WriterProfile>();
  useEffect(() => { void Promise.all([getSession(id), getLatestProfile()]).then(([savedSession, latestProfile]) => { setSession(savedSession); setProfile(latestProfile) }) }, [id]);
  if (!session) return <div className="page"><div className="empty-state">Loading session results…</div></div>;
  const metrics = session.metrics;
  const replacements = session.events.filter((event) => event.type === "replace").length;
  const sentenceRevision = metrics.sentenceCount ? Math.min(1, metrics.revisionCount / metrics.sentenceCount) : 0;
  const next = nextPrompt(session.promptId);
  return <div className="page results-page">
    <div className="results-breadcrumb">Calibration / Completed session <span>Saved locally</span></div>
    <section className="results-hero"><span className="success-kicker"><CheckCircle2 size={15} />Writing Session recorded</span><h1>Calibration Session Completed</h1><p>{session.prompt}</p><div className="results-summary"><div><Clock3 size={16} /><span>Session duration<strong>{formatDuration(metrics.durationMs)}</strong></span></div><div><FileText size={16} /><span>Word count<strong>{metrics.finalWordCount}</strong></span></div><div><Keyboard size={16} /><span>Writing events<strong>{session.events.length.toLocaleString()}</strong></span></div></div></section>
    <div className="results-section-heading"><span>Writing measurements</span><small>Calculated from this recorded session</small></div>
    <section className="result-metric-grid">
      <article><span className="metric-index">Metric 01</span><h2>Typical Burst</h2><strong>{metrics.medianBurstLength.toFixed(1)} <small>characters</small></strong><p>Median text produced before an interval longer than the configured burst threshold.</p></article>
      <article><span className="metric-index">Metric 02</span><h2>Median Pause</h2><strong>{(metrics.medianPauseMs / 1_000).toFixed(1)} <small>seconds</small></strong><p>Median interval among pauses longer than the configured burst threshold.</p></article>
      <article><span className="metric-index">Metric 03</span><h2>Sentence Revision</h2><strong>{Math.round(sentenceRevision * 100)}<small>%</small></strong><p>{metrics.revisionCount} recorded deletions or replacements across {metrics.sentenceCount} final sentences.</p></article>
      <article><span className="metric-index">Metric 04</span><h2>Phrase Replacement</h2><strong>{replacements} <small>{replacements === 1 ? "replacement" : "replacements"}</small></strong><p>Direct replacements recorded while the document changed.</p><Replace size={17} /></article>
      <article><span className="metric-index">Metric 05</span><h2>Cursor Returns</h2><strong>{metrics.cursorReturnCount}</strong><p>Recorded cursor moves to positions earlier in the document.</p><MousePointer2 size={17} /></article>
      <article><span className="metric-index">Metric 06</span><h2>Deletion Rate</h2><strong>{Math.round(metrics.deletionRate * 100)}<small>%</small></strong><p>{metrics.totalCharactersDeleted} characters deleted relative to {metrics.totalCharactersInserted} inserted.</p></article>
    </section>
    <section className="profile-update-strip"><div><span>Writer Profile updated</span><h2>Measurements merged into Profile version {profile?.version ?? "—"}</h2><p>{profile?.confidence.explanation ?? "Profile confidence is calculated from recorded sessions."}</p></div><div><small>Profile confidence</small><strong>{profile?.confidence.overall ?? 0}%</strong></div></section>
    <footer className="results-actions"><p>Continue across different prompt types to improve profile confidence.</p><div><Link className="secondary-button" to={`/sessions/${session.id}`}><History size={16} />View Session</Link><Link className="primary-button" to={`/calibration?prompt=${next.id}`}>Continue Calibration <ArrowRight size={16} /></Link></div></footer>
  </div>;
}
