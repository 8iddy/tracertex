export function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="metric"><span className="metric-label">{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return <div className="progress-wrap"><div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>{label && <small>{label}</small>}</div>;
}
