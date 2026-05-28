import { describe, expect, it } from 'vitest';

import {
  answerStateFromSessionItem,
  emptyAnswerState,
  hasUnlockablePollQuestions,
  isAnswerValid,
  mergeSessionAnswers,
} from '@/components/polls/poll-answer-state';
import type { PollQuestion } from '@/content/poll-types';

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

describe('session answer helpers', () => {
  it('maps persisted rows into local answer state', () => {
    expect(
      answerStateFromSessionItem({
        questionId: 'role',
        questionType: 'select',
        selectedOption: 'Parent',
      }),
    ).toEqual({
      selectedOption: 'Parent',
      trueFalseValue: null,
      freeText: '',
    });
    expect(
      answerStateFromSessionItem({
        questionId: 'myth1',
        questionType: 'truefalse',
        booleanAnswer: false,
      }).trueFalseValue,
    ).toBe(false);
  });

  it('merges session answers by question id', () => {
    const merged = mergeSessionAnswers([
      {
        questionId: 'role',
        questionType: 'select',
        selectedOption: 'Parent',
      },
    ]);
    expect(merged.role?.selectedOption).toBe('Parent');
  });

  it('detects unlockable questions from poll content', () => {
    const questions: PollQuestion[] = [
      {
        id: 'role',
        type: 'select',
        screen: 's',
        question: 'q',
        options: ['A'],
        showAnswer: false,
        showResults: false,
      },
      {
        id: 'challenge',
        type: 'select',
        screen: 's',
        question: 'q',
        options: ['A'],
        showAnswer: false,
        showResults: false,
      },
    ];
    expect(hasUnlockablePollQuestions(questions, new Set(['role']))).toBe(true);
    expect(hasUnlockablePollQuestions(questions, new Set(['role', 'challenge']))).toBe(
      false,
    );
  });
});
