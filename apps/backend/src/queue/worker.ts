import { Job } from 'bullmq';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { env } from '../config/env';
import { GeneratedPaperModel } from '../db/models/GeneratedPaper';
import { buildPaperFromAssignment } from '../demo-store';
import { buildPaperPdfArrayBuffer } from '../pdf/build';
import { deleteCachePattern } from '../redis/client';
import {
  GenerateJobData,
  GenerateJobResult,
  GeneratePdfJobData,
  GeneratePdfJobResult,
  setupGenerateWorker,
  setupPdfWorker,
} from './setup';
import { Assignment, DifficultyLevel, GeneratedPaper, QuestionType, Section } from '../types';

interface AIQuestion {
  id?: number;
  text?: string;
  difficulty?: DifficultyLevel;
  marks?: number;
}

interface AISection {
  id?: string;
  title?: string;
  subtitle?: string;
  instructions?: string;
  questions?: AIQuestion[];
}

interface AIResponseShape {
  school?: string;
  subject?: string;
  classLevel?: string;
  timeAllowed?: string;
  maxMarks?: number;
  sections?: AISection[];
}

const parseAiResponse = (rawText: string): AIResponseShape => {
  const trimmed = rawText.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(),
    (() => {
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      return fenced?.[1]?.trim() || '';
    })(),
    (() => {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      return start >= 0 && end > start ? trimmed.slice(start, end + 1).trim() : '';
    })(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as AIResponseShape;
    } catch {
      // Try the next normalization strategy.
    }
  }

  throw new Error('AI returned an invalid JSON payload.');
};

const aiProvider = createOpenAICompatible({
  name: 'custom-ai',
  baseURL: env.AI_API_URL,
  apiKey: env.AI_API_KEY,
});

const buildAssignmentFromJob = (data: GenerateJobData): Assignment => ({
  id: data.assignmentId,
  title: `${data.subject || 'Assessment'} Paper`,
  assignedDate: new Date().toISOString(),
  dueDate: new Date().toISOString(),
  school: data.school || 'Delhi Public School',
  subject: data.subject || 'Science',
  classLevel: data.classLevel || '8th',
  timeAllowed: data.timeAllowed || '45 minutes',
  maxMarks:
    data.maxMarks ||
    data.questionTypes.reduce((sum, questionType) => sum + questionType.count * questionType.marks, 0),
  questionTypes: data.questionTypes.map((questionType, index) => ({
    id: `${data.assignmentId}-${index}`,
    type: questionType.type,
    difficulty: inferDifficulty(questionType),
    count: questionType.count,
    marks: questionType.marks,
  })),
  additionalInfo: data.additionalInfo || '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const inferDifficulty = (questionType: { type: string; marks: number }): DifficultyLevel => {
  if (questionType.marks >= 5 || /long|case/i.test(questionType.type)) {
    return 'Challenging';
  }

  if (questionType.marks >= 2 || /short|diagram|numerical/i.test(questionType.type)) {
    return 'Moderate';
  }

  return 'Easy';
};

const buildFallbackSections = (questionTypes: QuestionType[]): Section[] =>
  questionTypes.map((questionType, sectionIndex) => ({
    id: String.fromCharCode(65 + sectionIndex),
    title: `Section ${String.fromCharCode(65 + sectionIndex)}`,
    subtitle: questionType.type,
    instructions: 'Attempt all questions.',
    questions: Array.from({ length: questionType.count }, (_, questionIndex) => ({
      id: questionIndex + 1,
      text: `Write a concise answer for ${questionType.type.toLowerCase()} question ${questionIndex + 1}.`,
      difficulty: questionType.difficulty,
      marks: questionType.marks,
    })),
  }));

const normalizeSections = (questionTypes: QuestionType[], aiSections: AISection[] | undefined): Section[] => {
  if (!aiSections?.length) {
    return buildFallbackSections(questionTypes);
  }

  return aiSections.map((section, sectionIndex) => ({
    id: section.id || String.fromCharCode(65 + sectionIndex),
    title: section.title || `Section ${String.fromCharCode(65 + sectionIndex)}`,
    subtitle: section.subtitle || questionTypes[sectionIndex]?.type || 'Questions',
    instructions: section.instructions || 'Attempt all questions.',
    questions:
      section.questions?.map((question, questionIndex) => ({
        id: question.id ?? questionIndex + 1,
        text: question.text || 'Question text.',
        difficulty: question.difficulty || questionTypes[sectionIndex]?.difficulty || 'Moderate',
        marks: question.marks || questionTypes[sectionIndex]?.marks || 1,
      })) ?? [],
  }));
};

async function generateQuestionPaperWithAI(
  data: GenerateJobData
): Promise<Omit<GeneratedPaper, 'id' | 'createdAt'>> {
  if (!env.AI_API_KEY) {
    const demoPaper = buildPaperFromAssignment(buildAssignmentFromJob(data));
    return {
      assignmentId: demoPaper.assignmentId,
      school: demoPaper.school,
      subject: demoPaper.subject,
      classLevel: demoPaper.classLevel,
      timeAllowed: demoPaper.timeAllowed,
      maxMarks: demoPaper.maxMarks,
      sections: demoPaper.sections,
      answerKey: demoPaper.answerKey,
    };
  }

  const prompt = `Create a structured question paper in JSON.
School: ${data.school}
Subject: ${data.subject}
Class: ${data.classLevel}
Time Allowed: ${data.timeAllowed}
Total Marks: ${data.maxMarks}
Sections:
${data.questionTypes
  .map(
    (questionType, index) =>
      `Section ${String.fromCharCode(65 + index)}: ${questionType.type}, ${questionType.count} questions, ${
        questionType.marks
      } marks each`
  )
  .join('\n')}
Additional instructions: ${data.additionalInfo || 'None'}
Uploaded source file: ${
    data.sourceFile
      ? `${data.sourceFile.name} (${data.sourceFile.type}, ${data.sourceFile.size} bytes)${
          data.sourceFile.extractedText ? `\nSource text:\n${data.sourceFile.extractedText}` : ''
        }`
      : 'None'
  }

Return valid JSON only with keys school, subject, classLevel, timeAllowed, maxMarks, sections[].`;

  const { text } = await generateText({
    model: aiProvider.chatModel(env.AI_MODEL),
    prompt,
    temperature: 0.4,
  });

  const parsed = parseAiResponse(text);
  const assignment = buildAssignmentFromJob(data);
  const sections = normalizeSections(assignment.questionTypes, parsed.sections);

  return {
    assignmentId: data.assignmentId,
    school: parsed.school || assignment.school,
    subject: parsed.subject || assignment.subject,
    classLevel: parsed.classLevel || assignment.classLevel,
    timeAllowed: parsed.timeAllowed || assignment.timeAllowed,
    maxMarks: parsed.maxMarks || assignment.maxMarks,
    sections,
    answerKey: sections.flatMap((section) =>
      section.questions.map(
        (question, index) => `${section.title} Q${index + 1}: A well-structured answer should address ${question.text}`
      )
    ),
  };
}

export async function generatePaperProcessor(job: Job<GenerateJobData>): Promise<GenerateJobResult> {
  try {
    await job.updateProgress(10);
    await new Promise((resolve) => setTimeout(resolve, 400));

    await job.updateProgress(45);
    const paperData = await generateQuestionPaperWithAI(job.data);

    await job.updateProgress(80);
    const savedPaper = await GeneratedPaperModel.create(paperData);
    await deleteCachePattern(`generated-papers:${savedPaper.assignmentId}`);

    await job.updateProgress(100);

    const { getSocketIOServer } = await import('../websocket/server');
    const io = getSocketIOServer();
    io.to(`job:${job.id}`).emit('job:completed', {
      jobId: String(job.id),
      result: savedPaper,
    });
    io.to(`job:${job.id}`).emit('job:updated', {
      jobId: String(job.id),
      status: 'completed',
    });

    return {
      success: true,
      paperId: savedPaper.id,
      result: savedPaper,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown generation error.';
    const { getSocketIOServer } = await import('../websocket/server');
    const io = getSocketIOServer();
    io.to(`job:${job.id}`).emit('job:failed', {
      jobId: String(job.id),
      error: message,
    });
    io.to(`job:${job.id}`).emit('job:updated', {
      jobId: String(job.id),
      status: 'failed',
    });

    throw new Error(message);
  }
}

let worker: ReturnType<typeof setupGenerateWorker> | null = null;
let pdfWorker: ReturnType<typeof setupPdfWorker> | null = null;

export async function generatePdfProcessor(job: Job<GeneratePdfJobData>): Promise<GeneratePdfJobResult> {
  try {
    const buffer = Buffer.from(buildPaperPdfArrayBuffer(job.data.paper));

    return {
      success: true,
      fileName: `question-paper-${job.data.paper.assignmentId}.pdf`,
      pdfBase64: buffer.toString('base64'),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown PDF generation error.',
    };
  }
}

export function startWorker() {
  if (!worker) {
    worker = setupGenerateWorker(generatePaperProcessor);
  }

  if (!pdfWorker) {
    pdfWorker = setupPdfWorker(generatePdfProcessor);
  }

  return worker;
}

export function stopWorker() {
  if (worker) {
    worker.close();
    worker = null;
  }

  if (pdfWorker) {
    pdfWorker.close();
    pdfWorker = null;
  }
}

if (process.env.NODE_ENV === 'development' && typeof window === 'undefined' && process.env.REDIS_URL) {
  startWorker();
}
