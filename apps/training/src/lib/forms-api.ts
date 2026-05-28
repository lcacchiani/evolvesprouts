import type { FormQuestion } from '@/content/form-types';
import type { FormAnswerState } from '@/components/forms/form-answer-state';

const API_BASE_URL_ENV = 'NEXT_PUBLIC_API_BASE_URL';
const API_KEY_ENV = 'NEXT_PUBLIC_TRAINING_API_KEY';
const API_KEY_FALLBACK_ENV = 'NEXT_PUBLIC_WWW_CRM_API_KEY';
const WWW_PREFIX = '/www';

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
  const apiKey =
    process.env[API_KEY_ENV]?.trim() ||
    process.env[API_KEY_FALLBACK_ENV]?.trim() ||
    '';
  const baseUrl = normalizeFormApiBaseUrl(process.env[API_BASE_URL_ENV]?.trim() ?? '');
  if (!apiKey || !baseUrl) {
    return null;
  }
  return { baseUrl, apiKey };
}

export async function persistFormAnswer(input: PersistFormAnswerInput): Promise<void> {
  const config = resolveFormApiConfig();
  if (!config) {
    throw new FormApiError('Form API is not configured', 0);
  }

  const endpointPath = `${config.baseUrl}/v1/forms/${encodeURIComponent(input.formSlug)}/answers`;
  const body = buildPersistBody(input);

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

function buildPersistBody(input: PersistFormAnswerInput): Record<string, unknown> {
  const base = {
    formSlug: input.formSlug,
    sessionId: input.sessionId,
    questionId: input.question.id,
    questionType: input.question.type,
  };

  if (input.question.type === 'select') {
    return {
      ...base,
      selectedOption: input.answer.selectedOption.trim(),
    };
  }

  return {
    ...base,
    freeText: input.answer.freeText.trim(),
  };
}

function normalizeFormApiBaseUrl(raw: string): string {
  if (!raw) {
    return '';
  }
  if (raw === WWW_PREFIX || raw.startsWith(`${WWW_PREFIX}/`)) {
    return WWW_PREFIX;
  }
  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname.replace(/\/$/, '') || '';
    if (pathname !== WWW_PREFIX) {
      return '';
    }
    return `${parsed.origin}${WWW_PREFIX}`;
  } catch {
    return '';
  }
}
