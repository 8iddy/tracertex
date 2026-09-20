import type { CalibrationTaskType } from "../editor/eventTypes";

export interface CalibrationPrompt { id: string; taskType: CalibrationTaskType; label: string; prompt: string; guidance: string; startingDocument: string }

export const calibrationPrompts: CalibrationPrompt[] = [
  { id: "personal-yesterday", taskType: "personal", label: "Personal description", prompt: "Describe what you did yesterday. Write naturally and do not try to make the writing perfect.", guidance: "Aim for 150–200 words. Stop when the thought feels complete.", startingDocument: "" },
  { id: "explain-familiar", taskType: "explanation", label: "Explain something", prompt: "Explain an idea or subject you know well to someone who does not know much about it.", guidance: "Aim for 150–200 words. Clarity matters more than polish.", startingDocument: "" },
  { id: "argument-simple", taskType: "argument", label: "Make an argument", prompt: "Choose a simple claim that you agree or disagree with. Explain your position and why it matters.", guidance: "Aim for 150–200 words and follow your natural reasoning.", startingDocument: "" },
  { id: "revision-community", taskType: "revision", label: "Revise a paragraph", prompt: "Rewrite and develop the paragraph below until it says the same thing clearly and sounds like you.", guidance: "Aim for 150–200 words. Change as much or as little as you need; revision behavior is valuable to your profile.", startingDocument: "The meeting was held and there were many things that were discussed by all the people who came to it, and it was decided by everyone that the community garden project should probably be continued because it has benefits that are good for people in the area." },
];

// These prompts are deliberately separate from the initial four. Once core
// calibration is complete, continued sampling should broaden the profile rather
// than silently restart its required sequence.
export const optionalCalibrationPrompts: CalibrationPrompt[] = [
  { id: "reflection-turning-point", taskType: "personal", label: "Reflection", prompt: "Describe a decision or experience that changed how you approach something important.", guidance: "Aim for 150–200 words. Write in the voice you would use for yourself.", startingDocument: "" },
  { id: "technical-explanation", taskType: "explanation", label: "Technical explanation", prompt: "Explain a technical process, tool, or system to an intelligent reader who is new to it.", guidance: "Aim for 150–200 words. Prioritize the structure that feels natural to you.", startingDocument: "" },
  { id: "comparison-choice", taskType: "argument", label: "Comparison", prompt: "Compare two reasonable approaches to the same problem and explain which you would choose.", guidance: "Aim for 150–200 words. Make the trade-offs clear in your own way.", startingDocument: "" },
  { id: "recommendation-context", taskType: "argument", label: "Recommendation", prompt: "Recommend a practical course of action for a familiar situation and explain your reasoning.", guidance: "Aim for 150–200 words. Keep any qualifications you would naturally make.", startingDocument: "" },
  { id: "problem-analysis", taskType: "explanation", label: "Problem analysis", prompt: "Analyze a problem you have seen before: what is happening, why it matters, and what may help.", guidance: "Aim for 150–200 words. Use your natural level of detail and certainty.", startingDocument: "" },
  { id: "revision-clarity", taskType: "revision", label: "Revision", prompt: "Revise and develop the paragraph below so it is clearer while retaining its meaning.", guidance: "Aim for 150–200 words. This optional sample helps refine how TracerText recognizes your revisions.", startingDocument: "The proposal has several possible benefits, but the details have not yet been organized in a way that makes the decision easy for everyone involved." },
];

export function nextPrompt(currentId: string): CalibrationPrompt {
  const index = calibrationPrompts.findIndex((prompt) => prompt.id === currentId);
  return calibrationPrompts[(index + 1 + calibrationPrompts.length) % calibrationPrompts.length] ?? calibrationPrompts[0]!;
}

export function nextOptionalPrompt(currentId: string): CalibrationPrompt {
  const index = optionalCalibrationPrompts.findIndex((prompt) => prompt.id === currentId);
  return optionalCalibrationPrompts[(index + 1 + optionalCalibrationPrompts.length) % optionalCalibrationPrompts.length] ?? optionalCalibrationPrompts[0]!;
}
