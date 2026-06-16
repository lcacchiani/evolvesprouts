import type { FormQuestion } from '@/content/form-types';
import type { FormAnswerState } from '@/components/forms/form-answer-state';
import { isQuestionRequired } from '@/content/form-types';
import {
  normalizeTrainingApiBaseUrl,
  resolveTrainingApiConfig,
} from '@/lib/training-api-config';

export interface PersistFormAnswerInput {
  formSlug: string;
  sessionId: string;
  question: FormQuestion;
  answer: FormAnswerState;
}

export class FormApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'FormApiError';
    this.statusCode = statusCode;
  }
}

export function resolveFormApiConfig(): { baseUrl: string; apiKey: string } | null {
  return resolveTrainingApiConfig();
}

export async function persistFormAnswer(input: PersistFormAnswerInput): Promise<void> {
  const body = buildPersistBody(input);
  if (body === null) {
    return;
  }

  const config = resolveFormApiConfig();
  if (!config) {
    throw new FormApiError('Form API is not configured', 0);
  }

  const endpointPath = `${config.baseUrl}/v1/forms/${encodeURIComponent(input.formSlug)}/answers`;

  const response = await fetch(endpointPath, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new FormApiError('Failed to persist form answer', response.status);
  }
}

export function buildPersistBody(
  input: PersistFormAnswerInput,
): Record<string, unknown> | null {
  const base = {
    formSlug: input.formSlug,
    sessionId: input.sessionId,
    questionId: input.question.id,
    questionType: input.question.type,
  };

  if (input.question.type === 'select' || input.question.type === 'segmented') {
    const selectedOption = input.answer.selectedOption.trim();
    if (!selectedOption) {
      return null;
    }
    return {
      ...base,
      selectedOption,
    };
  }

  if (input.question.type === 'multiselect') {
    if (input.answer.selectedOptions.length === 0) {
      return null;
    }
    return {
      ...base,
      selectedOptions: input.answer.selectedOptions,
    };
  }

  if (input.question.type === 'rating') {
    if (input.answer.ratingValue === null) {
      return null;
    }
    return {
      ...base,
      ratingValue: input.answer.ratingValue,
    };
  }

  if (input.question.type === 'consent') {
    if (!isQuestionRequired(input.question) && input.answer.trueFalseValue !== true) {
      return null;
    }
    const payload: Record<string, unknown> = {
      ...base,
      booleanAnswer: input.answer.trueFalseValue === true,
    };
    const followUp = input.answer.freeText.trim();
    if (followUp) {
      payload.freeText = followUp;
    }
    return payload;
  }

  const freeText = input.answer.freeText.trim();
  if (!freeText) {
    return null;
  }

  return {
    ...base,
    freeText,
  };
}

export { normalizeTrainingApiBaseUrl as normalizeFormApiBaseUrl };
