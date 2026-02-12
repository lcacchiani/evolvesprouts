'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { FaqContent } from '@/content';

interface FaqProps {
  content: FaqContent;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  label: string;
  items: FaqItem[];
}

const SECTION_BACKGROUND = '#FFFFFF';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const ACTIVE_TAB_BACKGROUND = '#C84A16';
const ACTIVE_TAB_TEXT = '#FFFFFF';
const INACTIVE_TAB_BACKGROUND = '#FFF4EC';
const INACTIVE_TAB_TEXT = '#5A5A5A';

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 500,
  lineHeight: '1',
  fontSize: '18px',
};

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: '1.14',
  fontSize: 'clamp(1.95rem, 4.7vw, 50px)',
};

const questionStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 600,
  lineHeight: '1.35',
  fontSize: 'clamp(1.05rem, 1.75vw, 22px)',
};

const answerStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: '1.6',
  fontSize: 'clamp(1rem, 1.45vw, 19px)',
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getFaqMatches(
  categories: FaqCategory[],
  normalizedQuery: string,
): FaqCategory[] {
  if (!normalizedQuery) {
    return categories;
  }

  return categories
    .map((category) => {
      const items = category.items.filter((item) => {
        const question = item.question.toLowerCase();
        const answer = item.answer.toLowerCase();
        return (
          question.includes(normalizedQuery) || answer.includes(normalizedQuery)
        );
      });

      if (items.length === 0) {
        return null;
      }

      return {
        ...category,
        items,
      };
    })
    .filter((category): category is FaqCategory => category !== null);
}

function FaqChevronIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-180'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M4 6L8 10L12 6'
        stroke='rgba(51,51,51,0.9)'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function FaqItems({ items }: { items: FaqItem[] }) {
  return (
    <ul className='space-y-3'>
      {items.map((item, index) => (
        <li key={`${item.question}-${index}`}>
          <details className='group rounded-2xl border border-[#E9D2BF] bg-[#FFF9F4] px-5 py-4 sm:px-6'>
            <summary className='flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden'>
              <h3 style={questionStyle}>{item.question}</h3>
              <FaqChevronIcon />
            </summary>
            <p className='mt-3 whitespace-pre-line' style={answerStyle}>
              {item.answer}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function Faq({ content }: FaqProps) {
  const categories = content.categories;
  const firstCategoryId = categories[0]?.id ?? '';
  const [activeCategoryId, setActiveCategoryId] = useState(firstCategoryId);
  const [searchValue, setSearchValue] = useState('');

  const normalizedQuery = normalizeQuery(searchValue);

  const normalizedCategories = useMemo(() => {
    if (normalizedQuery) {
      return getFaqMatches(categories, normalizedQuery);
    }

    const activeCategory = categories.find(
      (category) => category.id === activeCategoryId,
    );

    if (!activeCategory) {
      return [];
    }

    return [activeCategory];
  }, [activeCategoryId, categories, normalizedQuery]);

  return (
    <SectionShell
      id='faq'
      ariaLabel={content.title}
      dataFigmaNode='faq'
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[980px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-[11px] sm:px-5'
            style={{ borderColor: '#EECAB0' }}
          />
          <h2 className='mt-6' style={titleStyle}>
            {content.title}
          </h2>
        </div>

        <div className='mx-auto mt-8 max-w-[980px] rounded-[18px] border border-[#E9D2BF] bg-[#FFF9F4] px-4 py-3 sm:px-5'>
          <label htmlFor='faq-search' className='sr-only'>
            {content.searchPlaceholder}
          </label>
          <input
            id='faq-search'
            type='text'
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
            placeholder={content.searchPlaceholder}
            className='es-focus-ring w-full bg-transparent text-base outline-none'
            style={answerStyle}
          />
        </div>

        <div className='mt-6 overflow-x-auto pb-1 scrollbar-hide'>
          <div className='flex min-w-max gap-2'>
            {categories.map((category) => {
              const isActive = activeCategoryId === category.id;

              return (
                <button
                  key={category.id}
                  type='button'
                  onClick={() => {
                    setActiveCategoryId(category.id);
                  }}
                  className='es-focus-ring rounded-full px-4 py-2.5 text-sm font-semibold sm:text-base'
                  style={{
                    backgroundColor: isActive
                      ? ACTIVE_TAB_BACKGROUND
                      : INACTIVE_TAB_BACKGROUND,
                    color: isActive ? ACTIVE_TAB_TEXT : INACTIVE_TAB_TEXT,
                  }}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className='mt-6 space-y-5'>
          {normalizedCategories.length === 0 ? (
            <p className='rounded-2xl border border-[#E9D2BF] bg-[#FFF9F4] px-5 py-6 text-center' style={answerStyle}>
              {content.emptySearchResultsLabel}
            </p>
          ) : (
            normalizedCategories.map((category) => (
              <section key={category.id} aria-label={category.label}>
                {normalizedQuery && (
                  <h3 className='mb-3 text-lg font-semibold sm:text-xl'>
                    {category.label}
                  </h3>
                )}
                <FaqItems items={category.items} />
              </section>
            ))
          )}
        </div>
      </div>
    </SectionShell>
  );
}
