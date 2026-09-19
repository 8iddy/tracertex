import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { AuthBoundary } from "./auth/AuthBoundary";
import { AuthProvider } from "./auth/AuthContext";
import { CalibrationPage } from "./calibration/CalibrationPage";
import { CalibrationResultsPage } from "./calibration/CalibrationResultsPage";
import { AppShell } from "./components/AppShell";
import { OnboardingCalibrationPage } from "./onboarding/OnboardingCalibrationPage";
import { OnboardingCompletePage } from "./onboarding/OnboardingCompletePage";
import { OnboardingWelcomePage } from "./onboarding/OnboardingWelcomePage";
import { ProfilePage } from "./profile/ProfilePage";
import { SessionDetail } from "./sessions/SessionDetail";
import { SettingsPage } from "./settings/SettingsPage";
import { WritePage } from "./write/WritePage";

function AuthenticatedRoot() {
  return <AuthProvider><AuthBoundary /></AuthProvider>;
}

const router = createBrowserRouter([{ path: "/", element: <AuthenticatedRoot />, children: [
  { index: true, element: <Navigate to="/write" replace /> },
  { path: "onboarding", element: <OnboardingWelcomePage /> },
  { path: "onboarding/calibration", element: <OnboardingCalibrationPage /> },
  { path: "onboarding/complete", element: <OnboardingCompletePage /> },
  { element: <AppShell />, children: [
    { path: "write", element: <WritePage /> },
    { path: "calibration", element: <CalibrationPage /> },
    { path: "calibration/results/:id", element: <CalibrationResultsPage /> },
    { path: "sessions", element: <SessionDetail /> },
    { path: "sessions/:id", element: <SessionDetail /> },
    { path: "profile", element: <ProfilePage /> },
    { path: "settings", element: <SettingsPage /> },
  ] },
  { path: "*", element: <Navigate to="/write" replace /> },
]}]);

export default function App() { return <RouterProvider router={router} /> }
