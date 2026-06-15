import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FormWizard } from '@/components/forms/form-wizard';
import { getFormContent, FORMS_COMMON } from '@/lib/forms';
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
});
