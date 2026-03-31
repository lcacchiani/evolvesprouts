'use client';

import { useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { FreeGuidesAndResourcesLibraryContent } from '@/content';

interface FreeGuidesAndResourcesLibraryProps {
  content: FreeGuidesAndResourcesLibraryContent;
}

interface LibraryItem {
  id: string;
  title: string;
  description: string;
  format: string;
  categoryId: string;
  ctaLabel: string;
  ctaHref: string;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getVisibleItems(
  items: readonly LibraryItem[],
  activeCategoryId: string,
  normalizedQuery: string,
): LibraryItem[] {
  return items.filter((entry) => {
    const queryMatch =
      normalizedQuery === '' ||
      entry.title.toLowerCase().includes(normalizedQuery) ||
      entry.description.toLowerCase().includes(normalizedQuery);

    if (!queryMatch) {
      return false;
    }

    if (normalizedQuery !== '') {
      return true;
    }

    if (activeCategoryId === 'all') {
      return true;
    }

    return entry.categoryId === activeCategoryId;
  });
}

function LibraryLensIcon() {
  return (
    <span
      aria-hidden
      className='es-ui-icon-mask es-ui-icon-mask--faq-lens inline-block h-5 w-5 shrink-0'
    />
  );
}

export function FreeGuidesAndResourcesLibrary({
  content,
}: FreeGuidesAndResourcesLibraryProps) {
  const categories = content.categories;
  const items = content.items;
  const firstCategoryId = categories[0]?.id ?? 'all';
  const [activeCategoryId, setActiveCategoryId] = useState(firstCategoryId);
  const [searchValue, setSearchValue] = useState('');

  const normalizedQuery = normalizeQuery(searchValue);

  const visibleItems = useMemo(() => {
    return getVisibleItems(items, activeCategoryId, normalizedQuery);
  }, [items, activeCategoryId, normalizedQuery]);

  return (
    <SectionShell
      id='free-guides-and-resources-library'
      ariaLabel={content.title}
      dataFigmaNode='free-guides-and-resources-library'
      className='es-section-bg-overlay'
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div className='relative mt-8 rounded-full border es-border-soft es-bg-surface-neutral px-4 py-[13px] sm:px-6 sm:py-4'>
          <label htmlFor='free-guides-library-search' className='sr-only'>
            {content.searchPlaceholder}
          </label>
          <span className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 es-text-heading sm:left-6'>
            <LibraryLensIcon />
          </span>
          <input
            id='free-guides-library-search'
            type='text'
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
            placeholder={content.searchPlaceholder}
            className='es-focus-ring w-full rounded-full es-bg-surface-neutral pl-8 pr-4 text-lg font-semibold tracking-[0.5px] es-text-dim outline-none es-text-placeholder sm:pl-9 sm:text-[22px]'
          />
        </div>

        <div className='mt-6 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
          <div className='flex min-w-max snap-x snap-mandatory gap-2'>
            {categories.map((entry) => {
              const isActive = activeCategoryId === entry.id;

              return (
                <ButtonPrimitive
                  key={entry.id}
                  variant='pill'
                  state={isActive ? 'active' : 'inactive'}
                  onClick={() => {
                    setSearchValue('');
                    setActiveCategoryId(entry.id);
                  }}
                  className='snap-start rounded-full px-[17px] py-[11px] text-[13px] font-semibold sm:px-[21px] sm:text-[17px]'
                >
                  {entry.label}
                </ButtonPrimitive>
              );
            })}
          </div>
        </div>

        <div className='mt-10'>
          {visibleItems.length === 0 ? (
            <p className='rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-6 text-center es-faq-answer'>
              {content.emptySearchResultsLabel}
            </p>
          ) : (
            <ul className='grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3'>
              {visibleItems.map((item) => (
                <li key={item.id} className='h-full'>
                  <article className='flex h-full flex-col rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-card sm:px-6 sm:py-6'>
                    <span className='es-bg-surface-muted inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold es-text-dim'>
                      {item.format}
                    </span>
                    <h3 className='es-type-subtitle mt-4'>{item.title}</h3>
                    <p className='es-section-body mt-3 flex-1 text-base leading-7'>
                      {item.description}
                    </p>
                    <ButtonPrimitive
                      variant='outline'
                      href={item.ctaHref}
                      className='mt-6 w-full sm:w-fit'
                    >
                      {item.ctaLabel}
                    </ButtonPrimitive>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
