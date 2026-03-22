import {
  Assignment,
  DifficultyLevel,
  GeneratedPaper,
  GenerationJob,
  JobStatusPayload,
  QuestionType,
  Section,
} from './types';
import { deleteCachePattern } from './redis/client';

interface DemoState {
  assignments: Assignment[];
  papersByAssignment: Record<string, GeneratedPaper[]>;
  jobs: Record<string, DemoJobState>;
}

interface DemoJobState extends GenerationJob {
  totalSteps: number;
}

const DEMO_STEPS = [
  'Analyzing assignment details...',
  'Structuring sections...',
  'Writing questions...',
  'Preparing answer key...',
  'Formatting output...',
];

const QUESTION_BANK: Record<string, string[]> = {
  Science: [
    'Define electroplating and explain one practical use.',
    'Why do ionic solutions conduct electricity?',
    'Describe one chemical effect of electric current seen in daily life.',
    'State one difference between electrolysis and electroplating.',
    'Write a balanced reaction for electrolysis of water.',
  ],
  English: [
    'Write a short character sketch of the protagonist.',
    'Identify the tone of the passage and justify your answer.',
    'Rewrite the sentence in passive voice.',
    'Answer in two sentences using textual evidence.',
    'Explain the meaning of the underlined idiom.',
  ],
  Mathematics: [
    'Solve the equation and verify your answer.',
    'Find the area of the given figure using a suitable formula.',
    'Represent the data on a bar graph.',
    'Simplify the expression step by step.',
    'Word problem: calculate the final value and show working.',
  ],
};

const difficultyInstruction: Record<DifficultyLevel, string> = {
  Easy: 'Attempt all questions.',
  Moderate: 'Show clear steps wherever needed.',
  Challenging: 'Give complete reasoning for each answer.',
};

const getDemoState = (): DemoState => {
  const globalWithDemoState = globalThis as typeof globalThis & { __vedaaiDemoState?: DemoState };

  if (!globalWithDemoState.__vedaaiDemoState) {
    globalWithDemoState.__vedaaiDemoState = {
      assignments: [],
      papersByAssignment: {},
      jobs: {},
    };
  }

  return globalWithDemoState.__vedaaiDemoState;
};

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeQuestionTypes = (questionTypes: QuestionType[]) =>
  questionTypes.map((questionType, index) => ({
    ...questionType,
    id: questionType.id || `question-type-${index + 1}`,
  }));

const getQuestionTemplates = (subject: string) => QUESTION_BANK[subject] ?? QUESTION_BANK.Science;

const buildSections = (assignment: Assignment): Section[] =>
  normalizeQuestionTypes(assignment.questionTypes).map((questionType, sectionIndex) => {
    const prompts = getQuestionTemplates(assignment.subject);
    const questions = Array.from({ length: questionType.count }, (_, questionIndex) => ({
      id: questionIndex + 1,
      text: prompts[(sectionIndex + questionIndex) % prompts.length],
      difficulty: questionType.difficulty,
      marks: questionType.marks,
    }));

    return {
      id: String.fromCharCode(65 + sectionIndex),
      title: `Section ${String.fromCharCode(65 + sectionIndex)}`,
      subtitle: questionType.type,
      instructions: difficultyInstruction[questionType.difficulty],
      questions,
    };
  });

const buildAnswerKey = (sections: Section[]) =>
  sections.flatMap((section) =>
    section.questions.map(
      (question, questionIndex) =>
        `${section.title} Q${questionIndex + 1}: Provide a concise, well-structured response for "${question.text}".`
    )
  );

export const buildPaperFromAssignment = (assignment: Assignment): GeneratedPaper => {
  const sections = buildSections(assignment);

  return {
    id: id('paper'),
    assignmentId: assignment.id,
    school: assignment.school,
    subject: assignment.subject,
    classLevel: assignment.classLevel,
    timeAllowed: assignment.timeAllowed,
    maxMarks: assignment.maxMarks,
    sections,
    answerKey: buildAnswerKey(sections),
    createdAt: new Date().toISOString(),
  };
};

export const getDemoAssignments = () => getDemoState().assignments;

export const getDemoAssignment = (assignmentId: string) =>
  getDemoState().assignments.find((assignment) => assignment.id === assignmentId) ?? null;

export const createDemoAssignment = (
  input: Omit<Assignment, 'id' | 'assignedDate' | 'createdAt' | 'updatedAt'>
): Assignment => {
  const state = getDemoState();
  const now = new Date().toISOString();
  const assignment: Assignment = {
    ...input,
    id: id('assignment'),
    assignedDate: now,
    createdAt: now,
    updatedAt: now,
  };

  state.assignments = [assignment, ...state.assignments];
  return assignment;
};

export const updateDemoAssignment = (assignmentId: string, updates: Partial<Assignment>) => {
  const state = getDemoState();
  const index = state.assignments.findIndex((assignment) => assignment.id === assignmentId);

  if (index === -1) {
    return null;
  }

  state.assignments[index] = {
    ...state.assignments[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return state.assignments[index];
};

export const deleteDemoAssignment = (assignmentId: string) => {
  const state = getDemoState();
  const nextAssignments = state.assignments.filter((assignment) => assignment.id !== assignmentId);
  const deleted = nextAssignments.length !== state.assignments.length;
  state.assignments = nextAssignments;
  delete state.papersByAssignment[assignmentId];
  void deleteCachePattern(`generated-papers:${assignmentId}`);
  return deleted;
};

export const getDemoPapersByAssignmentId = (assignmentId: string) =>
  getDemoState().papersByAssignment[assignmentId] ?? [];

const savePaper = (paper: GeneratedPaper) => {
  const state = getDemoState();
  const existing = state.papersByAssignment[paper.assignmentId] ?? [];
  state.papersByAssignment[paper.assignmentId] = [paper, ...existing];
  void deleteCachePattern(`generated-papers:${paper.assignmentId}`);
};

const finishDemoJob = (jobId: string) => {
  const state = getDemoState();
  const job = state.jobs[jobId];

  if (!job) {
    return;
  }

  const assignment = getDemoAssignment(job.assignmentId);
  if (!assignment) {
    state.jobs[jobId] = {
      ...job,
      status: 'failed',
      error: 'Assignment not found.',
    };
    return;
  }

  const paper = buildPaperFromAssignment(assignment);
  savePaper(paper);
  state.jobs[jobId] = {
    ...job,
    status: 'completed',
    currentStep: job.totalSteps,
    result: paper,
  };
};

const advanceDemoJob = (jobId: string) => {
  const state = getDemoState();
  const job = state.jobs[jobId];

  if (!job || job.status === 'completed' || job.status === 'failed') {
    return;
  }

  const nextStep = Math.min(job.currentStep + 1, job.totalSteps);
  state.jobs[jobId] = {
    ...job,
    status: nextStep >= job.totalSteps ? 'processing' : 'processing',
    currentStep: nextStep,
  };

  if (nextStep >= job.totalSteps) {
    finishDemoJob(jobId);
    return;
  }

  setTimeout(() => advanceDemoJob(jobId), 800);
};

export const createDemoGenerationJob = (assignmentId: string): DemoJobState => {
  const state = getDemoState();
  const job: DemoJobState = {
    id: id('job'),
    assignmentId,
    status: 'queued',
    steps: DEMO_STEPS,
    currentStep: 0,
    createdAt: new Date().toISOString(),
    totalSteps: DEMO_STEPS.length,
  };

  state.jobs[job.id] = job;
  setTimeout(() => advanceDemoJob(job.id), 500);

  return job;
};

export const getDemoJobStatus = (jobId: string): JobStatusPayload | null => {
  const job = getDemoState().jobs[jobId];

  if (!job) {
    return null;
  }

  return {
    jobId: job.id,
    assignmentId: job.assignmentId,
    status: job.status,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    result: job.result,
    error: job.error,
  };
};
