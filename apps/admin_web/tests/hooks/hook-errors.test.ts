import { describe, expect, it } from 'vitest';

import { AdminApiError } from '@/lib/api-admin-client';

import { toErrorMessage } from '@/hooks/hook-errors';

describe('toErrorMessage', () => {
  it('uses generic 404 copy by default', () => {
    const err = new AdminApiError({
      statusCode: 404,
      payload: null,
      message: 'Tag not found',
    });
    expect(toErrorMessage(err, 'fallback')).toBe(
      'The requested resource is not available in this deployment yet.'
    );
  });

  it('honors backend message for 404 when honorBackendMessage is true', () => {
    const err = new AdminApiError({
      statusCode: 404,
      payload: null,
      message: 'Tag not found',
    });
    expect(toErrorMessage(err, 'fallback', { honorBackendMessage: true })).toBe('Tag not found');
  });

  it('honors backend message for 403 when honorBackendMessage is true', () => {
    const err = new AdminApiError({
      statusCode: 403,
      payload: null,
      message: 'Custom forbidden',
    });
    expect(toErrorMessage(err, 'fallback', { honorBackendMessage: true })).toBe('Custom forbidden');
  });

  it('uses fallback when honorBackendMessage is true but message is empty', () => {
    const err = new AdminApiError({
      statusCode: 404,
      payload: null,
      message: '   ',
    });
    expect(toErrorMessage(err, 'fallback', { honorBackendMessage: true })).toBe('fallback');
  });
});
