import type { PollQuestion } from '@/content/poll-types';
import { POLL_OTHER_ANSWER_ID } from '@/content/poll-types';

const API_BASE_URL_ENV = 'NEXT_PUBLIC_API_BASE_URL';
const API_KEY_ENV = 'NEXT_PUBLIC_TRAINING_API_KEY';
const API_KEY_FALLBACK_ENV = 'NEXT_PUBLIC_WWW_CRM_API_KEY';
const WWW_PREFIX = '/www';

export interface PersistPollAnswerInput {
  pollSlug: string;
  sessionId: string;
  question: PollQuestion;
  selectedAnswerIds: string[];
  otherText: string;
  freeText: string;
}

export class PollApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'PollApiError';
    this.statusCode = statusCode;
  }
}

export function resolvePollApiConfig():
  | { baseUrl: string; apiKey: string }
  | null {
  const apiKey =
    process.env[API_KEY_ENV]?.trim() ||
    process.env[API_KEY_FALLBACK_ENV]?.trim() ||
    '';
  const baseUrl = normalizePollApiBaseUrl(process.env[API_BASE_URL_ENV]?.trim() ?? '');
  if (!apiKey || !baseUrl) {
    return null;
  }
  return { baseUrl, apiKey };
}

export async function persistPollAnswer(
  input: PersistPollAnswerInput,
): Promise<void> {
  const config = resolvePollApiConfig();
  if (!config) {
    throw new PollApiError('Poll API is not configured', 0);
  }

  const endpointPath = `${config.baseUrl}/v1/polls/${encodeURIComponent(input.pollSlug)}/answers`;
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
    throw new PollApiError('Failed to persist poll answer', response.status);
  }
}

function buildPersistBody(input: PersistPollAnswerInput): Record<string, unknown> {
  const base = {
    pollSlug: input.pollSlug,
    sessionId: input.sessionId,
    questionId: input.question.id,
    questionType: input.question.type,
  };

  if (input.question.type === 'text') {
    return {
      ...base,
      freeText: input.freeText.trim(),
    };
  }

  const answerIds = input.selectedAnswerIds.filter((id) => id !== POLL_OTHER_ANSWER_ID);
  const otherText =
    input.selectedAnswerIds.includes(POLL_OTHER_ANSWER_ID) ? input.otherText.trim() : '';

  return {
    ...base,
    selectionMode: input.question.selectionMode,
    answerIds,
    ...(otherText ? { otherText } : {}),
  };
}

function normalizePollApiBaseUrl(raw: string): string {
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
