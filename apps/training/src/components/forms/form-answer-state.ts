import type { FormQuestion, FormsCommonContent } from '@/content/form-types';
import { isQuestionRequired } from '@/content/form-types';
import { isValidEmail } from '@/lib/validation';

export interface FormAnswerState {
  selectedOption: string;
  selectedOptions: string[];
  ratingValue: number | null;
  trueFalseValue: boolean | null;
  freeText: string;
}

export function emptyFormAnswerState(): FormAnswerState {
  return {
    selectedOption: '',
    selectedOptions: [],
    ratingValue: null,
    trueFalseValue: null,
    freeText: '',
  };
}

export function isFormAnswerValid(question: FormQuestion, answer: FormAnswerState): boolean {
  if (!isQuestionRequired(question)) {
    if (question.type === 'consent') {
      return isConsentAnswerValid(question, answer, false);
    }
    if (question.type === 'text' && answer.freeText.trim().length === 0) {
      return true;
    }
    if (question.type === 'multiselect' && answer.selectedOptions.length === 0) {
      return true;
    }
  }

  if (question.type === 'select' || question.type === 'segmented') {
    return answer.selectedOption.trim().length > 0;
  }
  if (question.type === 'multiselect') {
    if (answer.selectedOptions.length > question.maxSelections) {
      return false;
    }
    return answer.selectedOptions.length > 0;
  }
  if (question.type === 'rating') {
    return answer.ratingValue !== null;
  }
  if (question.type === 'consent') {
    return isConsentAnswerValid(question, answer, isQuestionRequired(question));
  }
  if (question.type === 'email') {
    return isValidEmail(answer.freeText);
  }
  if (question.type === 'text') {
    return answer.freeText.trim().length > 0;
  }
  return false;
}

function isConsentAnswerValid(
  question: Extract<FormQuestion, { type: 'consent' }>,
  answer: FormAnswerState,
  required: boolean,
): boolean {
  if (!answer.trueFalseValue) {
    if (!required) {
      return true;
    }
    return false;
  }
  if (question.followUp?.required) {
    return answer.freeText.trim().length > 0;
  }
  return true;
}

export function getFormValidationError(
  question: FormQuestion,
  answer: FormAnswerState,
  common: Pick<FormsCommonContent, 'errors'>,
): string | null {
  if (question.type === 'multiselect') {
    if (answer.selectedOptions.length > question.maxSelections) {
      return common.errors.maxSelectionsTemplate.replace(
        '{max}',
        String(question.maxSelections),
      );
    }
    if (isQuestionRequired(question) && answer.selectedOptions.length === 0) {
      return common.errors.required;
    }
    return null;
  }

  if (isFormAnswerValid(question, answer)) {
    return null;
  }

  if (question.type === 'email') {
    return common.errors.invalidEmail;
  }
  return common.errors.required;
}

export function toggleMultiselectOption(
  current: string[],
  option: string,
  maxSelections: number,
): string[] {
  if (current.includes(option)) {
    return current.filter((value) => value !== option);
  }
  if (current.length >= maxSelections) {
    return current;
  }
  return [...current, option];
}
