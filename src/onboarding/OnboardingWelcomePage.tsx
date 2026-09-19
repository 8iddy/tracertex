import { ArrowRight, NotebookPen } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function OnboardingWelcomePage() {
  const { beginOnboarding, user } = useAuth();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  const begin = async () => {
    setStarting(true); setError(undefined);
    try { await beginOnboarding(); navigate("/onboarding/calibration", { replace: true }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not begin calibration.") }
    finally { setStarting(false) }
  };
  return <main className="onboarding-shell"><section className="onboarding-card welcome-card">
    <div className="onboarding-brand"><span className="brand-mark"><NotebookPen size={19} /></span><span>TracerText</span><small>Private research build</small></div>
    <span className="eyebrow">First-run calibration</span>
    <h1>Welcome to TracerText</h1>
    <p className="onboarding-lead">Before TracerText can apply your writing style, it needs an initial sample of how you write.</p>
    <p>You will complete four short writing exercises.</p>
    <div className="onboarding-study"><span>TracerText studies</span><ul><li>sentence and paragraph patterns</li><li>revisions and replacements</li><li>typing rhythm and pauses</li><li>writing bursts</li><li>vocabulary and phrasing patterns</li></ul></div>
    <p className="privacy-line"><i className="status-dot" />Raw writing events stay local by default.</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="onboarding-footer"><small>Signed in as {user?.email}</small><button className="primary-button" type="button" disabled={starting} onClick={() => void begin()}>{starting ? "Starting…" : "Begin Calibration"}<ArrowRight size={16} /></button></div>
  </section></main>;
}
