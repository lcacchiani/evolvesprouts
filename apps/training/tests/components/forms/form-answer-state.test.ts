import { describe, expect, it } from 'vitest';

import {
  emptyFormAnswerState,
  getFormValidationError,
  isFormAnswerValid,
  toggleMultiselectOption,
} from '@/components/forms/form-answer-state';
import type { FormQuestion } from '@/content/form-types';
import { FORMS_COMMON } from '@/lib/forms';

describe('form answer state', () => {
  it('validates rating when required', () => {
    const question: FormQuestion = {
      id: 'usefulness',
      type: 'rating',
      question: 'How useful?',
      options: [{ value: 1, emoji: '😕' }],
      required: true,
    };
    expect(isFormAnswerValid(question, emptyFormAnswerState())).toBe(false);
    expect(
      isFormAnswerValid(question, { ...emptyFormAnswerState(), ratingValue: 3 }),
    ).toBe(true);
  });

  it('enforces multiselect max selections in toggle helper', () => {
    const current = ['A', 'B'];
    expect(toggleMultiselectOption(current, 'C', 3)).toEqual(['A', 'B', 'C']);
    expect(toggleMultiselectOption(current, 'C', 2)).toEqual(['A', 'B']);
    expect(toggleMultiselectOption(current, 'A', 3)).toEqual(['B']);
  });

  it('allows optional text to be empty', () => {
    const question: FormQuestion = {
      id: 'missed',
      type: 'text',
      question: 'Anything missed?',
      required: false,
    };
    expect(isFormAnswerValid(question, emptyFormAnswerState())).toBe(true);
  });

  it('returns required message for empty required multiselect', () => {
    const question: FormQuestion = {
      id: 'topics',
      type: 'multiselect',
      question: 'Topics',
      options: ['A'],
      maxSelections: 2,
      required: true,
    };
    expect(getFormValidationError(question, emptyFormAnswerState(), FORMS_COMMON)).toBe(
      FORMS_COMMON.errors.required,
    );
  });

  it('returns max-selection message when multiselect exceeds limit', () => {
    const question: FormQuestion = {
      id: 'topics',
      type: 'multiselect',
      question: 'Topics',
      options: ['A', 'B', 'C'],
      maxSelections: 2,
      required: false,
    };
    expect(
      getFormValidationError(
        question,
        { ...emptyFormAnswerState(), selectedOptions: ['A', 'B', 'C'] },
        FORMS_COMMON,
      ),
    ).toBe('Please select at most 2 options.');
  });

  it('validates optional consent without follow-up', () => {
    const question: FormQuestion = {
      id: 'share',
      type: 'consent',
      question: 'Share',
      consentText: 'May share',
      required: false,
    };
    expect(isFormAnswerValid(question, emptyFormAnswerState())).toBe(true);
    expect(
      isFormAnswerValid(question, {
        ...emptyFormAnswerState(),
        trueFalseValue: true,
      }),
    ).toBe(true);
  });
});
