export type DifficultyLevel = 'Easy' | 'Moderate' | 'Challenging';

export interface SourceFile {
  name: string;
  type: string;
  size: number;
  extractedText?: string;
}

export interface QuestionType {
  id: string;
  type: string;
  difficulty: DifficultyLevel;
  count: number;
  marks: number;
}

export interface Question {
  id: number;
  text: string;
  difficulty: DifficultyLevel;
  marks: number;
}

export interface Section {
  id: string;
  title: string;
  subtitle: string;
  instructions: string;
  questions: Question[];
}

export interface Assignment {
  id: string;
  title: string;
  assignedDate: string;
  dueDate: string;
  school: string;
  subject: string;
  classLevel: string;
  timeAllowed: string;
  maxMarks: number;
  questionTypes: QuestionType[];
  additionalInfo: string;
  fileName?: string;
  fileUrl?: string;
  sourceFile?: SourceFile | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedPaper {
  id: string;
  assignmentId: string;
  school: string;
  subject: string;
  classLevel: string;
  timeAllowed: string;
  maxMarks: number;
  sections: Section[];
  answerKey: string[];
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  assignmentId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  steps: string[];
  currentStep: number;
  result?: GeneratedPaper;
  error?: string;
  createdAt: string;
}

export interface JobStatusPayload {
  jobId: string;
  assignmentId: string;
  status: GenerationJob['status'];
  currentStep: number;
  totalSteps: number;
  result?: GeneratedPaper;
  error?: string;
}
