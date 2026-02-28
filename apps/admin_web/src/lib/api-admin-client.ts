import { ensureFreshTokens } from './auth';
import { getAdminApiBaseUrl } from './config';
import { isRecord } from './type-guards';

export type AdminApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface AdminApiRequestOptions {
  endpointPath: string;
  method?: AdminApiMethod;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  expectedSuccessStatuses?: readonly number[];
}

export class AdminApiError extends Error {
  readonly statusCode: number;
  readonly payload: unknown;

  constructor({
    statusCode,
    payload,
    message,
  }: {
    statusCode: number;
    payload: unknown;
    message: string;
  }) {
    super(message);
    this.name = 'AdminApiError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

function normalizeEndpointPath(endpointPath: string): string {
  const normalizedPath = endpointPath.trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

function extractErrorMessage(statusCode: number, payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (isRecord(payload)) {
    const error = payload.error;
    const detail = payload.detail;
    if (typeof error === 'string' && error.trim()) {
      const normalizedError = error.trim();
      if (typeof detail === 'string' && detail.trim()) {
        return `${normalizedError} (${detail.trim()})`;
      }
      return normalizedError;
    }
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
  }

  return `Admin API request failed: ${statusCode}`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const responseText = await response.text();
  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

export async function adminApiRequest<TPayload = unknown>({
  endpointPath,
  method = 'GET',
  body,
  signal,
  headers,
  expectedSuccessStatuses,
}: AdminApiRequestOptions): Promise<TPayload> {
  const normalizedEndpointPath = normalizeEndpointPath(endpointPath);
  if (!normalizedEndpointPath) {
    throw new Error('Admin API endpoint path is invalid.');
  }

  const tokens = await ensureFreshTokens();
  if (!tokens) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${tokens.idToken}`,
    ...headers,
  };
  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
    signal,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${getAdminApiBaseUrl()}${normalizedEndpointPath}`, requestInit);
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new AdminApiError({
      statusCode: response.status,
      payload,
      message: extractErrorMessage(response.status, payload),
    });
  }

  if (
    expectedSuccessStatuses &&
    expectedSuccessStatuses.length > 0 &&
    !expectedSuccessStatuses.includes(response.status)
  ) {
    throw new AdminApiError({
      statusCode: response.status,
      payload,
      message: `Admin API request returned unexpected status: ${response.status}`,
    });
  }

  return payload as TPayload;
}

export function isAbortRequestError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
