import type { PollQuestion } from '@/content/poll-types';
import type { QuestionAnswerState } from '@/components/polls/poll-answer-state';

const API_BASE_URL_ENV = 'NEXT_PUBLIC_API_BASE_URL';
const API_KEY_ENV = 'NEXT_PUBLIC_TRAINING_API_KEY';
const API_KEY_FALLBACK_ENV = 'NEXT_PUBLIC_WWW_CRM_API_KEY';
const WWW_PREFIX = '/www';

export interface PersistPollAnswerInput {
  pollSlug: string;
  sessionId: string;
  question: PollQuestion;
  answer: QuestionAnswerState;
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

export interface PollQuestionResultsBucket {
  label: string;
  count: number;
}

export interface PollQuestionResults {
  pollSlug: string;
  questionId: string;
  questionType: PollAggregatableQuestionType;
  totalResponses: number;
  buckets: PollQuestionResultsBucket[];
  responses?: string[];
}

export interface PollControlState {
  pollSlug: string;
  enabledQuestionIds: string[];
  updatedAt?: string;
}

export interface PollSessionAnswerItem {
  pollSlug?: string;
  sessionId?: string;
  questionId: string;
  questionType: PollQuestion['type'];
  selectedOption?: string;
  booleanAnswer?: boolean;
  freeText?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PollSessionAnswers {
  pollSlug: string;
  sessionId: string;
  answers: PollSessionAnswerItem[];
}

export type PollAggregatableQuestionType = 'select' | 'truefalse' | 'text' | 'email';

export interface FetchPollQuestionResultsInput {
  pollSlug: string;
  questionId: string;
  questionType: PollAggregatableQuestionType;
}

export async function fetchPollQuestionResults(
  input: FetchPollQuestionResultsInput,
): Promise<PollQuestionResults> {
  const config = resolvePollApiConfig();
  if (!config) {
    throw new PollApiError('Poll API is not configured', 0);
  }

  const params = new URLSearchParams({
    questionType: input.questionType,
  });
  const endpointPath = `${config.baseUrl}/v1/polls/${encodeURIComponent(input.pollSlug)}/questions/${encodeURIComponent(input.questionId)}/results?${params.toString()}`;

  const response = await fetch(endpointPath, {
    method: 'GET',
    headers: {
      'x-api-key': config.apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PollApiError('Failed to load poll results', response.status);
  }

  return (await response.json()) as PollQuestionResults;
}

export async function fetchPollControlState(pollSlug: string): Promise<PollControlState> {
  const config = resolvePollApiConfig();
  if (!config) {
    throw new PollApiError('Poll API is not configured', 0);
  }

  const endpointPath = `${config.baseUrl}/v1/polls/${encodeURIComponent(pollSlug)}/control`;
  const response = await fetch(endpointPath, {
    method: 'GET',
    headers: {
      'x-api-key': config.apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PollApiError('Failed to load poll control state', response.status);
  }

  return (await response.json()) as PollControlState;
}

export async function persistPollControlState(
  pollSlug: string,
  enabledQuestionIds: string[],
): Promise<PollControlState> {
  const config = resolvePollApiConfig();
  if (!config) {
    throw new PollApiError('Poll API is not configured', 0);
  }

  const endpointPath = `${config.baseUrl}/v1/polls/${encodeURIComponent(pollSlug)}/control`;
  const response = await fetch(endpointPath, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({ enabledQuestionIds }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PollApiError('Failed to update poll control state', response.status);
  }

  return (await response.json()) as PollControlState;
}

export async function fetchPollSessionAnswers(
  pollSlug: string,
  sessionId: string,
): Promise<PollSessionAnswers> {
  const config = resolvePollApiConfig();
  if (!config) {
    throw new PollApiError('Poll API is not configured', 0);
  }

  const params = new URLSearchParams({ sessionId });
  const endpointPath = `${config.baseUrl}/v1/polls/${encodeURIComponent(pollSlug)}/answers?${params.toString()}`;
  const response = await fetch(endpointPath, {
    method: 'GET',
    headers: {
      'x-api-key': config.apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PollApiError('Failed to load poll session answers', response.status);
  }

  return (await response.json()) as PollSessionAnswers;
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

  if (input.question.type === 'select') {
    return {
      ...base,
      selectedOption: input.answer.selectedOption.trim(),
    };
  }

  if (input.question.type === 'truefalse') {
    return {
      ...base,
      booleanAnswer: input.answer.trueFalseValue,
    };
  }

  return {
    ...base,
    freeText: input.answer.freeText.trim(),
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
