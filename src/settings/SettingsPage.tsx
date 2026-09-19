import { useEffect, useRef, useState } from "react";
import { Database, Download, HardDrive, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import type { TracerTextSettings } from "../editor/eventTypes";
import { downloadDataExport } from "../export/jsonExport";
import { clearAllData, getSettings, importAllData, saveSettings, validateExport } from "../storage/indexedDb";

export function SettingsPage() {
  const [settings, setSettings] = useState<TracerTextSettings>({ burstThresholdMs: 2_000, checkpointInterval: 25, syncSummaries: true });
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { void getSettings().then(setSettings) }, []);
  const update = async (next: TracerTextSettings) => { setSettings(next); await saveSettings(next); setMessage("Settings saved locally.") };
  const restore = async (selected?: File) => {
    if (!selected) return;
    try {
      const parsed: unknown = JSON.parse(await selected.text());
      if (!validateExport(parsed)) throw new Error("Unsupported export format");
      await importAllData(parsed); setMessage(`Restored ${parsed.sessions.length} sessions and ${parsed.profiles.length} profile versions.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not restore data.") }
  };
  const clear = async () => { if (window.confirm("Delete all local TracerText sessions, profiles, and settings? This cannot be undone unless you exported a backup.")) { await clearAllData(); setMessage("Local TracerText data deleted.") } };
  return <div className="page settings-page">
    <header className="page-header"><div><span className="eyebrow">Local data and behavior</span><h1>Settings</h1><p>TracerText is private by design. High-volume writing events stay in this browser by default.</p></div></header>
    {message && <div className="notice" role="status">{message}</div>}
    <section className="settings-section"><div className="section-heading"><div><h2>Where your data lives</h2><p>No analytics, advertising trackers, or public telemetry are included.</p></div><ShieldCheck size={22} /></div><div className="storage-rows"><div><HardDrive size={18} /><span><strong>Raw writing events</strong><small>Stored locally in IndexedDB</small></span><b>Local only</b></div><div><Database size={18} /><span><strong>Session summaries</strong><small>Saved locally; private D1 sync is attempted only when enabled and available</small></span><b>Local copy</b></div><div><Database size={18} /><span><strong>Writer Profile</strong><small>Saved locally; private D1 sync is attempted only when enabled and available</small></span><b>Local copy</b></div></div></section>
    <section className="settings-section"><h2>Recording</h2><label className="field-label">A writing burst ends after<select value={settings.burstThresholdMs} onChange={(event) => void update({ ...settings, burstThresholdMs: Number(event.target.value) })}><option value={1_000}>1 second</option><option value={2_000}>2 seconds</option><option value={3_000}>3 seconds</option><option value={5_000}>5 seconds</option></select></label><label className="toggle-row"><span><strong>Sync summaries</strong><small>Continue saving locally when the Worker is unavailable.</small></span><input type="checkbox" checked={settings.syncSummaries} onChange={(event) => void update({ ...settings, syncSummaries: event.target.checked })} /></label></section>
    <section className="settings-section"><h2>Data ownership</h2><p>The documented JSON export contains sessions, prompts, final documents, event histories, metrics, profile versions, and settings.</p><div className="button-row"><button className="primary-button" type="button" onClick={() => void downloadDataExport()}><Download size={16} />Export all TracerText data</button><button className="quiet-button" type="button" onClick={() => file.current?.click()}><Upload size={16} />Import TracerText data</button><input ref={file} type="file" accept="application/json,.json" hidden onChange={(event) => void restore(event.target.files?.[0])} /></div></section>
    <section className="settings-section danger-zone"><div><h2>Delete local data</h2><p>Remove all locally stored sessions, profiles, and settings from this browser.</p></div><button className="danger-button" type="button" onClick={() => void clear()}><RotateCcw size={16} />Delete local data</button></section>
  </div>;
}
