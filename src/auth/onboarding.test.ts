import { describe, expect, it } from "vitest";
import type { AppUser, WritingSession } from "../editor/eventTypes";
import { aggregateWriterProfile } from "../profile/aggregateProfile";
import { calculateSessionMetrics } from "../profile/extractFeatures";
import { markOnboardingComplete, progressForCompletedTasks, requiredRouteRedirect } from "./onboarding";

const user = (status: AppUser["onboardingStatus"], step: number): AppUser => ({ id: "user-1", email: "writer@example.com", createdAt: "2026-09-19T00:00:00.000Z", onboardingStatus: status, onboardingStep: step });
const makeSession = (taskType: WritingSession["taskType"], index: number): WritingSession => {
  const id = `session-${index}`;
  const text = `This is a genuine ${taskType} writing sample with enough words to measure.`;
  const events: WritingSession["events"] = [{ id: `${id}-event`, sessionId: id, sequence: 1, timestamp: 100, type: "insert", position: 0, text, source: "keyboard" }];
  return { id, userId: "user-1", promptId: taskType, prompt: "Prompt", taskType, startedAt: new Date(0).toISOString(), completedAt: new Date(1).toISOString(), startingDocument: "", finalDocument: text, events, metrics: calculateSessionMetrics(events, text) };
};

describe("onboarding state machine", () => {
  it("guards normal routes until onboarding is complete", () => {
    expect(requiredRouteRedirect(user("NEW", 0), "/write")).toBe("/onboarding");
    expect(requiredRouteRedirect(user("CALIBRATION_IN_PROGRESS", 2), "/write")).toBe("/onboarding/calibration");
    expect(requiredRouteRedirect(user("INITIAL_PROFILE_READY", 4), "/sessions")).toBe("/onboarding/complete");
  });

  it("resumes the current calibration route after refresh", () => {
    expect(requiredRouteRedirect(user("CALIBRATION_IN_PROGRESS", 2), "/onboarding/calibration")).toBeNull();
    expect(progressForCompletedTasks(["personal", "explanation"])).toEqual({ status: "CALIBRATION_IN_PROGRESS", step: 2 });
  });

  it("advances through all four required task types and produces an initial profile", () => {
    const tasks: WritingSession["taskType"][] = ["personal", "explanation", "argument", "revision"];
    expect(progressForCompletedTasks(tasks)).toEqual({ status: "INITIAL_PROFILE_READY", step: 4 });
    const profile = aggregateWriterProfile(tasks.map(makeSession));
    expect(profile.sampleSessions).toBe(4);
    expect(profile.sampleWords).toBeGreaterThan(0);
    expect(profile.sampleEvents).toBe(4);
  });

  it("keeps core completion separate from later profile maturity", () => {
    expect(progressForCompletedTasks(["personal", "explanation", "argument", "revision", "revision"])).toEqual({ status: "INITIAL_PROFILE_READY", step: 4 });
    expect(requiredRouteRedirect(user("COMPLETE", 4), "/calibration")).toBeNull();
  });

  it("switches a profile-ready user to COMPLETE", () => {
    expect(markOnboardingComplete(user("INITIAL_PROFILE_READY", 4), "2026-09-20T00:00:00.000Z")).toMatchObject({ onboardingStatus: "COMPLETE", onboardingStep: 4, onboardingCompletedAt: "2026-09-20T00:00:00.000Z" });
  });

  it("allows COMPLETE users to open Write and redirects them away from onboarding", () => {
    expect(requiredRouteRedirect(user("COMPLETE", 4), "/write")).toBeNull();
    expect(requiredRouteRedirect(user("COMPLETE", 4), "/onboarding")).toBe("/write");
  });
});
