import { QuestionType } from '../types';

export const validateQuestionTypes = (questionTypes?: QuestionType[] | null) => {
  if (!questionTypes || !Array.isArray(questionTypes) || questionTypes.length === 0) {
    return 'Add at least one question type.';
  }

  for (const questionType of questionTypes) {
    if (questionType.count <= 0) {
      return 'Question count must be positive.';
    }

    if (questionType.marks <= 0) {
      return 'Marks must be positive.';
    }
  }

  return null;
};
