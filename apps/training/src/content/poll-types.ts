import pollsCommonJson from '@/content/polls-common.json';
import workshopFoodJun26Json from '@/content/polls/workshop-food-jun-26.json';

export type PollSelectionMode = 'single' | 'multiple';

export type PollQuestionType = 'choice' | 'text';

export interface PollAnswerOption {
  id: string;
  text: string;
}

export interface PollChoiceQuestion {
  id: string;
  type: 'choice';
  selectionMode: PollSelectionMode;
  allowOther: boolean;
  text: string;
  answers: PollAnswerOption[];
}

export interface PollTextQuestion {
  id: string;
  type: 'text';
  text: string;
}

export type PollQuestion = PollChoiceQuestion | PollTextQuestion;

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
  };
  choice: {
    otherLabel: string;
    otherPlaceholder: string;
  };
  completion: {
    title: string;
    description: string;
  };
  errors: {
    required: string;
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

export const POLL_OTHER_ANSWER_ID = 'other';
