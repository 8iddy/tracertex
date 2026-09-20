import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, LoaderCircle, PanelLeftClose, PanelLeftOpen, ShieldAlert, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { WriterProfile } from "../editor/eventTypes";
import { downloadDocx, downloadText } from "../export/textExport";
import { getLatestProfile } from "../storage/indexedDb";
import { compareProtectedFacts } from "../validation/compareProtectedFacts";
import { compareSemanticSignals } from "../validation/compareSemanticSignals";

interface TransformResponse { transformed?: string; error?: string }
const wordCount = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

export function WritePage() {
  const [profile, setProfile] = useState<WriterProfile>();
  const [draft, setDraft] = useState("");
  const [output, setOutput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { void getLatestProfile().then(setProfile) }, []);
  const validation = useMemo(() => output ? compareProtectedFacts(draft, output) : undefined, [draft, output]);
  const semanticWarnings = useMemo(() => output ? compareSemanticSignals(draft, output) : [], [draft, output]);
  const profileLabel = profile ? `Main Profile · ${profile.confidence.overall}% confidence` : "No Writer Profile yet";

  async function transform() {
    setLoading(true); setError(""); setCopied(false);
    try {
      const response = await fetch("/api/transform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft }) });
      const result = await response.json() as TransformResponse;
      if (!response.ok || !result.transformed) throw new Error(result.error || "TracerText could not transform this draft.");
      setOutput(result.transformed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "TracerText could not transform this draft.");
    } finally { setLoading(false) }
  }

  async function copyOutput() {
    await navigator.clipboard.writeText(output); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  const factStatus = validation?.valid ? "Preserved" : validation ? `${validation.warnings.length} warning${validation.warnings.length === 1 ? "" : "s"}` : "Not checked";
  const citationWarnings = validation?.warnings.filter((warning) => ["citation", "reference", "url", "quotation"].includes(warning.type)).length ?? 0;
  const reviewCount = (validation?.warnings.length ?? 0) + semanticWarnings.length;

  return <div className="write-workspace">
    <header className="write-ribbon"><div><span>Drafts /</span><strong>Untitled draft</strong><i className="status-dot" /><span className="write-profile">Writer Profile: <b>{profileLabel}</b></span></div><div className="write-ribbon-actions"><button type="button" className="view-toggle" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}{collapsed ? "Show Original" : "Focus Output"}</button><button type="button" className="primary-button" disabled={!draft.trim() || !profile || loading} onClick={() => void transform()}>{loading ? <LoaderCircle className="spin" size={16} /> : <WandSparkles size={16} />}{loading ? "Applying style…" : "Apply My Writing Style"}</button></div></header>
    {error && <p className="error-text">{error}</p>}
    <div className={`draft-grid${collapsed ? " original-collapsed" : ""}`}>
      {!collapsed && <section className="draft-pane source-pane"><header><div><span>Original Draft</span><b>{wordCount(draft)} {wordCount(draft) === 1 ? "word" : "words"}</b><small>Source</small></div><span>Original stays unchanged</span></header><textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Original draft" placeholder="Paste or type a completed draft here." /></section>}
      <section className="draft-pane output-pane"><header><div><span>TracerText Version</span><b>{wordCount(output)} {wordCount(output) === 1 ? "word" : "words"}</b><small>{output ? "Editable" : "Ready"}</small></div><span>{loading ? "Transforming with your profile" : output ? "Generated with Workers AI" : "Not generated"}</span></header>{output ? <textarea className="transformed-editor" value={output} onChange={(event) => setOutput(event.target.value)} aria-label="Transformed draft" /> : <div className="output-empty"><span><WandSparkles size={21} /></span><h1>Make it sound like you</h1><p>Paste a completed draft, then apply the sentence, paragraph, vocabulary, punctuation, phrasing, and composition patterns measured in your Writer Profile.</p>{profile ? <div className="profile-ready"><CheckCircle2 size={15} />Profile ready · {profile.confidence.overall}% confidence (informational)</div> : <Link className="secondary-button" to="/calibration">Build your Writer Profile</Link>}</div>}</section>
    </div>
    {output && reviewCount > 0 && <details className="validation-details"><summary>{reviewCount} item{reviewCount === 1 ? "" : "s"} to review</summary>{validation?.warnings.map((warning, index) => <p key={`fact-${index}`}>{warning.message}</p>)}{semanticWarnings.map((warning) => <p key={warning.category}>{warning.message}</p>)}</details>}
    <footer className="validation-strip"><div className="validation-items"><span className={validation?.valid ? "match-positive" : undefined}><FileText size={14} /><b>Protected facts</b>{factStatus}</span><span className={output && citationWarnings === 0 ? "match-positive" : undefined}><FileText size={14} /><b>Citations</b>{output ? citationWarnings ? `${citationWarnings} warnings` : "Preserved" : "Not checked"}</span><span className={reviewCount ? "review" : output ? "match-positive" : "review"}><ShieldAlert size={14} /><b>Semantic review</b>{output ? reviewCount ? `${reviewCount} warnings` : "No changes detected" : "Not checked"}</span></div><div className="export-actions"><span>Export</span><button disabled={!output} onClick={() => void copyOutput()}>{copied ? "Copied" : "Copy"}</button><button disabled={!output} onClick={() => downloadText(output, "txt")}>TXT</button><button disabled={!output} onClick={() => downloadText(output, "md")}>Markdown</button><button disabled={!output} onClick={() => void downloadDocx(output)}>DOCX</button></div></footer>
  </div>;
}
