export type BrainRegion =
  | "prefrontal"
  | "temporal"
  | "parietal"
  | "hippocampus";

export type ConceptStatus = "strong" | "due" | "overdue" | "fresh";

export interface TeachCard {
  id: string;
  conceptId: string;
  title: string;
  summary: string[];
  diagramMermaid?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  conceptIds: string[];
  synthesizesWith?: string;
}

export interface Concept {
  id: string;
  title: string;
  region: BrainRegion;
  /** 0–100 position inside region SVG viewBox */
  x: number;
  y: number;
  mastery: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  sourceId: string;
  status: ConceptStatus;
}

export interface Source {
  id: string;
  title: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface UserState {
  id: string;
  streak: number;
  xp: number;
  vitality: number;
}

export interface AtlasState {
  user: UserState;
  sources: Source[];
  concepts: Concept[];
  teachCards: TeachCard[];
  quizBank: QuizQuestion[];
  blindSpots: string[];
}

export interface TodayStepSourceRewind {
  type: "source_rewind";
  conceptId: string;
  conceptTitle: string;
  sourceTitle: string;
  sourceUrl: string;
  quote: string;
  hoursUntilCritical: number;
  status: ConceptStatus;
  mastery: number;
}

export interface TodayStepTeach {
  type: "teach";
  card: TeachCard;
  conceptTitle: string;
  hoursUntilCritical: number;
  status: ConceptStatus;
}

export interface TodayStepProbe {
  type: "probe";
  mode: "speed" | "standard";
  seconds: number;
  question: QuizQuestion;
}

export interface TodayStepFeynman {
  type: "feynman";
  conceptId: string;
  conceptTitle: string;
  prompt: string;
  keyPoints: string[];
}

export interface TodayStepExplainBack {
  type: "explain_back";
  conceptId: string;
  conceptTitle: string;
  prompt: string;
  keyPoints: string[];
}

export interface TodayStepQuiz {
  type: "quiz";
  mode: "synthesis" | "deep" | "standard";
  question: QuizQuestion;
}

export type TodayStep =
  | TodayStepSourceRewind
  | TodayStepTeach
  | TodayStepProbe
  | TodayStepFeynman
  | TodayStepExplainBack
  | TodayStepQuiz;

export interface TodayPath {
  id: string;
  title: string;
  steps: TodayStep[];
  dueTitles: string[];
  linkedPreview: { id: string; title: string }[];
}

export interface IngestRequest {
  title?: string;
  sourceUrl?: string;
  rawText: string;
}

export interface IngestResult {
  source: Source;
  concepts: Concept[];
  teachCards: TeachCard[];
  quizBank: QuizQuestion[];
  usedFixture: boolean;
  butterbaseSynced?: boolean;
  blindSpotsUsed?: string[];
}

export interface MistakeAutopsy {
  correctChoice: string;
  chosenChoice: string;
  whyCorrect: string;
  whyTempting: string;
  distractorNotes: string[];
}

export interface AnswerResult {
  ok: true;
  correct: boolean;
  xpGained: number;
  streak: number;
  vitality: number;
  autopsy?: MistakeAutopsy;
  reinforced: { id: string; title: string; mastery: number }[];
  linked: { id: string; title: string }[];
}

export interface NudgePayload {
  dueCount: number;
  weakestTitle: string | null;
  streak: number;
  vitality: number;
  title: string;
  message: string;
  todayUrl: string;
}
