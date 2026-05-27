import { describe, expect, it } from 'vitest';

import { isAnswerValid } from '@/components/polls/poll-answer-state';
import type { PollQuestion } from '@/content/poll-types';
import { emptyAnswerState } from '@/components/polls/poll-answer-state';

describe('isAnswerValid', () => {
  const selectQuestion: PollQuestion = {
    id: 'role',
    type: 'select',
    screen: 'Who are you?',
    question: 'I am a...',
    options: ['Parent'],
    showAnswer: false,
    showResults: false,
  };

  const truefalseQuestion: PollQuestion = {
    id: 'myth1',
    type: 'truefalse',
    screen: 'Myth or fact?',
    question: 'Test',
    answer: false,
    answerNote: 'Note',
    showAnswer: true,
    showResults: true,
  };

  it('validates select, truefalse, text, and email answers', () => {
    expect(
      isAnswerValid(selectQuestion, { ...emptyAnswerState(), selectedOption: 'Parent' }),
    ).toBe(true);
    expect(
      isAnswerValid(truefalseQuestion, { ...emptyAnswerState(), trueFalseValue: true }),
    ).toBe(true);
    expect(
      isAnswerValid(
        { ...selectQuestion, type: 'text', showAnswer: false, showResults: false },
        { ...emptyAnswerState(), freeText: 'hello' },
      ),
    ).toBe(true);
    expect(
      isAnswerValid(
        { ...selectQuestion, type: 'email', showAnswer: false, showResults: false },
        { ...emptyAnswerState(), freeText: 'a@b.co' },
      ),
    ).toBe(true);
    expect(
      isAnswerValid(
        { ...selectQuestion, type: 'email', showAnswer: false, showResults: false },
        { ...emptyAnswerState(), freeText: 'not-an-email' },
      ),
    ).toBe(false);
  });
});
