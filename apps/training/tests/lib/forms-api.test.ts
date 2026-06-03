import { describe, expect, it } from 'vitest';

import { emptyFormAnswerState } from '@/components/forms/form-answer-state';
import { buildPersistBody } from '@/lib/forms-api';
import type { FormQuestion } from '@/content/form-types';

describe('buildPersistBody', () => {
  it('maps rating answers to ratingValue', () => {
    const question: FormQuestion = {
      id: 'usefulness',
      type: 'rating',
      question: 'How useful?',
      options: [{ value: 5, emoji: '🤩' }],
    };
    const body = buildPersistBody({
      formSlug: 'workshop-exit-feedback',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      question,
      answer: { ...emptyFormAnswerState(), ratingValue: 5 },
    });
    expect(body).toMatchObject({
      questionType: 'rating',
      ratingValue: 5,
    });
  });

  it('skips empty optional text answers', () => {
    const question: FormQuestion = {
      id: 'missed',
      type: 'text',
      question: 'Missed?',
      required: false,
    };
    expect(
      buildPersistBody({
        formSlug: 'workshop-exit-feedback',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        question,
        answer: emptyFormAnswerState(),
      }),
    ).toBeNull();
  });
});
