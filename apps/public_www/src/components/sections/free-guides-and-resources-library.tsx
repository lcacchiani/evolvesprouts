'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { LoadingGearIcon } from '@/components/shared/loading-gear-icon';
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
  listKey: string;
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

function stableFingerprintForRow(raw: Record<string, unknown>): string {
  const parts = [
    typeof raw.title === 'string' ? raw.title : '',
    typeof raw.description === 'string' ? raw.description : '',
    typeof raw.asset_type === 'string' ? raw.asset_type : '',
    typeof raw.resource_key === 'string' ? raw.resource_key : '',
    typeof raw.content_language === 'string' ? raw.content_language : '',
    typeof raw.updated_at === 'string' ? raw.updated_at : '',
  ];
  return parts.join('\u0000');
}

function parseAssetRow(raw: unknown, index: number): LibraryAssetRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    return null;
  }
  const description =
    typeof raw.description === 'string' ? raw.description : '';
  const cl = raw.content_language;
  const contentLanguage =
    typeof cl === 'string' && cl.trim() ? cl.trim() : null;
  const rk = raw.resource_key;
  const resourceKey = typeof rk === 'string' && rk.trim() ? rk.trim() : null;
  const fingerprint = stableFingerprintForRow(raw);
  return {
    listKey: `${fingerprint}\u0000${index}`,
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
      const row = parseAssetRow(raw, collected.length);
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

function buildLanguageFlagMap(
  content: FreeGuidesAndResourcesLibraryContent,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of content.languageFlags) {
    map.set(entry.id, entry.flagSrc);
  }
  return map;
}

function buildLanguageFlagAltLabelMap(
  content: FreeGuidesAndResourcesLibraryContent,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of content.languageFlags) {
    map.set(entry.id, entry.altLabel);
  }
  return map;
}

function resolveLanguageFlagAlt(
  item: LibraryAssetRow,
  content: FreeGuidesAndResourcesLibraryContent,
  flagAltLabelById: Map<string, string>,
): string {
  if (item.contentLanguage === null) {
    return content.nullLanguageFlagAlt;
  }
  const mapped = flagAltLabelById.get(item.contentLanguage);
  if (mapped) {
    return formatContentTemplate(content.flagAltTemplate, { label: mapped });
  }
  return formatContentTemplate(content.languageBadgeTemplate, {
    language: item.contentLanguage,
  });
}

function getVisibleItems(
  items: readonly LibraryAssetRow[],
  normalizedQuery: string,
  content: FreeGuidesAndResourcesLibraryContent,
): LibraryAssetRow[] {
  return items.filter((entry) => {
    if (normalizedQuery === '') {
      return true;
    }

    const typeLabel =
      content.assetTypeLabels[entry.assetType] ?? entry.assetType;
    const langLabel =
      entry.contentLanguage === null
        ? content.nullLanguageLabel
        : flagAltLabelByIdFromContent(entry.contentLanguage, content);
    const searchBlob = `${entry.title}\n${entry.description}\n${typeLabel}\n${langLabel}`;

    return searchBlob.toLowerCase().includes(normalizedQuery);
  });
}

function flagAltLabelByIdFromContent(
  languageId: string,
  content: FreeGuidesAndResourcesLibraryContent,
): string {
  const entry = content.languageFlags.find((f) => f.id === languageId);
  if (entry) {
    return entry.altLabel;
  }
  return formatContentTemplate(content.languageBadgeTemplate, {
    language: languageId,
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
  const [searchValue, setSearchValue] = useState('');
  const [apiItems, setApiItems] = useState<LibraryAssetRow[]>([]);
  const crmClient = useMemo(() => createPublicCrmApiClient(), []);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>(() =>
    crmClient ? 'loading' : 'error',
  );

  const languageFlagById = useMemo(
    () => buildLanguageFlagMap(content),
    [content],
  );

  const languageFlagAltLabelById = useMemo(
    () => buildLanguageFlagAltLabelMap(content),
    [content],
  );

  const normalizedQuery = normalizeQuery(searchValue);

  const visibleItems = useMemo(() => {
    return getVisibleItems(apiItems, normalizedQuery, content);
  }, [apiItems, normalizedQuery, content]);

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
        <div className='flex flex-col items-center gap-3 rounded-2xl border es-border-soft-alt es-bg-surface-soft px-5 py-8 text-center sm:py-10'>
          <span
            role='status'
            aria-label={content.loadingLabel}
            className='inline-flex h-12 w-12 items-center justify-center rounded-full border es-border-soft es-loading-gear-bubble'
          >
            <LoadingGearIcon
              className='h-7 w-7 animate-spin'
              testId='free-guides-library-loading-gear'
            />
          </span>
          <p className='es-faq-answer'>{content.loadingLabel}</p>
        </div>
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
          const flagSrc = item.contentLanguage
            ? languageFlagById.get(item.contentLanguage)
            : null;
          const flagAlt = resolveLanguageFlagAlt(
            item,
            content,
            languageFlagAltLabelById,
          );
          const gatedCtaLabel = formatContentTemplate(
            content.gatedCtaLabelTemplate,
            { title: item.title },
          );

          return (
            <li key={item.listKey} className='h-full'>
              <article className='flex h-full flex-col rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-card sm:px-6 sm:py-6'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='es-bg-surface-muted inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold es-text-dim'>
                    {formatLabel}
                  </span>
                  {flagSrc ? (
                    <span className='es-bg-surface-muted inline-flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10'>
                      <Image
                        src={flagSrc}
                        alt={flagAlt}
                        width={44}
                        height={32}
                        className='h-full w-full object-cover'
                      />
                    </span>
                  ) : (
                    <span className='es-bg-surface-muted inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold es-text-dim'>
                      {item.contentLanguage === null
                        ? content.nullLanguageLabel
                        : formatContentTemplate(content.languageBadgeTemplate, {
                            language: item.contentLanguage,
                          })}
                    </span>
                  )}
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

        <div className='mt-10' aria-live='polite'>
          {listBody}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
