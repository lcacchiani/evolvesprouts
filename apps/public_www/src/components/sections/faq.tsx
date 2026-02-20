'use client';

import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { FaqContent } from '@/content';
import {
  getLocaleFromPath,
  localizePath,
} from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';

interface FaqProps {
  content: FaqContent;
}

interface FaqQuestion {
  question: string;
  answer: string;
  labelIds: string[];
}

const CONTACT_CARD_CTA_LABEL = 'Contact Us';

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getVisibleQuestions(
  questions: FaqQuestion[],
  activeLabelId: string,
  normalizedQuery: string,
): FaqQuestion[] {
  return questions.filter((entry) => {
    const queryMatch =
      normalizedQuery === '' ||
      entry.question.toLowerCase().includes(normalizedQuery) ||
      entry.answer.toLowerCase().includes(normalizedQuery);

    if (!queryMatch) {
      return false;
    }

    if (normalizedQuery !== '') {
      return true;
    }

    if (activeLabelId === '') {
      return true;
    }

    return entry.labelIds.includes(activeLabelId);
  });
}

function FaqLensIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 20 20'
      className='h-5 w-5 shrink-0'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle
        cx='8.5'
        cy='8.5'
        r='5.8'
        stroke='currentColor'
        strokeWidth='1.9'
      />
      <line
        x1='12.7'
        y1='12.7'
        x2='17.1'
        y2='17.1'
        stroke='currentColor'
        strokeWidth='1.9'
        strokeLinecap='round'
      />
    </svg>
  );
}

function isContactUsPromptQuestion(
  question: FaqQuestion,
  allLabelIds: Set<string>,
): boolean {
  if (allLabelIds.size === 0 || question.labelIds.length < allLabelIds.size) {
    return false;
  }

  const questionLabelIds = new Set(question.labelIds);
  for (const labelId of allLabelIds) {
    if (!questionLabelIds.has(labelId)) {
      return false;
    }
  }

  return /contact us/i.test(question.answer);
}

function FaqItems({
  items,
  allLabelIds,
  contactCardCtaHref,
}: {
  items: FaqQuestion[];
  allLabelIds: Set<string>;
  contactCardCtaHref: string;
}) {
  return (
    <ul className='grid grid-cols-1 gap-5 md:grid-cols-2'>
      {items.map((item, index) => {
        const isContactCard = isContactUsPromptQuestion(item, allLabelIds);

        if (isContactCard) {
          return (
            <li key={`${item.question}-${index}`} className='h-full'>
              <article
                className='flex h-full flex-col rounded-3xl px-6 py-7 sm:px-8 sm:py-8 es-faq-contact-card'
              >
                <h3 className='es-faq-contact-question'>{item.question}</h3>
                <p className='mt-5 whitespace-pre-line es-faq-contact-answer'>
                  {item.answer}
                </p>
                <SectionCtaAnchor
                  href={contactCardCtaHref}
                  className='mt-6 w-full sm:w-fit sm:min-w-[190px]'
                >
                  {CONTACT_CARD_CTA_LABEL}
                </SectionCtaAnchor>
              </article>
            </li>
          );
        }

        return (
          <li key={`${item.question}-${index}`} className='h-full'>
            <article className='flex h-full flex-col rounded-3xl es-bg-surface-muted px-6 py-7 sm:px-8 sm:py-8'>
              <h3 className='es-faq-question'>{item.question}</h3>
              <div className='mt-5 border-l-[4.1px] es-divider-green pl-5 sm:pl-6'>
                <p className='whitespace-pre-line es-faq-answer'>
                  {item.answer}
                </p>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export function Faq({ content }: FaqProps) {
  const pathname = usePathname();
  const labels = content.labels;
  const questions = content.questions;
  const locale = getLocaleFromPath(pathname ?? '/');
  const contactCardCtaHref = localizePath(ROUTES.contact, locale);
  const allLabelIds = useMemo(
    () => new Set(labels.map((entry) => entry.id)),
    [labels],
  );
  const firstLabelId = labels[0]?.id ?? '';
  const [activeLabelId, setActiveLabelId] = useState(firstLabelId);
  const [searchValue, setSearchValue] = useState('');

  const normalizedQuery = normalizeQuery(searchValue);

  const visibleQuestions = useMemo(() => {
    return getVisibleQuestions(questions, activeLabelId, normalizedQuery);
  }, [questions, activeLabelId, normalizedQuery]);

  return (
    <SectionShell
      id='faq'
      ariaLabel={content.title}
      dataFigmaNode='faq'
      className='es-section-bg-overlay es-faq-section'
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div className='es-layout-container mt-8 rounded-full border es-border-soft es-bg-surface-neutral px-4 py-[13px] sm:px-6 sm:py-4'>
          <div className='relative'>
            <label htmlFor='faq-search' className='sr-only'>
              {content.searchPlaceholder}
            </label>
            <span className='pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 es-text-heading'>
              <FaqLensIcon />
            </span>
            <input
              id='faq-search'
              type='text'
              value={searchValue}
              onChange={(event) => {
                setSearchValue(event.target.value);
              }}
              placeholder={content.searchPlaceholder}
              className='es-focus-ring w-full rounded-full es-bg-surface-neutral py-3 pl-8 pr-4 text-lg font-semibold tracking-[0.5px] es-text-dim outline-none es-text-placeholder sm:pl-9 sm:text-[22px]'
            />
          </div>
        </div>

        <div className='mt-6 overflow-x-auto pb-1 scrollbar-hide'>
          <div className='flex min-w-max gap-2'>
            {labels.map((entry) => {
              const isActive = activeLabelId === entry.id;

              return (
                <ButtonPrimitive
                  key={entry.id}
                  variant='pill'
                  state={isActive ? 'active' : 'inactive'}
                  onClick={() => {
                    setActiveLabelId(entry.id);
                  }}
                  className='rounded-full px-[17px] py-[11px] text-[13px] font-semibold sm:px-[21px] sm:text-[17px]'
                >
                  {entry.label}
                </ButtonPrimitive>
              );
            })}
          </div>
        </div>

        <div className='mt-10'>
          {visibleQuestions.length === 0 ? (
            <p className='rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-6 text-center es-faq-answer'>
              {content.emptySearchResultsLabel}
            </p>
          ) : (
            <FaqItems
              items={visibleQuestions}
              allLabelIds={allLabelIds}
              contactCardCtaHref={contactCardCtaHref}
            />
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
