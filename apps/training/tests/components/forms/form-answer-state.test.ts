import { describe, expect, it } from 'vitest';

import {
  emptyFormAnswerState,
  isFormAnswerValid,
  toggleMultiselectOption,
} from '@/components/forms/form-answer-state';
import type { FormQuestion } from '@/content/form-types';

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
