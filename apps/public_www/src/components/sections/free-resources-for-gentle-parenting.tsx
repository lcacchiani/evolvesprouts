import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import {
  readCandidateText,
  readCandidateTextFromUnknown,
  readOptionalText,
  readStringUnion,
  toRecord,
} from '@/content/content-field-utils';
import type { ResourcesContent } from '@/content';

interface FreeResourcesForGentleParentingProps {
  content: ResourcesContent;
}

interface ChecklistEntry {
  title: string;
  description?: string;
}

type HeaderAlignment = 'left' | 'center';
type LayoutVariant = 'split' | 'overlay';
type HorizontalPosition = 'left' | 'right';

interface ResourceSectionConfig {
  headerAlignment?: HeaderAlignment;
  layoutVariant?: LayoutVariant;
  imagePosition?: HorizontalPosition;
  cardPosition?: HorizontalPosition;
}

interface ResourceCardContentProps {
  cardTitle: string;
  cardDescription?: string;
  checklistItems: ChecklistEntry[];
  ctaLabel: string;
  ctaHref: string;
}

const HEADER_ALIGNMENT_VALUES = ['left', 'center'] as const;
const LAYOUT_VARIANT_VALUES = ['split', 'overlay'] as const;
const HORIZONTAL_POSITION_VALUES = ['left', 'right'] as const;

const RESOURCE_IMAGE_SRC = '/images/family.webp';
const GREEN_ACCENT = 'var(--es-color-accent-green, #5D9D49)';

function readSectionConfig(
  customContent: Record<string, unknown>,
): ResourceSectionConfig {
  const headerAlignmentValue =
    readCandidateTextFromUnknown(customContent.sectionConfig, [
      'headerAlignment',
      'headingAlignment',
      'titleAlignment',
    ]) ??
    readCandidateText(customContent, [
      'headerAlignment',
      'headingAlignment',
      'titleAlignment',
    ]);
  const layoutVariantValue =
    readCandidateTextFromUnknown(customContent.sectionConfig, [
      'layoutVariant',
      'layout',
    ]) ??
    readCandidateText(customContent, ['layoutVariant', 'layout']);
  const imagePositionValue =
    readCandidateTextFromUnknown(customContent.sectionConfig, [
      'imagePosition',
      'mediaPosition',
    ]) ??
    readCandidateText(customContent, ['imagePosition', 'mediaPosition']);
  const cardPositionValue =
    readCandidateTextFromUnknown(customContent.sectionConfig, [
      'cardPosition',
      'textCardPosition',
    ]) ??
    readCandidateText(customContent, ['cardPosition', 'textCardPosition']);

  return {
    headerAlignment: readStringUnion(
      headerAlignmentValue,
      HEADER_ALIGNMENT_VALUES,
    ),
    layoutVariant: readStringUnion(layoutVariantValue, LAYOUT_VARIANT_VALUES),
    imagePosition: readStringUnion(
      imagePositionValue,
      HORIZONTAL_POSITION_VALUES,
    ),
    cardPosition: readStringUnion(cardPositionValue, HORIZONTAL_POSITION_VALUES),
  };
}

function parseChecklistEntry(value: string): ChecklistEntry | null {
  const normalized = readOptionalText(value);
  if (!normalized) {
    return null;
  }

  const separator = normalized.match(/[:：]/);
  if (!separator || separator.index === undefined) {
    return { title: normalized };
  }

  const separatorIndex = separator.index;
  const heading = normalized.slice(0, separatorIndex + 1).trim();
  const description = normalized.slice(separatorIndex + 1).trim();

  if (!heading) {
    return { title: normalized };
  }

  if (!description) {
    return { title: heading };
  }

  return {
    title: heading,
    description,
  };
}

function resolveChecklistItems(items: unknown): ChecklistEntry[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === 'string') {
        return parseChecklistEntry(item);
      }

      const typedItem = toRecord(item);
      if (typedItem) {
        const title =
          readOptionalText(typedItem.label) ??
          readOptionalText(typedItem.title) ??
          readOptionalText(typedItem.heading);
        const description =
          readOptionalText(typedItem.description) ??
          readOptionalText(typedItem.text) ??
          readOptionalText(typedItem.body);

        if (!title && !description) {
          return null;
        }

        if (!title && description) {
          return parseChecklistEntry(description);
        }

        if (!title) {
          return null;
        }

        if (!description) {
          return parseChecklistEntry(title) ?? { title };
        }

        return {
          title,
          description,
        };
      }

      return null;
    })
    .filter((item): item is ChecklistEntry => item !== null)
    .slice(0, 3);
}

function ChecklistIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 28 28'
      className='h-7 w-7 shrink-0'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle
        cx='14'
        cy='14'
        r='12.5'
        fill='rgba(93, 157, 73, 0.14)'
        stroke={GREEN_ACCENT}
      />
      <path
        d='M8.5 14.7L12.2 18.2L19.6 10.7'
        stroke={GREEN_ACCENT}
        strokeWidth='2.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function ResourceCardContent({
  cardTitle,
  cardDescription,
  checklistItems,
  ctaLabel,
  ctaHref,
}: ResourceCardContentProps) {
  return (
    <>
      <h3 className='max-w-[366px] text-balance es-free-resources-card-title'>
        {cardTitle}
      </h3>

      {cardDescription && (
        <p className='mt-4 max-w-[420px] text-balance es-free-resources-card-body'>
          {cardDescription}
        </p>
      )}

      {checklistItems.length > 0 && (
        <ul className='mb-7 mt-7 space-y-3 sm:mb-8 sm:mt-8'>
          {checklistItems.map((item) => (
            <li
              key={`${item.title}-${item.description ?? ''}`}
              className='rounded-xl bg-white px-4 py-[18px] sm:px-5'
            >
              <p className='relative pl-9 es-free-resources-checklist-title'>
                <span className='absolute left-0 top-[-1px]'>
                  <ChecklistIcon />
                </span>
                {item.title}
              </p>
              {item.description && (
                <p className='mt-2 pl-9 es-free-resources-checklist-description'>
                  {item.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <SectionCtaAnchor
        href={ctaHref}
        className='mt-auto w-full max-w-[360px]'
      >
        {ctaLabel}
      </SectionCtaAnchor>
    </>
  );
}

export function FreeResourcesForGentleParenting({
  content,
}: FreeResourcesForGentleParentingProps) {
  const customContent = content as Record<string, unknown>;
  const sectionConfig = readSectionConfig(customContent);
  const eyebrowLabel =
    readOptionalText(customContent.eyebrow) ?? content.title;
  const cardTitle =
    readOptionalText(customContent.cardTitle) ?? content.title;
  const cardDescription =
    readOptionalText(customContent.cardDescription) ??
    content.description;
  const ctaLabel =
    readOptionalText(customContent.ctaLabel) ??
    `${content.title} PDF`;
  const ctaHref =
    readOptionalText(customContent.ctaHref) ?? '#resources';
  const checklistItems = resolveChecklistItems(content.items);
  const mediaTitleLine1 =
    readOptionalText(customContent.mediaTitleLine1) ??
    'Teach Patience';
  const mediaTitleLine2 =
    readOptionalText(customContent.mediaTitleLine2) ??
    'to Young Children';
  const mediaAltText = `${mediaTitleLine1} ${mediaTitleLine2}`;

  const headerAlignment = sectionConfig.headerAlignment ?? 'center';
  const layoutVariant = sectionConfig.layoutVariant ?? 'split';
  const splitImagePosition = sectionConfig.imagePosition ?? 'right';
  const overlayCardPosition = sectionConfig.cardPosition ?? 'left';
  const isOverlayLayout = layoutVariant === 'overlay';
  const splitTextPaneOrderClassName =
    splitImagePosition === 'left' ? 'lg:order-2' : 'lg:order-1';
  const splitMediaPaneOrderClassName =
    splitImagePosition === 'left' ? 'lg:order-1' : 'lg:order-2';
  const splitMediaBleedClassName =
    splitImagePosition === 'left'
      ? 'es-free-resources-media-pane--bleed-right'
      : 'es-free-resources-media-pane--bleed-left';
  const overlayCardAlignmentClassName =
    overlayCardPosition === 'left' ? 'justify-start' : 'justify-end';

  return (
    <SectionShell
      id='resources'
      ariaLabel={content.title}
      dataFigmaNode='resources'
      className='es-free-resources-section'
    >
      <SectionContainer>
        <SectionHeader
          testId='free-resource-header'
          eyebrow={eyebrowLabel}
          title={content.title}
          align={headerAlignment}
        />

        <div className='mt-10 sm:mt-12 lg:mt-14'>
          <div className='overflow-hidden rounded-panel'>
            {isOverlayLayout ? (
              <div
                data-testid='free-resource-layout'
                data-layout='overlay'
                className='relative overflow-hidden rounded-2xl border border-black/5 es-free-resources-pattern-bg'
              >
                <div
                  className='relative min-h-[620px] overflow-hidden sm:min-h-[700px] lg:min-h-[740px]'
                  data-testid='free-resource-media-pane'
                >
                  <Image
                    src={RESOURCE_IMAGE_SRC}
                    alt={mediaAltText}
                    fill
                    className='object-cover'
                    sizes='100vw'
                  />

                  <div className='absolute left-1/2 top-[10%] z-10 flex -translate-x-1/2 flex-col items-center gap-2 sm:gap-3'>
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-pill sm:px-6'>
                      <p className='whitespace-nowrap es-free-resources-media-pill-text'>
                        {mediaTitleLine1}
                      </p>
                    </div>
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-pill sm:px-6'>
                      <p className='whitespace-nowrap es-free-resources-media-pill-text'>
                        {mediaTitleLine2}
                      </p>
                    </div>
                  </div>

                </div>

                <div
                  data-testid='free-resource-overlay-card-wrapper'
                  className={`absolute inset-4 z-20 flex items-start sm:inset-6 lg:inset-8 ${overlayCardAlignmentClassName}`}
                >
                  <article
                    className='relative flex w-full max-w-[530px] min-h-[420px] flex-col overflow-hidden rounded-2xl p-6 sm:min-h-[460px] sm:p-8'
                  >
                    <ResourceCardContent
                      cardTitle={cardTitle}
                      cardDescription={cardDescription}
                      checklistItems={checklistItems}
                      ctaLabel={ctaLabel}
                      ctaHref={ctaHref}
                    />
                  </article>
                </div>
              </div>
            ) : (
              <div
                data-testid='free-resource-layout'
                data-layout='split'
                className={buildSectionSplitLayoutClassName(
                  'es-section-split-layout--free-resources overflow-hidden rounded-2xl border border-black/5 es-free-resources-pattern-bg',
                )}
              >
                <div
                  data-testid='free-resource-text-pane'
                  className={`relative z-10 p-4 sm:p-6 lg:p-[35px] ${splitTextPaneOrderClassName}`}
                >
                  <article
                    className='relative flex h-full min-h-[370px] flex-col overflow-hidden rounded-2xl p-6 sm:min-h-[440px] sm:p-8 lg:min-h-[516px]'
                  >
                    <ResourceCardContent
                      cardTitle={cardTitle}
                      cardDescription={cardDescription}
                      checklistItems={checklistItems}
                      ctaLabel={ctaLabel}
                      ctaHref={ctaHref}
                    />
                  </article>
                </div>

                <div
                  data-testid='free-resource-media-pane'
                  className={`es-free-resources-media-pane ${splitMediaBleedClassName} relative z-0 min-h-[280px] overflow-visible sm:min-h-[370px] lg:min-h-[587px] ${splitMediaPaneOrderClassName}`}
                >
                  <div className='absolute left-1/2 top-[10%] z-10 flex -translate-x-1/2 flex-col items-center gap-2 sm:gap-3'>
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-pill sm:px-6'>
                      <p className='whitespace-nowrap es-free-resources-media-pill-text'>
                        {mediaTitleLine1}
                      </p>
                    </div>
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-pill sm:px-6'>
                      <p className='whitespace-nowrap es-free-resources-media-pill-text'>
                        {mediaTitleLine2}
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
