'use client';

import { useEffect, useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { MediaForm } from '@/components/sections/media-form';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { formatContentTemplate } from '@/content/content-field-utils';
import type {
  FreeGuidesAndResourcesLibraryContent,
  ResourcesContent,
} from '@/content';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
  type CrmApiClient,
} from '@/lib/crm-api-client';

interface FreeGuidesAndResourcesLibraryProps {
  content: FreeGuidesAndResourcesLibraryContent;
  mediaFormContent: ResourcesContent;
}

const ASSET_TYPES = ['guide', 'video', 'pdf', 'document'] as const;
type AssetType = (typeof ASSET_TYPES)[number];

interface LibraryAssetRow {
  id: string;
  title: string;
  description: string;
  assetType: AssetType;
  resourceKey: string | null;
  contentLanguage: string | null;
}

const FREE_ASSETS_MAX_PAGES = 20;
const FREE_ASSETS_PAGE_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAssetType(value: unknown): AssetType {
  if (
    typeof value === 'string' &&
    (ASSET_TYPES as readonly string[]).includes(value)
  ) {
    return value as AssetType;
  }
  return 'document';
}

function parseListPayload(payload: unknown): {
  items: unknown[];
  nextCursor: string | null;
} {
  if (!isRecord(payload)) {
    return { items: [], nextCursor: null };
  }
  const rawItems = payload.items;
  const items = Array.isArray(rawItems) ? rawItems : [];
  const next = payload.next_cursor;
  const nextCursor =
    typeof next === 'string' && next.trim() ? next.trim() : null;
  return { items, nextCursor };
}

function parseAssetRow(raw: unknown): LibraryAssetRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!id || !title) {
    return null;
  }
  const description =
    typeof raw.description === 'string' ? raw.description : '';
  const cl = raw.content_language;
  const contentLanguage =
    typeof cl === 'string' && cl.trim() ? cl.trim() : null;
  const rk = raw.resource_key;
  const resourceKey = typeof rk === 'string' && rk.trim() ? rk.trim() : null;
  return {
    id,
    title,
    description,
    assetType: normalizeAssetType(raw.asset_type),
    resourceKey,
    contentLanguage,
  };
}

async function fetchAllPublicFreeAssets(
  client: CrmApiClient,
  signal: AbortSignal,
): Promise<LibraryAssetRow[]> {
  const collected: LibraryAssetRow[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < FREE_ASSETS_MAX_PAGES; page += 1) {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(FREE_ASSETS_PAGE_LIMIT));
    if (cursor) {
      searchParams.set('cursor', cursor);
    }
    const endpointPath = `/v1/assets/free?${searchParams.toString()}`;
    const payload = await client.request({ endpointPath, signal });
    const { items, nextCursor } = parseListPayload(payload);
    for (const raw of items) {
      const row = parseAssetRow(raw);
      if (row) {
        collected.push(row);
      }
    }
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return collected;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesLanguageFilter(
  item: LibraryAssetRow,
  activeLanguageId: string,
): boolean {
  if (activeLanguageId === 'all') {
    return true;
  }
  if (activeLanguageId === 'unset') {
    return item.contentLanguage === null;
  }
  return item.contentLanguage === activeLanguageId;
}

function matchesAssetTypeFilter(
  item: LibraryAssetRow,
  activeTypeId: string,
): boolean {
  if (activeTypeId === 'all') {
    return true;
  }
  return item.assetType === activeTypeId;
}

function buildLanguageLabelMap(
  content: FreeGuidesAndResourcesLibraryContent,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of content.languageFilters) {
    if (entry.id !== 'all') {
      map.set(entry.id, entry.label);
    }
  }
  return map;
}

function resolveLanguageBadgeLabel(
  item: LibraryAssetRow,
  content: FreeGuidesAndResourcesLibraryContent,
  languageLabelById: Map<string, string>,
): string {
  if (item.contentLanguage === null) {
    return content.nullLanguageLabel;
  }
  const mapped = languageLabelById.get(item.contentLanguage);
  if (mapped) {
    return mapped;
  }
  return formatContentTemplate(content.languageBadgeTemplate, {
    language: item.contentLanguage,
  });
}

function getVisibleItems(
  items: readonly LibraryAssetRow[],
  activeLanguageId: string,
  activeAssetTypeId: string,
  normalizedQuery: string,
  content: FreeGuidesAndResourcesLibraryContent,
  languageLabelById: Map<string, string>,
): LibraryAssetRow[] {
  return items.filter((entry) => {
    if (!matchesLanguageFilter(entry, activeLanguageId)) {
      return false;
    }
    if (!matchesAssetTypeFilter(entry, activeAssetTypeId)) {
      return false;
    }

    if (normalizedQuery === '') {
      return true;
    }

    const typeLabel =
      content.assetTypeLabels[entry.assetType] ?? entry.assetType;
    const langLabel = resolveLanguageBadgeLabel(
      entry,
      content,
      languageLabelById,
    );
    const searchBlob = `${entry.title}\n${entry.description}\n${typeLabel}\n${langLabel}`;

    return searchBlob.toLowerCase().includes(normalizedQuery);
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
  mediaFormContent,
}: FreeGuidesAndResourcesLibraryProps) {
  const languageFilters = content.languageFilters;
  const assetTypeFilters = content.assetTypeFilters;
  const firstLanguageId = languageFilters[0]?.id ?? 'all';
  const firstTypeId = assetTypeFilters[0]?.id ?? 'all';

  const [activeLanguageId, setActiveLanguageId] = useState(firstLanguageId);
  const [activeAssetTypeId, setActiveAssetTypeId] = useState(firstTypeId);
  const [searchValue, setSearchValue] = useState('');
  const [apiItems, setApiItems] = useState<LibraryAssetRow[]>([]);
  const crmClient = useMemo(() => createPublicCrmApiClient(), []);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>(() =>
    crmClient ? 'loading' : 'error',
  );

  const languageLabelById = useMemo(
    () => buildLanguageLabelMap(content),
    [content],
  );

  const normalizedQuery = normalizeQuery(searchValue);

  const visibleItems = useMemo(() => {
    return getVisibleItems(
      apiItems,
      activeLanguageId,
      activeAssetTypeId,
      normalizedQuery,
      content,
      languageLabelById,
    );
  }, [
    apiItems,
    activeLanguageId,
    activeAssetTypeId,
    normalizedQuery,
    content,
    languageLabelById,
  ]);

  useEffect(() => {
    if (!crmClient) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    fetchAllPublicFreeAssets(crmClient, controller.signal)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setApiItems(rows);
        setLoadState('idle');
      })
      .catch((error) => {
        if (
          cancelled ||
          controller.signal.aborted ||
          isAbortRequestError(error)
        ) {
          return;
        }
        setLoadState('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [crmClient]);

  const mediaFormFirstNameLabel = mediaFormContent.formFirstNameLabel;
  const mediaFormEmailLabel = mediaFormContent.formEmailLabel;
  const mediaFormSubmitLabel = mediaFormContent.formSubmitLabel;
  const mediaFormSuccessTitle = mediaFormContent.formSuccessTitle;
  const mediaFormSuccessBody = mediaFormContent.formSuccessBody;
  const mediaFormErrorMessage = mediaFormContent.formErrorMessage;

  const listBody = (() => {
    if (loadState === 'loading') {
      return (
        <p className='rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-6 text-center es-faq-answer'>
          {content.loadingLabel}
        </p>
      );
    }

    if (loadState === 'error') {
      return (
        <p className='rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-6 text-center es-faq-answer'>
          {content.loadErrorLabel}
        </p>
      );
    }

    if (apiItems.length === 0) {
      return (
        <p className='rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-6 text-center es-faq-answer'>
          {content.emptyApiLabel}
        </p>
      );
    }

    if (visibleItems.length === 0) {
      return (
        <p className='rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-6 text-center es-faq-answer'>
          {content.emptySearchResultsLabel}
        </p>
      );
    }

    return (
      <ul className='grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3'>
        {visibleItems.map((item) => {
          const formatLabel =
            content.assetTypeLabels[item.assetType] ?? item.assetType;
          const languageBadge = resolveLanguageBadgeLabel(
            item,
            content,
            languageLabelById,
          );
          const gatedCtaLabel = formatContentTemplate(
            content.gatedCtaLabelTemplate,
            { title: item.title },
          );

          return (
            <li key={item.id} className='h-full'>
              <article className='flex h-full flex-col rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-card sm:px-6 sm:py-6'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='es-bg-surface-muted inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold es-text-dim'>
                    {formatLabel}
                  </span>
                  <span className='es-bg-surface-muted inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold es-text-dim'>
                    {languageBadge}
                  </span>
                </div>
                <h3 className='es-type-subtitle mt-4'>{item.title}</h3>
                <p className='es-section-body mb-3 mt-3 flex-1 text-base leading-7'>
                  {item.description}
                </p>
                {item.resourceKey ? (
                  <MediaForm
                    ctaLabel={gatedCtaLabel}
                    resourceKey={item.resourceKey}
                    analyticsSectionId='free-guides-library'
                    formFirstNameLabel={mediaFormFirstNameLabel}
                    formEmailLabel={mediaFormEmailLabel}
                    formSubmitLabel={mediaFormSubmitLabel}
                    formSuccessTitle={mediaFormSuccessTitle}
                    formSuccessBody={mediaFormSuccessBody}
                    formErrorMessage={mediaFormErrorMessage}
                    ctaButtonClassName='es-btn--outline'
                    className='mt-6 w-full sm:w-fit'
                  />
                ) : (
                  <ButtonPrimitive
                    variant='primary'
                    type='button'
                    disabled
                    className='es-btn--outline mt-6 w-full sm:w-fit'
                  >
                    {content.unavailableCtaLabel}
                  </ButtonPrimitive>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    );
  })();

  return (
    <SectionShell
      id='free-guides-and-resources-library'
      ariaLabel={content.title}
      dataFigmaNode='free-guides-and-resources-library'
      className='es-section-bg-overlay es-free-guides-and-resources-library-section'
    >
      <div
        aria-hidden='true'
        className='es-course-highlights-overlay pointer-events-none absolute inset-0'
      />

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

        <div className='mt-6 space-y-4'>
          <div className='overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
            <div className='flex min-w-max snap-x snap-mandatory gap-2'>
              {languageFilters.map((entry) => {
                const isActive = activeLanguageId === entry.id;

                return (
                  <ButtonPrimitive
                    key={entry.id}
                    variant='pill'
                    state={isActive ? 'active' : 'inactive'}
                    onClick={() => {
                      setSearchValue('');
                      setActiveLanguageId(entry.id);
                    }}
                    className='snap-start rounded-full px-[17px] py-[11px] text-[13px] font-semibold sm:px-[21px] sm:text-[17px]'
                  >
                    {entry.label}
                  </ButtonPrimitive>
                );
              })}
            </div>
          </div>

          <div className='overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
            <div className='flex min-w-max snap-x snap-mandatory gap-2'>
              {assetTypeFilters.map((entry) => {
                const isActive = activeAssetTypeId === entry.id;

                return (
                  <ButtonPrimitive
                    key={entry.id}
                    variant='pill'
                    state={isActive ? 'active' : 'inactive'}
                    onClick={() => {
                      setSearchValue('');
                      setActiveAssetTypeId(entry.id);
                    }}
                    className='snap-start rounded-full px-[17px] py-[11px] text-[13px] font-semibold sm:px-[21px] sm:text-[17px]'
                  >
                    {entry.label}
                  </ButtonPrimitive>
                );
              })}
            </div>
          </div>
        </div>

        <div className='mt-10' aria-live='polite'>
          {listBody}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
