import { Router } from 'express';
import { AssignmentModel } from '../db/models/Assignment';
import { createDemoAssignment, deleteDemoAssignment, getDemoAssignment, getDemoAssignments, updateDemoAssignment } from '../demo-store';
import { isDbConfigured } from '../db/mongodb';
import { deleteCachePattern, getCache, setCache } from '../redis/client';
import { Assignment } from '../types';
import { validateQuestionTypes } from './helpers';

export const assignmentsRouter = Router();

assignmentsRouter.get('/', async (_request, response) => {
  try {
    const cacheKey = 'assignments:all';
    const cached = await getCache<{ assignments: Assignment[]; total: number }>(cacheKey);

    if (cached) {
      response.json({ success: true, data: cached });
      return;
    }

    const assignments = !isDbConfigured() ? getDemoAssignments() : await AssignmentModel.findAll();
    const payload = { assignments, total: assignments.length };

    await setCache(cacheKey, payload);
    response.json({ success: true, data: payload });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch assignments.',
    });
  }
});

assignmentsRouter.post('/', async (request, response) => {
  try {
    const body = request.body;
    const error =
      !body.title?.trim()
        ? 'Title is required.'
        : !body.dueDate
        ? 'Due date is required.'
        : !body.school?.trim()
        ? 'School is required.'
        : !body.subject?.trim()
        ? 'Subject is required.'
        : !body.classLevel?.trim()
        ? 'Class level is required.'
        : !body.timeAllowed?.trim()
        ? 'Time allowed is required.'
        : body.maxMarks <= 0
        ? 'Maximum marks must be positive.'
        : validateQuestionTypes(body.questionTypes);

    if (error) {
      response.status(400).json({ success: false, error });
      return;
    }

    const payload: Omit<Assignment, 'id' | 'assignedDate' | 'createdAt' | 'updatedAt'> = {
      title: body.title.trim(),
      dueDate: body.dueDate,
      school: body.school.trim(),
      subject: body.subject.trim(),
      classLevel: body.classLevel.trim(),
      timeAllowed: body.timeAllowed.trim(),
      maxMarks: body.maxMarks,
      questionTypes: body.questionTypes,
      additionalInfo: body.additionalInfo ?? '',
      fileName: body.fileName ?? '',
      fileUrl: body.fileUrl,
      sourceFile: body.sourceFile ?? null,
    };

    const assignment = !isDbConfigured() ? createDemoAssignment(payload) : await AssignmentModel.create(payload);

    await deleteCachePattern('assignments:*');
    response.status(201).json({
      success: true,
      data: assignment,
      message: 'Assignment created successfully.',
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create assignment.',
    });
  }
});

assignmentsRouter.get('/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const cacheKey = `assignment:${id}`;
    const cached = await getCache<Assignment>(cacheKey);

    if (cached) {
      response.json({ success: true, data: cached });
      return;
    }

    const assignment = !isDbConfigured() ? getDemoAssignment(id) : await AssignmentModel.findById(id);
    if (!assignment) {
      response.status(404).json({ success: false, error: 'Assignment not found.' });
      return;
    }

    await setCache(cacheKey, assignment);
    response.json({ success: true, data: assignment });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch assignment.',
    });
  }
});

assignmentsRouter.put('/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const body = request.body;
    const updates: Partial<Assignment> = {
      title: typeof body.title === 'string' ? body.title.trim() : undefined,
      dueDate: body.dueDate,
      school: typeof body.school === 'string' ? body.school.trim() : undefined,
      subject: typeof body.subject === 'string' ? body.subject.trim() : undefined,
      classLevel: typeof body.classLevel === 'string' ? body.classLevel.trim() : undefined,
      timeAllowed: typeof body.timeAllowed === 'string' ? body.timeAllowed.trim() : undefined,
      maxMarks: body.maxMarks,
      questionTypes: body.questionTypes,
      additionalInfo: body.additionalInfo,
      fileName: body.fileName,
      fileUrl: body.fileUrl,
      sourceFile: body.sourceFile,
    };

    if (updates.title !== undefined && updates.title.length === 0) {
      response.status(400).json({ success: false, error: 'Title cannot be empty.' });
      return;
    }

    if (updates.maxMarks !== undefined && updates.maxMarks <= 0) {
      response.status(400).json({ success: false, error: 'Maximum marks must be positive.' });
      return;
    }

    const questionTypeError = updates.questionTypes ? validateQuestionTypes(updates.questionTypes) : null;
    if (questionTypeError) {
      response.status(400).json({ success: false, error: questionTypeError });
      return;
    }

    const assignment = !isDbConfigured() ? updateDemoAssignment(id, updates) : await AssignmentModel.update(id, updates);
    if (!assignment) {
      response.status(404).json({ success: false, error: 'Assignment not found.' });
      return;
    }

    await deleteCachePattern('assignments:*');
    await deleteCachePattern(`assignment:${id}`);
    response.json({
      success: true,
      data: assignment,
      message: 'Assignment updated successfully.',
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update assignment.',
    });
  }
});

assignmentsRouter.delete('/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const deleted = !isDbConfigured() ? deleteDemoAssignment(id) : await AssignmentModel.delete(id);

    if (!deleted) {
      response.status(404).json({ success: false, error: 'Assignment not found.' });
      return;
    }

    await deleteCachePattern('assignments:*');
    await deleteCachePattern(`assignment:${id}`);
    response.json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete assignment.',
    });
  }
});
