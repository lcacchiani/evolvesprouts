import pollsCommonJson from '@/content/polls-common.json';
import workshopFoodJun26Json from '@/content/polls/workshop-food-jun-26.json';

export interface PollQuestionBase {
  id: string;
  screen: string;
  question: string;
  /** Personal feedback after submit (correct/incorrect, presenter note, your answer). */
  showAnswer: boolean;
  /** Room-wide live aggregate bar chart from the server. */
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
  liveResults: {
    heading: string;
    totalResponsesTemplate: string;
    countTemplate: string;
  };
  completion: {
    title: string;
    description: string;
  };
  errors: {
    required: string;
    invalidEmail: string;
    persistFailed: string;
    resultsLoadFailed: string;
    missingApiConfig: string;
  };
  a11y: {
    progressTemplate: string;
  };
}

export const POLLS_COMMON = pollsCommonJson as PollsCommonContent;

/** JSON import infers `type` as `string`; assert to the poll content contract. */
const workshopFoodJun26 = workshopFoodJun26Json as PollContent;

const POLLS = {
  'workshop-food-jun-26': workshopFoodJun26,
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
