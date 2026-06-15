import type { PollQuestion } from '@/content/poll-types';
import type { PollSessionAnswerItem } from '@/lib/polls-api';
import { isValidEmail } from '@/lib/validation';

export interface QuestionAnswerState {
  selectedOption: string;
  selectedOptions: string[];
  trueFalseValue: boolean | null;
  freeText: string;
}

export function emptyAnswerState(): QuestionAnswerState {
  return {
    selectedOption: '',
    selectedOptions: [],
    trueFalseValue: null,
    freeText: '',
  };
}

export function answerStateFromSessionItem(
  item: PollSessionAnswerItem,
): QuestionAnswerState {
  if (item.questionType === 'select') {
    return {
      selectedOption: item.selectedOption?.trim() ?? '',
      selectedOptions: [],
      trueFalseValue: null,
      freeText: '',
    };
  }
  if (item.questionType === 'multiselect') {
    const options = Array.isArray(item.selectedOptions)
      ? item.selectedOptions
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];
    return {
      selectedOption: '',
      selectedOptions: options,
      trueFalseValue: null,
      freeText: '',
    };
  }
  if (item.questionType === 'truefalse') {
    return {
      selectedOption: '',
      selectedOptions: [],
      trueFalseValue:
        typeof item.booleanAnswer === 'boolean' ? item.booleanAnswer : null,
      freeText: '',
    };
  }
  return {
    selectedOption: '',
    selectedOptions: [],
    trueFalseValue: null,
    freeText: item.freeText?.trim() ?? '',
  };
}

export function mergeSessionAnswers(
  items: PollSessionAnswerItem[],
): Record<string, QuestionAnswerState> {
  const merged: Record<string, QuestionAnswerState> = {};
  for (const item of items) {
    if (!item.questionId?.trim()) {
      continue;
    }
    merged[item.questionId] = answerStateFromSessionItem(item);
  }
  return merged;
}

export function hasUnlockablePollQuestions(
  allQuestions: PollQuestion[],
  enabledQuestionIds: ReadonlySet<string>,
): boolean {
  return allQuestions.some((question) => !enabledQuestionIds.has(question.id));
}

export function isAnswerValid(question: PollQuestion, answer: QuestionAnswerState): boolean {
  if (question.type === 'select') {
    return answer.selectedOption.trim().length > 0;
  }
  if (question.type === 'multiselect') {
    return answer.selectedOptions.length > 0;
  }
  if (question.type === 'truefalse') {
    return answer.trueFalseValue !== null;
  }
  if (question.type === 'email') {
    return isValidEmail(answer.freeText);
  }
  if (question.type === 'text') {
    return answer.freeText.trim().length > 0;
  }
  return false;
}
