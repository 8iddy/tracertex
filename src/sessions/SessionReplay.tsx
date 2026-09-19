import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { WritingEvent, WritingSession } from "../editor/eventTypes";
import { reconstructDocument } from "../editor/sessionPlayback";
import { formatElapsed } from "./timeline";

const speeds = [0.5, 1, 2, 5, 10] as const;

function eventDescription(event: WritingEvent | undefined, previous: WritingEvent | undefined): string {
  if (!event) return "Session start";
  const interval = event.timestamp - (previous?.timestamp ?? 0);
  if (interval > 2_000) return `Pause before event: ${(interval / 1_000).toFixed(1)}s`;
  if (event.type === "delete") return `Deletion: ${event.text.length} ${event.text.length === 1 ? "character" : "characters"}`;
  if (event.type === "replace") return `Phrase replacement: ${event.removedText.length} → ${event.insertedText.length} characters`;
  if (event.type === "paste") return `Paste: ${event.text.length} characters`;
  if (event.type === "cursor") return "Cursor movement";
  if (event.type === "selection") return "Text selection";
  if (event.type === "insert" && event.text.includes("\n")) return "Paragraph creation";
  if (event.type === "checkpoint") return "Document checkpoint";
  return event.type[0]!.toUpperCase() + event.type.slice(1);
}

export function SessionReplay({ session }: { session: WritingSession }) {
  const ordered = useMemo(() => [...session.events].sort((a, b) => a.sequence - b.sequence), [session.events]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const document = reconstructDocument(session.startingDocument, ordered.slice(0, index));
  const replayMatches = reconstructDocument(session.startingDocument, ordered) === session.finalDocument;
  const current = ordered[index - 1];
  const previous = ordered[index - 2];
  const markers = useMemo(() => ordered.map((event, eventIndex) => {
    const prior = ordered[eventIndex - 1];
    const pause = event.timestamp - (prior?.timestamp ?? 0) > 2_000;
    const kind = event.type === "delete" ? "delete" : event.type === "replace" ? "replace" : event.type === "insert" && event.text.includes("\n") ? "paragraph" : pause ? "pause" : null;
    return kind ? { sequence: event.sequence, kind, left: ordered.length > 1 ? (eventIndex / (ordered.length - 1)) * 100 : 0 } : null;
  }).filter((marker): marker is { sequence: number; kind: string; left: number } => marker !== null), [ordered]);

  useEffect(() => {
    if (!playing || index >= ordered.length) return;
    const next = ordered[index];
    const prior = ordered[index - 1];
    const naturalDelay = prior ? Math.max(25, next!.timestamp - prior.timestamp) : 50;
    timer.current = setTimeout(() => { setIndex((value) => value + 1); if (index + 1 >= ordered.length) setPlaying(false) }, Math.min(1_500, naturalDelay / speed));
    return () => { if (timer.current) clearTimeout(timer.current) };
  }, [index, ordered, playing, speed]);

  const restart = () => { setPlaying(false); setIndex(0) };
  const togglePlaying = () => { if (index >= ordered.length) setIndex(0); setPlaying((value) => !value) };
  const step = (amount: number) => { setPlaying(false); setIndex((value) => Math.max(0, Math.min(ordered.length, value + amount))) };
  const totalTime = session.metrics.durationMs;
  const currentTime = current?.timestamp ?? 0;

  return <section className="replay-panel">
    <div className="replay-stream-strip"><span><strong>Event {index.toLocaleString()}:</strong> {eventDescription(current, previous)}</span><span><i className="status-dot" />Recorded event stream</span></div>
    <div className="replay-document-wrap"><article className="replay-document"><div className="replay-document-stamp"><span>Writing Session</span><span>State at {formatElapsed(currentTime)}</span></div>{document ? <div className="replay-prose">{document}{playing && <span className="replay-caret" />}</div> : <span className="muted">The session begins with an empty document.</span>}<footer><span>{index === ordered.length ? "End of recorded session" : "Replay in progress"}</span><span>{document.trim() ? document.trim().split(/\s+/).length : 0} / {session.metrics.finalWordCount} words</span></footer></article></div>
    <div className="replay-instrument">
      <div className="replay-track-wrap"><div className="replay-track"><span className="replay-fill" style={{ width: `${ordered.length ? (index / ordered.length) * 100 : 0}%` }} />{markers.map((marker) => <i key={`${marker.sequence}-${marker.kind}`} className={`replay-marker ${marker.kind}`} style={{ left: `${marker.left}%` }} title={`${marker.kind} at event ${marker.sequence}`} />)}</div><input className="replay-scrubber" type="range" min={0} max={ordered.length} value={index} onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)) }} aria-label="Replay position" /></div>
      <div className="replay-legend"><strong>{formatElapsed(currentTime)} / {formatElapsed(totalTime)}</strong><span><i className="legend-pause" />Pause &gt;2s</span><span><i className="legend-delete" />Deletion</span><span><i className="legend-replace" />Replacement</span><span className={replayMatches ? "match-positive" : "match-negative"}>Replay match: {replayMatches ? "100%" : "mismatch"}</span></div>
      <div className="replay-controls"><div><button className="replay-button" type="button" onClick={restart}><RotateCcw size={15} />Restart</button><button className="icon-button" type="button" onClick={() => step(-1)} aria-label="Previous event"><ChevronLeft size={17} /></button><button className="replay-button primary" type="button" onClick={togglePlaying}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Play"}</button><button className="icon-button" type="button" onClick={() => step(1)} aria-label="Next event"><ChevronRight size={17} /></button></div><div className="speed-controls"><span>Velocity</span>{speeds.map((value) => <button type="button" className={speed === value ? "active" : ""} onClick={() => setSpeed(value)} key={value}>{value}×</button>)}</div></div>
    </div>
    {index === ordered.length && document !== session.finalDocument && <p className="error-text">Replay integrity check failed: the reconstructed document differs from the saved document.</p>}
  </section>;
}
