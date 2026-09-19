import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CalibrationPage } from "./calibration/CalibrationPage";
import { CalibrationResultsPage } from "./calibration/CalibrationResultsPage";
import { ProfilePage } from "./profile/ProfilePage";
import { SessionDetail } from "./sessions/SessionDetail";
import { SettingsPage } from "./settings/SettingsPage";
import { WritePage } from "./write/WritePage";

const router = createBrowserRouter([{ path: "/", element: <AppShell />, children: [
  { index: true, element: <Navigate to="/write" replace /> },
  { path: "write", element: <WritePage /> },
  { path: "calibration", element: <CalibrationPage /> },
  { path: "calibration/results/:id", element: <CalibrationResultsPage /> },
  { path: "sessions", element: <SessionDetail /> },
  { path: "sessions/:id", element: <SessionDetail /> },
  { path: "profile", element: <ProfilePage /> },
  { path: "settings", element: <SettingsPage /> },
  { path: "*", element: <Navigate to="/write" replace /> },
]}]);

export default function App() { return <RouterProvider router={router} /> }
