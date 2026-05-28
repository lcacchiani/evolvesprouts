import type { FormQuestion } from '@/content/form-types';

export interface FormAnswerState {
  selectedOption: string;
  freeText: string;
}

export function emptyFormAnswerState(): FormAnswerState {
  return {
    selectedOption: '',
    freeText: '',
  };
}

export function isFormAnswerValid(question: FormQuestion, answer: FormAnswerState): boolean {
  if (question.type === 'select') {
    return answer.selectedOption.trim().length > 0;
  }
  if (question.type === 'email') {
    return isValidEmail(answer.freeText);
  }
  if (question.type === 'text') {
    return answer.freeText.trim().length > 0;
  }
  return false;
}

function isValidEmail(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
