'use client';

import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionContainer } from '@/components/section-container';
import { SectionHeader } from '@/components/section-header';
import { SectionShell } from '@/components/section-shell';
import type { FaqContent } from '@/content';
import {
  BRAND_ORANGE_SOFT,
  bodyTextStyle,
  HEADING_TEXT_COLOR,
  headingTextStyle,
  SURFACE_WHITE,
} from '@/lib/design-tokens';
import {
  getLocaleFromPath,
  localizePath,
} from '@/lib/locale-routing';
import {
  buildSectionBackgroundOverlayStyle,
  LOGO_OVERLAY_TOP,
} from '@/lib/section-backgrounds';

interface FaqProps {
  content: FaqContent;
}

interface FaqQuestion {
  question: string;
  answer: string;
  labelIds: string[];
}

const ACTIVE_TAB_BACKGROUND = BRAND_ORANGE_SOFT;
const ACTIVE_TAB_TEXT = HEADING_TEXT_COLOR;
const INACTIVE_TAB_BACKGROUND = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const INACTIVE_TAB_TEXT = HEADING_TEXT_COLOR;
const CONTACT_CARD_BACKGROUND = 'var(--figma-colors-frame-2147235242, #174879)';
const CONTACT_CARD_TEXT = SURFACE_WHITE;
const CONTACT_CARD_CTA_LABEL = 'Contact Us';
const SECTION_STYLE = buildSectionBackgroundOverlayStyle({
  ...LOGO_OVERLAY_TOP,
  backgroundColor: SURFACE_WHITE,
});

const questionStyle: CSSProperties = headingTextStyle({
  fontWeight: 600,
  lineHeight: '1.42',
  fontSize: 'clamp(1.1rem, 1.7vw, 28px)',
});

const answerStyle: CSSProperties = bodyTextStyle({
  lineHeight: '1.6',
  fontSize: 'clamp(1rem, 1.3vw, 20px)',
});

const contactQuestionStyle: CSSProperties = {
  ...questionStyle,
  color: CONTACT_CARD_TEXT,
};

const contactAnswerStyle: CSSProperties = {
  ...answerStyle,
  color: CONTACT_CARD_TEXT,
};

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
                className='flex h-full flex-col rounded-[24px] px-6 py-7 sm:px-8 sm:py-8'
                style={{ backgroundColor: CONTACT_CARD_BACKGROUND }}
              >
                <h3 style={contactQuestionStyle}>{item.question}</h3>
                <p className='mt-5 whitespace-pre-line' style={contactAnswerStyle}>
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
            <article className='flex h-full flex-col rounded-[24px] es-bg-surface-muted px-6 py-7 sm:px-8 sm:py-8'>
              <h3 style={questionStyle}>{item.question}</h3>
              <div className='mt-5 border-l-[4.1px] es-divider-green pl-5 sm:pl-6'>
                <p className='whitespace-pre-line' style={answerStyle}>
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
  const contactCardCtaHref = localizePath('/contact-us', locale);
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
      className='es-section-bg-overlay'
      style={SECTION_STYLE}
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div className='es-layout-content-narrow mt-8 rounded-[58px] border es-border-soft es-bg-surface-neutral px-4 py-[13px] sm:px-6 sm:py-4'>
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
              className='es-focus-ring w-full rounded-full es-bg-surface-neutral py-3 pl-8 pr-4 text-[18px] font-semibold tracking-[0.5px] es-text-dim outline-none es-text-placeholder sm:pl-9 sm:text-[22px]'
            />
          </div>
        </div>

        <div className='mt-6 overflow-x-auto pb-1 scrollbar-hide'>
          <div className='flex min-w-max gap-2'>
            {labels.map((entry) => {
              const isActive = activeLabelId === entry.id;

              return (
                <button
                  key={entry.id}
                  type='button'
                  onClick={() => {
                    setActiveLabelId(entry.id);
                  }}
                  className='es-focus-ring es-nav-pill rounded-full px-[17px] py-[11px] text-[13px] font-semibold sm:px-[21px] sm:text-[17px]'
                  style={{
                    backgroundColor: isActive
                      ? ACTIVE_TAB_BACKGROUND
                      : INACTIVE_TAB_BACKGROUND,
                    color: isActive ? ACTIVE_TAB_TEXT : INACTIVE_TAB_TEXT,
                  }}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className='mt-10'>
          {visibleQuestions.length === 0 ? (
            <p className='rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-6 text-center' style={answerStyle}>
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
