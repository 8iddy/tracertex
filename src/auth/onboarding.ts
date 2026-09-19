import type { AppUser, CalibrationTaskType, OnboardingStatus } from "../editor/eventTypes";

export const REQUIRED_ONBOARDING_TASKS: CalibrationTaskType[] = ["personal", "explanation", "argument", "revision"];

export function onboardingPath(status: OnboardingStatus): string {
  if (status === "NEW") return "/onboarding";
  if (status === "CALIBRATION_IN_PROGRESS") return "/onboarding/calibration";
  if (status === "INITIAL_PROFILE_READY") return "/onboarding/complete";
  return "/write";
}

export function requiredRouteRedirect(user: AppUser, pathname: string): string | null {
  const target = onboardingPath(user.onboardingStatus);
  if (user.onboardingStatus !== "COMPLETE") return pathname === target ? null : target;
  return pathname.startsWith("/onboarding") || pathname === "/" ? "/write" : null;
}

export function progressForCompletedTasks(completed: CalibrationTaskType[]): { status: OnboardingStatus; step: number } {
  const completedSet = new Set(completed);
  let step = 0;
  while (step < REQUIRED_ONBOARDING_TASKS.length && completedSet.has(REQUIRED_ONBOARDING_TASKS[step]!)) step += 1;
  return { status: step === REQUIRED_ONBOARDING_TASKS.length ? "INITIAL_PROFILE_READY" : "CALIBRATION_IN_PROGRESS", step };
}

export function markOnboardingComplete(user: AppUser, completedAt: string): AppUser {
  if (user.onboardingStatus !== "INITIAL_PROFILE_READY") throw new Error("Initial calibration is not complete.");
  return { ...user, onboardingStatus: "COMPLETE", onboardingStep: REQUIRED_ONBOARDING_TASKS.length, onboardingCompletedAt: completedAt };
}
