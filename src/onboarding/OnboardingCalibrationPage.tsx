import { useAuth } from "../auth/AuthContext";
import { CalibrationPage } from "../calibration/CalibrationPage";

export function OnboardingCalibrationPage() {
  const { user } = useAuth();
  return <CalibrationPage key={user?.onboardingStep ?? 0} onboarding />;
}
