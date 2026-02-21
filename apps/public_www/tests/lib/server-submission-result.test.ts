import { describe, expect, it } from 'vitest';

import { CrmApiRequestError } from '@/lib/crm-api-client';
import { ServerSubmissionResult } from '@/lib/server-submission-result';

describe('server-submission-result', () => {
  it('returns success when request resolves', async () => {
    const result = await ServerSubmissionResult.resolve({
      request: async () => Promise.resolve({ message: 'ok' }),
      failureMessage: 'fallback error',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.errorMessage).toBe('');
    expect(result.statusCode).toBeNull();
  });

  it('returns failure with status code for CRM request errors', async () => {
    const result = await ServerSubmissionResult.resolve({
      request: async () => {
        throw new CrmApiRequestError({
          statusCode: 500,
          payload: { error: 'Server failure' },
          message: 'CRM API request failed: 500',
        });
      },
      failureMessage: 'something went wrong, try a bit later',
    });

    expect(result.isSuccess).toBe(false);
    expect(result.errorMessage).toBe('something went wrong, try a bit later');
    expect(result.statusCode).toBe(500);
  });
});
