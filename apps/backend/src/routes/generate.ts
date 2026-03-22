import { Router } from 'express';
import { AssignmentModel } from '../db/models/Assignment';
import { createDemoGenerationJob, getDemoAssignment, getDemoJobStatus } from '../demo-store';
import { isDbConfigured } from '../db/mongodb';
import { addGenerateJob, getJobStatus } from '../queue/setup';
import { JobStatusPayload } from '../types';
import { validateQuestionTypes } from './helpers';

export const generateRouter = Router();

const isQueueConfigured = () => Boolean(process.env.REDIS_URL);

generateRouter.post('/', async (request, response) => {
  try {
    const body = request.body;

    if (!body.assignmentId) {
      response.status(400).json({ success: false, error: 'Assignment ID is required.' });
      return;
    }

    const questionTypeError = validateQuestionTypes(body.questionTypes ?? []);
    if (questionTypeError) {
      response.status(400).json({ success: false, error: questionTypeError });
      return;
    }

    const assignment = !isDbConfigured()
      ? getDemoAssignment(body.assignmentId)
      : await AssignmentModel.findById(body.assignmentId);

    if (!assignment) {
      response.status(404).json({ success: false, error: 'Assignment not found.' });
      return;
    }

    if (!isQueueConfigured()) {
      const job = createDemoGenerationJob(assignment.id);
      response.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          assignmentId: assignment.id,
          status: job.status,
        },
        message: 'Question paper generation started in demo mode.',
      });
      return;
    }

    const job = await addGenerateJob({
      assignmentId: assignment.id,
      school: assignment.school,
      subject: assignment.subject,
      classLevel: assignment.classLevel,
      timeAllowed: assignment.timeAllowed,
      maxMarks: assignment.maxMarks,
      questionTypes: assignment.questionTypes,
      additionalInfo: assignment.additionalInfo,
      sourceFile: assignment.sourceFile,
    });

    response.status(202).json({
      success: true,
      data: {
        jobId: String(job.id),
        assignmentId: assignment.id,
        status: 'queued',
      },
      message: 'Question paper generation started.',
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start generation.',
    });
  }
});

generateRouter.get('/', async (request, response) => {
  try {
    const jobId = String(request.query.jobId || '');

    if (!jobId) {
      response.status(400).json({ success: false, error: 'Job ID is required.' });
      return;
    }

    if (!isQueueConfigured()) {
      const jobStatus = getDemoJobStatus(jobId);

      if (!jobStatus) {
        response.status(404).json({ success: false, error: 'Job not found.' });
        return;
      }

      response.json({ success: true, data: jobStatus });
      return;
    }

    const jobStatus = await getJobStatus(jobId);
    if (!jobStatus) {
      response.status(404).json({ success: false, error: 'Job not found.' });
      return;
    }

    const payload: JobStatusPayload = {
      jobId: String(jobStatus.id),
      assignmentId: jobStatus.data.assignmentId,
      status:
        jobStatus.state === 'completed'
          ? 'completed'
          : jobStatus.state === 'failed'
          ? 'failed'
          : jobStatus.state === 'active'
          ? 'processing'
          : 'queued',
      currentStep: typeof jobStatus.progress === 'number' ? Math.min(Math.ceil(jobStatus.progress / 20), 5) : 0,
      totalSteps: 5,
      result: jobStatus.result?.result,
      error: jobStatus.failedReason,
    };

    response.json({ success: true, data: payload });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job status.',
    });
  }
});
