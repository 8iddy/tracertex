import { useEffect, useState } from "react";
import { CheckCircle2, FileText, LockKeyhole, PanelLeftClose, PanelLeftOpen, ShieldAlert, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { WriterProfile } from "../editor/eventTypes";
import { getLatestProfile } from "../storage/indexedDb";

export function WritePage() {
  const [profile, setProfile] = useState<WriterProfile>();
  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { void getLatestProfile().then(setProfile) }, []);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const profileLabel = profile ? `Main Profile · ${profile.confidence.overall}% confidence` : "No Writer Profile yet";

  return <div className="write-workspace">
    <header className="write-ribbon"><div><span>Drafts /</span><strong>Untitled draft</strong><i className="status-dot" /><span className="write-profile">Writer Profile: <b>{profileLabel}</b></span></div><div className="write-ribbon-actions"><button type="button" className="view-toggle" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}{collapsed ? "Show Original" : "Focus Output"}</button><button type="button" className="primary-button" disabled title="Available in Phase 2"><WandSparkles size={16} />Apply My Writing Style</button></div></header>
    <div className={`draft-grid${collapsed ? " original-collapsed" : ""}`}>
      {!collapsed && <section className="draft-pane source-pane"><header><div><span>Original Draft</span><b>{words} {words === 1 ? "word" : "words"}</b><small>Source</small></div><span>Saved in this browser tab</span></header><textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Original draft" placeholder="Paste or type a completed draft here. Phase 2 will transform it without overwriting this original." /></section>}
      <section className="draft-pane output-pane"><header><div><span>TracerText Version</span><b>0 words</b><small>Phase 2</small></div><span>Not generated</span></header><div className="output-empty"><span><LockKeyhole size={21} /></span><h1>Personal transformation is not active yet</h1><p>The side-by-side workspace is ready, but TracerText will not create a result until the Phase 2 transformation and semantic-validation pipeline exists.</p>{profile ? <div className="profile-ready"><CheckCircle2 size={15} />Writer Profile available at {profile.confidence.overall}% confidence</div> : <Link className="secondary-button" to="/calibration">Build your Writer Profile</Link>}</div></section>
    </div>
    <footer className="validation-strip"><div className="validation-items"><span><FileText size={14} /><b>Numbers &amp; Data</b>Not checked</span><span><FileText size={14} /><b>Citations</b>Not checked</span><span className="review"><ShieldAlert size={14} /><b>Review</b>Transformation unavailable</span></div><div className="export-actions"><span>Export</span><button disabled>Copy</button><button disabled>TXT</button><button disabled>Markdown</button><button disabled>DOCX</button></div></footer>
  </div>;
}
