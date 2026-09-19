import { ArrowRight, CheckCircle2, FileText, Keyboard, Layers3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { WriterProfile } from "../editor/eventTypes";
import { getLatestProfile } from "../storage/indexedDb";

export function OnboardingCompletePage() {
  const { completeOnboarding } = useAuth();
  const [profile, setProfile] = useState<WriterProfile>();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  useEffect(() => { void getLatestProfile().then(setProfile) }, []);
  const finish = async () => {
    setFinishing(true); setError(undefined);
    try { await completeOnboarding(); navigate("/write", { replace: true }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not complete onboarding.") }
    finally { setFinishing(false) }
  };
  return <main className="onboarding-shell"><section className="onboarding-card completion-card">
    <span className="success-kicker"><CheckCircle2 size={15} />Four exercises completed</span>
    <h1>Initial Writer Profile ready</h1>
    <p className="onboarding-lead">TracerText has assembled its first evidence-based picture of how you write.</p>
    <div className="onboarding-metrics"><div><Layers3 size={17} /><span>Sessions observed<strong>{profile?.sampleSessions ?? 0}</strong></span></div><div><FileText size={17} /><span>Words observed<strong>{profile?.sampleWords.toLocaleString() ?? 0}</strong></span></div><div><Keyboard size={17} /><span>Writing events observed<strong>{profile?.sampleEvents.toLocaleString() ?? 0}</strong></span></div><div><CheckCircle2 size={17} /><span>Profile confidence<strong>{profile?.confidence.overall ?? 0}%</strong></span></div></div>
    <p>Your profile will keep improving as you record more genuine writing.</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="onboarding-footer"><span>Profile version {profile?.version ?? "—"}</span><button className="primary-button" type="button" disabled={finishing || !profile} onClick={() => void finish()}>{finishing ? "Opening…" : "Start Using TracerText"}<ArrowRight size={16} /></button></div>
  </section></main>;
}
