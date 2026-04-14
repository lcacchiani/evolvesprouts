import { describe, expect, it } from 'vitest';

import enContent from '@/content/en.json';
import {
  FAQ_PAGE_AUDIENCES,
  filterFaqQuestionsForAudience,
  getFaqPageAudienceFromPathname,
} from '@/lib/faq-audiences';
import { ROUTES } from '@/lib/routes';

describe('faq-audiences', () => {
  it('maps service paths to audiences', () => {
    expect(
      getFaqPageAudienceFromPathname(`/en${ROUTES.servicesMyBestAuntieTrainingCourse}`),
    ).toBe(FAQ_PAGE_AUDIENCES.myBestAuntieTrainingCourse);
    expect(
      getFaqPageAudienceFromPathname(`/zh-CN${ROUTES.servicesConsultations}/`),
    ).toBe(FAQ_PAGE_AUDIENCES.familyConsultations);
    expect(getFaqPageAudienceFromPathname('/en/about-us')).toBeUndefined();
  });

  it('filters MBA-only and consultation-only questions for each audience', () => {
    const q = enContent.faq.questions;
    const mba = filterFaqQuestionsForAudience(
      q,
      FAQ_PAGE_AUDIENCES.myBestAuntieTrainingCourse,
    );
    const consult = filterFaqQuestionsForAudience(
      q,
      FAQ_PAGE_AUDIENCES.familyConsultations,
    );

    expect(
      mba.some((item) => item.question === 'Do I need to have a helper to book a consultation?'),
    ).toBe(false);
    expect(
      consult.some((item) => item.question === 'Do I need to have a helper to book a consultation?'),
    ).toBe(true);
    expect(
      mba.some(
        (item) => item.question === 'What will my child gain from the My Best Auntie course?',
      ),
    ).toBe(true);
    expect(
      consult.some(
        (item) => item.question === 'What will my child gain from the My Best Auntie course?',
      ),
    ).toBe(false);
  });

  it('returns all questions when audience is undefined', () => {
    expect(filterFaqQuestionsForAudience(enContent.faq.questions, undefined).length).toBe(
      enContent.faq.questions.length,
    );
  });
});
