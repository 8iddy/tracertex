import { ChartNoAxesColumnIncreasing, Feather, History, NotebookPen, Settings, SlidersHorizontal, UserRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navigation = [
  { to: "/write", label: "Write", icon: Feather },
  { to: "/calibration", label: "Calibration", icon: SlidersHorizontal },
  { to: "/sessions", label: "Sessions", icon: History },
  { to: "/profile", label: "Profile", icon: ChartNoAxesColumnIncreasing },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user } = useAuth();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-block"><div className="brand"><span className="brand-mark"><NotebookPen size={19} /></span><span>TracerText</span></div><span className="build-label">0.1 / Research Build</span></div>
      <span className="nav-kicker">Instrument Core</span>
      <nav>{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="privacy-note"><span className="privacy-title">Storage</span><span><i className="status-dot" />Local First</span><small>Raw events stay on this device</small></div>
    </aside>
    <div className="workspace-column"><header className="workspace-header"><span>Workspace Engine</span><div><span className="local-badge"><i className="status-dot" />Local First</span><NavLink className="profile-glyph" to="/settings" aria-label={`Signed in as ${user?.email ?? "private user"}`} title={user?.email}><UserRound size={16} /></NavLink></div></header><main className="main-workspace"><Outlet /></main></div>
  </div>;
}
