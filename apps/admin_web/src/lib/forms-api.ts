import { ensureFreshTokens } from './auth';
import { adminApiRequest } from './api-admin-client';
import { unwrapPayload } from './api-payload';
import { getApiBaseUrl } from './config';
import { isRecord } from './type-guards';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export type AdminFormSummary = ApiSchemas['AdminFormSummary'];
export type AdminFormAnswerRow = ApiSchemas['AdminFormAnswerRow'];
export type AdminFormClearAnswersResponse = ApiSchemas['AdminFormClearAnswersResponse'];

function parseFormSummary(value: unknown): AdminFormSummary {
  const row = isRecord(value) ? value : {};
  return {
    formSlug: typeof row.formSlug === 'string' ? row.formSlug : '',
    answerCount: typeof row.answerCount === 'number' ? row.answerCount : 0,
  };
}

function parseFormAnswerRow(value: unknown): AdminFormAnswerRow {
  const row = isRecord(value) ? value : {};
  const parsed: AdminFormAnswerRow = {
    formSlug: typeof row.formSlug === 'string' ? row.formSlug : '',
    sessionId: typeof row.sessionId === 'string' ? row.sessionId : '',
    questionId: typeof row.questionId === 'string' ? row.questionId : '',
    questionType:
      row.questionType === 'select' || row.questionType === 'text' || row.questionType === 'email'
        ? row.questionType
        : 'text',
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
  };
  if (typeof row.selectedOption === 'string') {
    parsed.selectedOption = row.selectedOption;
  }
  if (typeof row.freeText === 'string') {
    parsed.freeText = row.freeText;
  }
  return parsed;
}

export async function listAdminForms(signal?: AbortSignal): Promise<AdminFormSummary[]> {
  const payload = await adminApiRequest<ApiSchemas['AdminFormListResponse']>({
    endpointPath: '/v1/admin/forms',
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items.map((item) => parseFormSummary(item)) : [];
}

export async function listAdminFormAnswers(
  formSlug: string,
  signal?: AbortSignal
): Promise<AdminFormAnswerRow[]> {
  const payload = await adminApiRequest<ApiSchemas['AdminFormAnswerListResponse']>({
    endpointPath: `/v1/admin/forms/${encodeURIComponent(formSlug)}/answers`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items.map((item) => parseFormAnswerRow(item)) : [];
}

export async function clearAdminFormAnswers(
  formSlug: string
): Promise<AdminFormClearAnswersResponse> {
  const payload = await adminApiRequest<ApiSchemas['AdminFormClearAnswersResponse']>({
    endpointPath: `/v1/admin/forms/${encodeURIComponent(formSlug)}/answers`,
    method: 'DELETE',
  });
  const root = unwrapPayload(payload);
  return {
    formSlug: typeof root.formSlug === 'string' ? root.formSlug : formSlug,
    deletedCount: typeof root.deletedCount === 'number' ? root.deletedCount : 0,
  };
}

export async function exportAdminFormAnswersCsv(formSlug: string): Promise<Blob> {
  const tokens = await ensureFreshTokens();
  if (!tokens) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(
    `${getApiBaseUrl()}/v1/admin/forms/${encodeURIComponent(formSlug)}/answers/export`,
    {
      method: 'GET',
      headers: {
        Accept: 'text/csv',
        Authorization: `Bearer ${tokens.idToken}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error(`CSV export failed with status ${response.status}.`);
  }
  return response.blob();
}

export function formatFormAnswerValue(row: AdminFormAnswerRow): string {
  if (typeof row.selectedOption === 'string' && row.selectedOption.trim()) {
    return row.selectedOption;
  }
  if (typeof row.freeText === 'string' && row.freeText.trim()) {
    return row.freeText;
  }
  return '—';
}
