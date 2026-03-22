export type ViewType =
  | 'dashboard'
  | 'create'
  | 'generating'
  | 'output'
  | 'home'
  | 'groups'
  | 'toolkit'
  | 'library';

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

export interface CreateAssignmentForm {
  title: string;
  dueDate: string;
  school: string;
  subject: string;
  classLevel: string;
  timeAllowed: string;
  questionTypes: QuestionType[];
  additionalInfo: string;
  fileName?: string;
  file?: File | null;
  sourceFile: SourceFile | null;
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

export interface User {
  id: string;
  name: string;
  email: string;
  school?: string;
  location?: string;
  avatar?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type AssignmentsResponse = ApiResponse<{
  assignments: Assignment[];
  total: number;
}>;

export type AssignmentResponse = ApiResponse<Assignment>;

export type GenerateResponse = ApiResponse<{
  jobId: string;
  assignmentId: string;
  status: GenerationJob['status'];
}>;

export type GeneratedPaperResponse = ApiResponse<GeneratedPaper[]>;

export interface JobStatusPayload {
  jobId: string;
  assignmentId: string;
  status: GenerationJob['status'];
  currentStep: number;
  totalSteps: number;
  result?: GeneratedPaper;
  error?: string;
}

export interface SocketEvents {
  'job:updated': JobStatusPayload;
  'job:completed': { jobId: string; result: GeneratedPaper };
  'job:failed': { jobId: string; error: string };
  'job:progress': { jobId: string; currentStep: number; totalSteps: number };
}

export interface AssignmentFilters {
  status?: 'all' | 'active' | 'completed' | 'draft';
  sortBy?: 'date' | 'title' | 'dueDate';
  order?: 'asc' | 'desc';
  search?: string;
}
