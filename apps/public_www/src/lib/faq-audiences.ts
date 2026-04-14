import type { SiteContent } from '@/content';
import { ROUTES } from '@/lib/routes';

export type FaqPageAudience = 'my-best-auntie-training-course' | 'family-consultations';

export const FAQ_PAGE_AUDIENCES = {
  myBestAuntieTrainingCourse: 'my-best-auntie-training-course',
  familyConsultations: 'family-consultations',
} as const satisfies Record<string, FaqPageAudience>;

export type FaqQuestionEntry = SiteContent['faq']['questions'][number];

/**
 * Returns which service FAQ view applies for the current path, or undefined when
 * the shared FAQ component is not scoped to a single audience (show all questions).
 */
export function getFaqPageAudienceFromPathname(pathname: string): FaqPageAudience | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized.includes(ROUTES.servicesMyBestAuntieTrainingCourse)) {
    return FAQ_PAGE_AUDIENCES.myBestAuntieTrainingCourse;
  }
  if (normalized.includes(ROUTES.servicesConsultations)) {
    return FAQ_PAGE_AUDIENCES.familyConsultations;
  }
  return undefined;
}

function questionAllowsAudience(
  question: FaqQuestionEntry,
  audience: FaqPageAudience,
): boolean {
  const audiences = question.pageAudiences;
  if (!audiences || audiences.length === 0) {
    return true;
  }
  return audiences.includes(audience);
}

export function filterFaqQuestionsForAudience(
  questions: readonly FaqQuestionEntry[],
  audience: FaqPageAudience | undefined,
): FaqQuestionEntry[] {
  if (!audience) {
    return [...questions];
  }
  return questions.filter((q) => questionAllowsAudience(q, audience));
}
