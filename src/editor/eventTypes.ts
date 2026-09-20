export type EventSource = "keyboard" | "paste" | "composition" | "history" | "unknown";

export interface BaseWritingEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  sequence: number;
}

interface TextMutation extends BaseWritingEvent {
  position: number;
  source: EventSource;
}

export interface InsertEvent extends TextMutation { type: "insert"; text: string }
export interface DeleteEvent extends TextMutation { type: "delete"; text: string }
export interface ReplaceEvent extends TextMutation { type: "replace"; removedText: string; insertedText: string }
export interface PasteEvent extends TextMutation { type: "paste"; text: string }
export interface SelectionEvent extends BaseWritingEvent { type: "selection"; anchor: number; focus: number }
export interface CursorEvent extends BaseWritingEvent { type: "cursor"; position: number }
export interface UndoEvent extends BaseWritingEvent { type: "undo" }
export interface RedoEvent extends BaseWritingEvent { type: "redo" }
export interface CompositionEvent extends TextMutation { type: "composition"; text: string; phase: "start" | "update" | "end" }
export interface FocusEvent extends BaseWritingEvent { type: "focus" | "blur" }
export interface CheckpointEvent extends BaseWritingEvent { type: "checkpoint"; document: string }

export type WritingEvent = InsertEvent | DeleteEvent | ReplaceEvent | PasteEvent | SelectionEvent | CursorEvent | UndoEvent | RedoEvent | CompositionEvent | FocusEvent | CheckpointEvent;

export type CalibrationTaskType = "personal" | "explanation" | "argument" | "revision";

export type OnboardingStatus = "NEW" | "CALIBRATION_IN_PROGRESS" | "INITIAL_PROFILE_READY" | "COMPLETE";

export interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  lastSeenAt?: string;
  onboardingStatus: OnboardingStatus;
  onboardingStep: number;
  onboardingCompletedAt?: string;
  activeProfileId?: string;
}

export interface PauseBucket {
  label: "< 500 ms" | "500 ms–1 s" | "1–2 s" | "2–5 s" | "5–10 s" | "> 10 s";
  count: number;
}

export interface PauseContextCounts {
  insideWord: number;
  betweenWords: number;
  afterComma: number;
  afterPunctuation: number;
  sentenceBoundary: number;
  paragraphBoundary: number;
}

export interface SessionMetrics {
  durationMs: number;
  totalCharactersInserted: number;
  totalCharactersDeleted: number;
  finalCharacterCount: number;
  finalWordCount: number;
  meanInterInputIntervalMs: number;
  medianInterInputIntervalMs: number;
  meanBurstLength: number;
  medianBurstLength: number;
  meanPauseMs: number;
  medianPauseMs: number;
  pauseDistribution: PauseBucket[];
  pauseContexts: PauseContextCounts;
  deletionRate: number;
  replacementRate: number;
  cursorReturnCount: number;
  selectionCount: number;
  undoCount: number;
  redoCount: number;
  sentenceCount: number;
  paragraphCount: number;
  meanSentenceWords: number;
  meanParagraphWords: number;
  revisionCount: number;
}

export interface WritingSession {
  id: string;
  userId?: string;
  promptId: string;
  prompt: string;
  taskType: CalibrationTaskType;
  startedAt: string;
  completedAt: string;
  startingDocument: string;
  finalDocument: string;
  events: WritingEvent[];
  metrics: SessionMetrics;
  /** Only genuine user-authored calibration is eligible to teach personal style. */
  styleEligible?: boolean;
}

export interface StyleFingerprint {
  id?: string;
  writerProfileId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceSessionIds: string[];
  sourceWordCount: number;
  statistics: {
    meanSentenceWords: number;
    sentenceLengthDistribution: number[];
    meanParagraphWords: number;
    paragraphLengthDistribution: number[];
    punctuationFrequency: Record<string, number>;
    transitionFrequency: Record<string, number>;
    hedgeFrequency: Record<string, number>;
    functionWordFrequency: Record<string, number>;
    sentenceOpeningPatterns: string[];
    commonPhrases: string[];
  };
  rhetoricalPatterns: {
    sentenceConstruction: string[];
    paragraphMovement: string[];
    qualificationPatterns: string[];
    argumentPatterns: string[];
    transitionPatterns: string[];
    lexicalPreferences: string[];
    avoidedPatterns: string[];
  };
  representativeExcerpts: Array<{ sessionId: string; taskType: CalibrationTaskType; text: string }>;
  confidence: { statistics: number; rhetoricalPatterns: number; exemplars: number; overall: number };
}

export interface FrequencyItem { value: string; frequency: number }

export interface WriterProfile {
  id?: string;
  userId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  sampleSessions: number;
  sampleWords: number;
  sampleEvents: number;
  interaction: {
    medianInputIntervalMs: number;
    inputIntervalDistribution: number[];
    medianBurstLength: number;
    burstLengthDistribution: number[];
    medianPauseMs: number;
    pauseDistribution: number[];
    deletionRate: number;
    replacementRate: number;
    cursorReturnRate: number;
    selectionRate: number;
    undoRate: number;
  };
  linguistic: {
    meanSentenceWords: number;
    sentenceLengthDistribution: number[];
    meanParagraphWords: number;
    paragraphLengthDistribution: number[];
    punctuationFrequency: Record<string, number>;
    commonWords: FrequencyItem[];
    commonPhrases: FrequencyItem[];
  };
  composition: {
    sentenceRevisionRate: number;
    paragraphRevisionRate: number;
    expansionRate: number;
    compressionRate: number;
    phraseReplacementRate: number;
  };
  confidence: {
    overall: number;
    interaction: number;
    linguistic: number;
    composition: number;
    explanation: string;
  };
}

export interface TracerTextSettings {
  burstThresholdMs: number;
  checkpointInterval: number;
  syncSummaries: boolean;
}

export interface TracerTextExport {
  format: "tracertext-export";
  schemaVersion: 1;
  exportedAt: string;
  sessions: WritingSession[];
  profiles: WriterProfile[];
  settings: TracerTextSettings;
}
