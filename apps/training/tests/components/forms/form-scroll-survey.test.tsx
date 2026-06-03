import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormScrollSurvey } from '@/components/forms/form-scroll-survey';
import { FORMS_COMMON, getFormContent } from '@/lib/forms';
import * as formsApi from '@/lib/forms-api';
import { resetFormSessionId } from '@/lib/form-session';

const form = getFormContent('workshop-exit-feedback');

vi.mock('@/lib/forms-api', () => ({
  FormApiError: class FormApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  persistFormAnswer: vi.fn().mockResolvedValue(undefined),
  resolveFormApiConfig: vi.fn(() => ({ baseUrl: '/www', apiKey: 'test-key' })),
}));

describe('FormScrollSurvey', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.mocked(formsApi.persistFormAnswer).mockClear();
  });

  it('shows required markers and surfaces validation when submit is clicked early', () => {
    if (!form) {
      throw new Error('Expected workshop-exit-feedback form');
    }

    render(<FormScrollSurvey form={form} common={FORMS_COMMON} />);

    expect(screen.getAllByText(/\(Required\)/).length).toBeGreaterThanOrEqual(2);

    const submit = screen.getByRole('button', { name: FORMS_COMMON.scroll.submitLabel });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent(FORMS_COMMON.errors.required);
  });

  it('submits after required answers are provided', async () => {
    if (!form) {
      throw new Error('Expected workshop-exit-feedback form');
    }

    render(<FormScrollSurvey form={form} common={FORMS_COMMON} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Loved it' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: FORMS_COMMON.scroll.submitLabel }));

    await waitFor(() => {
      expect(screen.getByText(FORMS_COMMON.completion.title)).toBeInTheDocument();
    });
    expect(formsApi.persistFormAnswer).toHaveBeenCalled();
  });

  it('locks multiselect chips after max selections', () => {
    if (!form) {
      throw new Error('Expected workshop-exit-feedback form');
    }

    render(<FormScrollSurvey form={form} common={FORMS_COMMON} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mealtime scripts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practical tips' }));
    fireEvent.click(screen.getByRole('button', { name: 'Helper alignment' }));

    expect(
      screen.getByRole('button', { name: /The balanced plate \(maximum selections reached\)/ }),
    ).toBeDisabled();
  });

  it('derives multiselect hint from maxSelections template', () => {
    if (!form) {
      throw new Error('Expected workshop-exit-feedback form');
    }

    render(<FormScrollSurvey form={form} common={FORMS_COMMON} />);

    expect(screen.getByText('Pick up to 3.')).toBeInTheDocument();
  });

  it('uses a new session id after Submit another', async () => {
    if (!form) {
      throw new Error('Expected workshop-exit-feedback form');
    }

    resetFormSessionId('workshop-exit-feedback');
    render(<FormScrollSurvey form={form} common={FORMS_COMMON} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Loved it' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: FORMS_COMMON.scroll.submitLabel }));

    await waitFor(() => {
      expect(screen.getByText(FORMS_COMMON.completion.title)).toBeInTheDocument();
    });

    const firstSessionId = vi.mocked(formsApi.persistFormAnswer).mock.calls[0]?.[0].sessionId;
    expect(firstSessionId).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: FORMS_COMMON.scroll.submitAnotherLabel,
      }),
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Loved it' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Maybe' }));
    fireEvent.click(screen.getByRole('button', { name: FORMS_COMMON.scroll.submitLabel }));

    await waitFor(() => {
      const sessionIds = vi
        .mocked(formsApi.persistFormAnswer)
        .mock.calls.map((call) => call[0].sessionId);
      expect(sessionIds.some((id) => id !== firstSessionId)).toBe(true);
    });

    const secondBatchId = vi
      .mocked(formsApi.persistFormAnswer)
      .mock.calls.filter((call) => call[0].sessionId !== firstSessionId)[0]?.[0].sessionId;
    expect(secondBatchId).toBeTruthy();
    expect(secondBatchId).not.toBe(firstSessionId);
  });
});
