import type { PollQuestion } from '@/content/poll-types';

export interface PublishedQuestionOptions {
  type: PollQuestion['type'];
  options?: string[];
}

export function buildQuestionOptionsMap(
  questions: readonly PollQuestion[],
): Record<string, PublishedQuestionOptions> {
  const map: Record<string, PublishedQuestionOptions> = {};
  for (const question of questions) {
    if (question.type === 'select' || question.type === 'multiselect') {
      map[question.id] = {
        type: question.type,
        options: [...question.options],
      };
      continue;
    }
    map[question.id] = { type: question.type };
  }
  return map;
}
