import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FormWizard } from '@/components/forms/form-wizard';
import { getFormContent, FORMS_COMMON } from '@/lib/forms';
import * as formSessionStorage from '@/lib/form-session-storage';
import * as formsApi from '@/lib/forms-api';

describe('FormWizard resume', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('restores step and answers from sessionStorage', async () => {
    const form = getFormContent('workshop-feedback');
    if (!form) {
      throw new Error('expected form fixture');
    }

    const sessionKey = `evolvesprouts-form-session-id:${form.slug}`;
    window.sessionStorage.setItem(sessionKey, '550e8400-e29b-41d4-a716-446655440000');
    window.sessionStorage.setItem(
      `evolvesprouts-form-progress:${form.slug}:550e8400-e29b-41d4-a716-446655440000`,
      JSON.stringify({
        stepIndex: 1,
        answersByQuestionId: {
          name: {
            selectedOption: '',
            selectedOptions: [],
            ratingValue: null,
            trueFalseValue: null,
            freeText: 'Alex',
          },
        },
      }),
    );

    vi.spyOn(formsApi, 'persistFormAnswer').mockResolvedValue();

    render(<FormWizard form={form} common={FORMS_COMMON} />);

    await waitFor(() => {
      expect(screen.getByText(form.questions[1].question)).toBeInTheDocument();
    });
  });

  it('does not overwrite stored progress with empty state before hydration', () => {
    const form = getFormContent('workshop-feedback');
    if (!form) {
      throw new Error('expected form fixture');
    }

    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const sessionKey = `evolvesprouts-form-session-id:${form.slug}`;
    const progressKey = `evolvesprouts-form-progress:${form.slug}:${sessionId}`;
    const storedProgress = {
      stepIndex: 1,
      answersByQuestionId: {
        name: {
          selectedOption: '',
          selectedOptions: [],
          ratingValue: null,
          trueFalseValue: null,
          freeText: 'Alex',
        },
      },
    };

    window.sessionStorage.setItem(sessionKey, sessionId);
    window.sessionStorage.setItem(progressKey, JSON.stringify(storedProgress));

    const saveSpy = vi.spyOn(formSessionStorage, 'saveFormProgress');
    vi.spyOn(formsApi, 'persistFormAnswer').mockResolvedValue();

    render(<FormWizard form={form} common={FORMS_COMMON} />);

    expect(window.sessionStorage.getItem(progressKey)).toBe(JSON.stringify(storedProgress));
    expect(saveSpy).not.toHaveBeenCalledWith(
      form.slug,
      sessionId,
      expect.objectContaining({
        stepIndex: 0,
        answersByQuestionId: {},
      }),
    );
  });
});
