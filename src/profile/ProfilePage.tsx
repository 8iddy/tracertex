import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Edit3, MousePointer2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { WriterProfile } from "../editor/eventTypes";
import { getLatestProfile } from "../storage/indexedDb";
import { Metric, Progress } from "../components/Metric";
import { useAuth } from "../auth/AuthContext";

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<WriterProfile>();
  useEffect(() => { void getLatestProfile().then(setProfile) }, []);
  if (!profile) return <div className="page narrow-page"><header className="page-header"><div><span className="eyebrow">What TracerText has learned</span><h1>Your Writer Profile</h1></div></header><div className="empty-state"><BookOpen size={30} /><h2>Your profile needs genuine writing</h2><p>Complete a calibration session to begin measuring your writing characteristics.</p><Link className="primary-button" to="/calibration">Start calibration <ArrowRight size={16} /></Link></div></div>;
  return <div className="page profile-page">
    <header className="page-header"><div><span className="eyebrow">{user?.onboardingStatus === "COMPLETE" ? "Core calibration complete · " : ""}Profile version {profile.version}</span><h1>Your Writer Profile</h1><p>A transparent summary of the writing behavior TracerText has actually observed.</p></div><div className="overall-confidence"><strong>{profile.confidence.overall}%</strong><span>profile maturity</span></div></header>
    <section className="profile-observation-strip" aria-label="Profile observations"><div><strong>{profile.sampleSessions}</strong><span>Sessions</span></div><div><strong>{profile.sampleWords.toLocaleString()}</strong><span>Words</span></div><div><strong>{profile.sampleEvents.toLocaleString()}</strong><span>Events</span></div></section>
    <section className="confidence-panel"><div className="section-heading"><div><h2>Profile maturity</h2><p>{profile.confidence.explanation}</p></div></div><div className="confidence-grid">{(["interaction", "linguistic", "composition"] as const).map((key) => <div key={key}><div><span>{key === "linguistic" ? "Language" : key[0]!.toUpperCase() + key.slice(1)}</span><strong>{profile.confidence[key]}%</strong></div><Progress value={profile.confidence[key]} /></div>)}</div></section>
    <div className="profile-sections"><section className="profile-section"><div className="profile-section-title"><MousePointer2 size={20} /><div><h2>Interaction Profile</h2><p>How you physically work with text</p></div></div><div className="metrics-grid compact"><Metric label="Median input interval" value={`${Math.round(profile.interaction.medianInputIntervalMs)} ms`} /><Metric label="Median pause" value={`${(profile.interaction.medianPauseMs / 1_000).toFixed(1)} sec`} /><Metric label="Median burst" value={`${Math.round(profile.interaction.medianBurstLength)} chars`} /><Metric label="Cursor-return rate" value={percent(profile.interaction.cursorReturnRate)} /><Metric label="Deletion rate" value={percent(profile.interaction.deletionRate)} /><Metric label="Replacement rate" value={percent(profile.interaction.replacementRate)} /></div></section>
      <section className="profile-section"><div className="profile-section-title"><BookOpen size={20} /><div><h2>Linguistic Profile</h2><p>Patterns in the writing you produce</p></div></div><div className="metrics-grid compact"><Metric label="Sentence length" value={`${profile.linguistic.meanSentenceWords.toFixed(1)} words`} /><Metric label="Paragraph length" value={`${profile.linguistic.meanParagraphWords.toFixed(1)} words`} /></div><div className="word-list"><span>Frequent language</span>{profile.linguistic.commonWords.slice(0, 8).map((item) => <i key={item.value}>{item.value} <small>{item.frequency}</small></i>)}</div></section>
      <section className="profile-section"><div className="profile-section-title"><Edit3 size={20} /><div><h2>Composition Profile</h2><p>How the document changes as you write</p></div></div><div className="metrics-grid compact"><Metric label="Sentence revisions" value={profile.composition.sentenceRevisionRate.toFixed(2)} detail="per sentence" /><Metric label="Paragraph revisions" value={profile.composition.paragraphRevisionRate.toFixed(2)} detail="per paragraph" /><Metric label="Expansion" value={percent(profile.composition.expansionRate)} /><Metric label="Compression" value={percent(profile.composition.compressionRate)} /></div></section></div>
  </div>;
}
