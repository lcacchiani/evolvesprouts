import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyFormAnswerState } from '@/components/forms/form-answer-state';
import { FormQuestionField } from '@/components/forms/form-question-field';
import { FORMS_COMMON } from '@/lib/forms';
import type { FormQuestion } from '@/content/form-types';

describe('FormQuestionField accessibility', () => {
  it('includes consent text in the consent control accessible name', () => {
    const question: FormQuestion = {
      id: 'share-consent',
      type: 'consent',
      question: 'Sharing permission',
      consentText: 'You may share my comments with other families.',
      required: false,
    };

    render(
      <FormQuestionField
        question={question}
        common={FORMS_COMMON}
        answer={emptyFormAnswerState()}
        onAnswerChange={vi.fn()}
      />,
    );

    const control = screen.getByRole('checkbox', {
      name: /You may share my comments with other families/,
    });
    expect(control).not.toBeChecked();
  });

  it('selects segmented options with keyboard on native radios', () => {
    const onAnswerChange = vi.fn();
    const question: FormQuestion = {
      id: 'recommend',
      type: 'segmented',
      question: 'Would you recommend?',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
      required: true,
    };

    render(
      <FormQuestionField
        question={question}
        common={FORMS_COMMON}
        answer={emptyFormAnswerState()}
        onAnswerChange={onAnswerChange}
      />,
    );

    const yesRadio = screen.getByRole('radio', { name: 'Yes' });
    fireEvent.click(yesRadio);
    expect(onAnswerChange).toHaveBeenCalledWith({ selectedOption: 'Yes' });
  });

  it('selects rating options with keyboard on native radios', () => {
    const onAnswerChange = vi.fn();
    const question: FormQuestion = {
      id: 'usefulness',
      type: 'rating',
      question: 'How useful?',
      options: [{ value: 5, emoji: '🤩', ariaLabel: 'Loved it' }],
      required: true,
    };

    render(
      <FormQuestionField
        question={question}
        common={FORMS_COMMON}
        answer={emptyFormAnswerState()}
        onAnswerChange={onAnswerChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Loved it' }));
    expect(onAnswerChange).toHaveBeenCalledWith({ ratingValue: 5 });
  });
});
