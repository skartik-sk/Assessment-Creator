import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Assignment,
  CreateAssignmentForm,
  GeneratedPaper,
  GenerationJob,
  QuestionType,
  ViewType,
} from '@/types';

interface AppStore {
  currentView: ViewType;
  viewHistory: ViewType[];
  setCurrentView: (view: ViewType) => void;
  goBack: () => void;

  assignments: Assignment[];
  hasAssignments: boolean;
  setAssignments: (assignments: Assignment[]) => void;
  addAssignment: (assignment: Assignment) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  setHasAssignments: (value: boolean) => void;

  createForm: CreateAssignmentForm;
  setCreateFormField: <K extends keyof CreateAssignmentForm>(
    field: K,
    value: CreateAssignmentForm[K]
  ) => void;
  updateQuestionType: (id: string, field: keyof QuestionType, delta: number) => void;
  replaceQuestionType: (id: string, updates: Partial<QuestionType>) => void;
  removeQuestionType: (id: string) => void;
  addQuestionType: () => void;
  resetCreateForm: () => void;

  generatedPaper: GeneratedPaper | null;
  papersByAssignment: Record<string, GeneratedPaper[]>;
  setGeneratedPaper: (paper: GeneratedPaper | null) => void;
  setGeneratedPapers: (assignmentId: string, papers: GeneratedPaper[]) => void;
  upsertGeneratedPaper: (paper: GeneratedPaper) => void;

  currentJob: GenerationJob | null;
  setCurrentJob: (job: GenerationJob | null) => void;
  updateJobStep: (step: number) => void;
  setJobStatus: (status: GenerationJob['status'], result?: GeneratedPaper, error?: string) => void;

  isLoading: boolean;
  isGenerating: boolean;
  sidebarOpen: boolean;
  filterSearch: string;
  setIsLoading: (value: boolean) => void;
  setIsGenerating: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
  setFilterSearch: (value: string) => void;
}

const defaultQuestionTypes = (): QuestionType[] => [
  {
    id: 'mcq',
    type: 'Multiple Choice Questions',
    difficulty: 'Easy',
    count: 4,
    marks: 1,
  },
  {
    id: 'short',
    type: 'Short Questions',
    difficulty: 'Moderate',
    count: 3,
    marks: 2,
  },
];

const createInitialForm = (): CreateAssignmentForm => ({
  title: '',
  dueDate: '',
  school: 'Delhi Public School',
  subject: 'Science',
  classLevel: '8th',
  timeAllowed: '45 minutes',
  questionTypes: defaultQuestionTypes(),
  additionalInfo: '',
  fileName: '',
  file: null,
  sourceFile: null,
});

const syncAssignments = (assignments: Assignment[]) => ({
  assignments,
  hasAssignments: assignments.length > 0,
});

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      currentView: 'dashboard',
      viewHistory: [],
      setCurrentView: (view) =>
        set((state) => ({
          currentView: view,
          viewHistory: [...state.viewHistory, state.currentView],
        })),
      goBack: () =>
        set((state) => {
          const history = [...state.viewHistory];
          const previousView = history.pop() ?? 'dashboard';
          return {
            currentView: previousView,
            viewHistory: history,
          };
        }),

      assignments: [],
      hasAssignments: false,
      setAssignments: (assignments) => set(syncAssignments(assignments)),
      addAssignment: (assignment) =>
        set((state) => syncAssignments([assignment, ...state.assignments])),
      updateAssignment: (id, updates) =>
        set((state) =>
          syncAssignments(
            state.assignments.map((assignment) =>
              assignment.id === id ? { ...assignment, ...updates, updatedAt: new Date().toISOString() } : assignment
            )
          )
        ),
      deleteAssignment: (id) =>
        set((state) => syncAssignments(state.assignments.filter((assignment) => assignment.id !== id))),
      setHasAssignments: (value) =>
        set((state) => ({
          hasAssignments: value,
          assignments: value ? state.assignments : [],
        })),

      createForm: createInitialForm(),
      setCreateFormField: (field, value) =>
        set((state) => ({
          createForm: {
            ...state.createForm,
            [field]: value,
          },
        })),
      updateQuestionType: (id, field, delta) =>
        set((state) => ({
          createForm: {
            ...state.createForm,
            questionTypes: state.createForm.questionTypes.map((questionType) => {
              if (questionType.id !== id || (field !== 'count' && field !== 'marks')) {
                return questionType;
              }

              return {
                ...questionType,
                [field]: Math.max(1, questionType[field] + delta),
              };
            }),
          },
        })),
      replaceQuestionType: (id, updates) =>
        set((state) => ({
          createForm: {
            ...state.createForm,
            questionTypes: state.createForm.questionTypes.map((questionType) =>
              questionType.id === id ? { ...questionType, ...updates } : questionType
            ),
          },
        })),
      removeQuestionType: (id) =>
        set((state) => ({
          createForm: {
            ...state.createForm,
            questionTypes:
              state.createForm.questionTypes.length === 1
                ? state.createForm.questionTypes
                : state.createForm.questionTypes.filter((questionType) => questionType.id !== id),
          },
        })),
      addQuestionType: () =>
        set((state) => ({
          createForm: {
            ...state.createForm,
            questionTypes: [
              ...state.createForm.questionTypes,
              {
                id: `question-type-${Date.now()}`,
                type: 'Long Questions',
                difficulty: 'Challenging',
                count: 2,
                marks: 5,
              },
            ],
          },
        })),
      resetCreateForm: () => set({ createForm: createInitialForm() }),

      generatedPaper: null,
      papersByAssignment: {},
      setGeneratedPaper: (paper) => set({ generatedPaper: paper }),
      setGeneratedPapers: (assignmentId, papers) =>
        set((state) => ({
          papersByAssignment: {
            ...state.papersByAssignment,
            [assignmentId]: papers,
          },
          generatedPaper: papers[0] ?? state.generatedPaper,
        })),
      upsertGeneratedPaper: (paper) =>
        set((state) => {
          const existing = state.papersByAssignment[paper.assignmentId] ?? [];
          const nextPapers = [paper, ...existing.filter((item) => item.id !== paper.id)];

          return {
            generatedPaper: paper,
            papersByAssignment: {
              ...state.papersByAssignment,
              [paper.assignmentId]: nextPapers,
            },
          };
        }),

      currentJob: null,
      setCurrentJob: (job) => set({ currentJob: job }),
      updateJobStep: (step) =>
        set((state) =>
          state.currentJob
            ? {
                currentJob: {
                  ...state.currentJob,
                  currentStep: step,
                },
              }
            : {}
        ),
      setJobStatus: (status, result, error) =>
        set((state) =>
          state.currentJob
            ? {
                currentJob: {
                  ...state.currentJob,
                  status,
                  result,
                  error,
                },
              }
            : {}
        ),

      isLoading: false,
      isGenerating: false,
      sidebarOpen: true,
      filterSearch: '',
      setIsLoading: (value) => set({ isLoading: value }),
      setIsGenerating: (value) => set({ isGenerating: value }),
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      setFilterSearch: (value) => set({ filterSearch: value }),
    }),
    {
      name: 'vedaai-store',
      partialize: (state) => ({
        assignments: state.assignments,
        hasAssignments: state.hasAssignments,
        createForm: { ...state.createForm, file: null },
        generatedPaper: state.generatedPaper,
        papersByAssignment: state.papersByAssignment,
        currentJob: state.currentJob,
      }),
    }
  )
);
