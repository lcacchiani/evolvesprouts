import pollsCommonJson from '@/content/polls-common.json';
import workshopFoodJun26Json from '@/content/polls/workshop-food-jun-26.json';

export interface PollQuestionBase {
  id: string;
  screen: string;
  question: string;
  showResults: boolean;
}

export interface PollSelectQuestion extends PollQuestionBase {
  type: 'select';
  options: string[];
  presenterNote?: string;
}

export interface PollTrueFalseQuestion extends PollQuestionBase {
  type: 'truefalse';
  answer: boolean;
  answerNote: string;
}

export interface PollTextQuestion extends PollQuestionBase {
  type: 'text';
}

export interface PollEmailQuestion extends PollQuestionBase {
  type: 'email';
}

export type PollQuestion =
  | PollSelectQuestion
  | PollTrueFalseQuestion
  | PollTextQuestion
  | PollEmailQuestion;

export interface PollContent {
  title: string;
  slug: string;
  questions: PollQuestion[];
}

export interface PollsCommonContent {
  navigation: {
    back: string;
    next: string;
    finish: string;
    continue: string;
  };
  truefalse: {
    trueLabel: string;
    falseLabel: string;
    correctHeading: string;
    incorrectHeading: string;
  };
  results: {
    yourAnswerTemplate: string;
  };
  completion: {
    title: string;
    description: string;
  };
  errors: {
    required: string;
    invalidEmail: string;
    persistFailed: string;
    missingApiConfig: string;
  };
  a11y: {
    progressTemplate: string;
  };
}

export const POLLS_COMMON = pollsCommonJson as PollsCommonContent;

const POLLS = {
  'workshop-food-jun-26': workshopFoodJun26Json,
} satisfies Record<string, PollContent>;

export type PollSlug = keyof typeof POLLS;

const POLL_SLUGS = Object.freeze(Object.keys(POLLS) as PollSlug[]);

export function getAllPollSlugs(): PollSlug[] {
  return [...POLL_SLUGS];
}

export function isValidPollSlug(slug: string): slug is PollSlug {
  return slug in POLLS;
}

export function getPollContent(slug: string): PollContent | null {
  if (!isValidPollSlug(slug)) {
    return null;
  }
  return POLLS[slug];
}

export function buildPollPath(slug: PollSlug | string): string {
  return `/polls/${slug}/`;
}
