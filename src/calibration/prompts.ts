import type { CalibrationTaskType } from "../editor/eventTypes";

export interface CalibrationPrompt { id: string; taskType: CalibrationTaskType; label: string; prompt: string; guidance: string; startingDocument: string }

export const calibrationPrompts: CalibrationPrompt[] = [
  { id: "personal-yesterday", taskType: "personal", label: "Personal description", prompt: "Describe what you did yesterday. Write naturally and do not try to make the writing perfect.", guidance: "A useful sample is often 100–150 words. Stop when the thought feels complete.", startingDocument: "" },
  { id: "explain-familiar", taskType: "explanation", label: "Explain something", prompt: "Explain an idea or subject you know well to someone who does not know much about it.", guidance: "Aim for clarity, not polish. A useful sample is often 150–250 words.", startingDocument: "" },
  { id: "argument-simple", taskType: "argument", label: "Make an argument", prompt: "Choose a simple claim that you agree or disagree with. Explain your position and why it matters.", guidance: "Follow your natural reasoning. A useful sample is often 150–250 words.", startingDocument: "" },
  { id: "revision-community", taskType: "revision", label: "Revise a paragraph", prompt: "Rewrite the paragraph below until it says the same thing clearly and sounds like you.", guidance: "Change as much or as little as you need. Revision behavior is particularly valuable to your profile.", startingDocument: "The meeting was held and there were many things that were discussed by all the people who came to it, and it was decided by everyone that the community garden project should probably be continued because it has benefits that are good for people in the area." },
];

export function nextPrompt(currentId: string): CalibrationPrompt {
  const index = calibrationPrompts.findIndex((prompt) => prompt.id === currentId);
  return calibrationPrompts[(index + 1 + calibrationPrompts.length) % calibrationPrompts.length] ?? calibrationPrompts[0]!;
}
