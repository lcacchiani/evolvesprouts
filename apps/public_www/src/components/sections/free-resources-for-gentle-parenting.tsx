import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import {
  readCandidateText,
  readOptionalText,
} from '@/content/content-field-utils';
import type { ResourcesContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

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

const SECTION_BG = 'var(--figma-colors-desktop, #FFFFFF)';
const HEADING_COLOR = HEADING_TEXT_COLOR;
const BODY_COLOR = BODY_TEXT_COLOR;
const RESOURCE_IMAGE_SRC = '/images/family.webp';
const BORDER_COLOR = '#EECAB0';
const GREEN_ACCENT = '#5D9D49';
const TILE_BORDER_COLOR = '#D9A578';

const cardBackgroundPatternStyle: CSSProperties = {
  backgroundColor: BORDER_COLOR,
  backgroundImage: `linear-gradient(${TILE_BORDER_COLOR} 1px, transparent 1px), linear-gradient(90deg, ${TILE_BORDER_COLOR} 1px, transparent 1px)`,
  backgroundSize: '100px 100px',
};

const eyebrowStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: 'var(--figma-fontsizes-18, 18px)',
};

const sectionTitleStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(2rem, 6vw, var(--figma-fontsizes-55, 55px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight:
    'clamp(2.75rem, 7vw, calc(var(--figma-lineheights-real-stories-from-parents-in-hong-kong, 70) * 1px))',
};

const cardTitleStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize:
    'clamp(1.75rem, 4.5vw, var(--figma-fontsizes-41, 41px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight:
    'clamp(2.15rem, 5.2vw, calc(var(--figma-lineheights-age-specific-strategies, 50) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-free-guide-4-simple-ways-to-teach-patience-to-young-children, 0.41) * 1px)',
};

const cardBodyStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.1rem, 3.2vw, var(--figma-fontsizes-28, 28px))',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight:
    'clamp(1.7rem, 4vw, calc(var(--figma-lineheights-gentle-strategies-for-busy-parents, 41) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-gentle-strategies-for-busy-parents, 0.28) * 1px)',
};

const checklistTitleStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.05rem, 2.1vw, 20px)',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: '1.2',
  letterSpacing:
    'calc(var(--figma-letterspacing-the-firstthen-trick, 0.336) * 1px)',
};

const checklistDescriptionStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 1.9vw, 18px)',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: '1.4',
  letterSpacing: 'calc(var(--figma-letterspacing-home, 0.5) * 1px)',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.05rem, 2.8vw, var(--figma-fontsizes-26, 26px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-fontsizes-26, 26px)',
};

const mediaPillTextStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 1.6vw, 20px)',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: '1',
};

function readOptionalRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readStringUnion<T extends readonly string[]>(
  value: unknown,
  values: T,
): T[number] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return values.find((entry) => entry === normalized) as T[number] | undefined;
}

function readSectionConfig(
  customContent: Record<string, unknown>,
): ResourceSectionConfig {
  const rawSectionConfig = readOptionalRecord(customContent.sectionConfig) ?? {};

  const headerAlignmentValue =
    readCandidateText(rawSectionConfig, [
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
    readCandidateText(rawSectionConfig, ['layoutVariant', 'layout']) ??
    readCandidateText(customContent, ['layoutVariant', 'layout']);
  const imagePositionValue =
    readCandidateText(rawSectionConfig, ['imagePosition', 'mediaPosition']) ??
    readCandidateText(customContent, ['imagePosition', 'mediaPosition']);
  const cardPositionValue =
    readCandidateText(rawSectionConfig, ['cardPosition', 'textCardPosition']) ??
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

      if (item && typeof item === 'object') {
        const typedItem = item as Record<string, unknown>;
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
      <h3 className='max-w-[366px] text-balance' style={cardTitleStyle}>
        {cardTitle}
      </h3>

      {cardDescription && (
        <p className='mt-4 max-w-[420px] text-balance' style={cardBodyStyle}>
          {cardDescription}
        </p>
      )}

      {checklistItems.length > 0 && (
        <ul className='mb-7 mt-7 space-y-3 sm:mb-8 sm:mt-8'>
          {checklistItems.map((item) => (
            <li
              key={`${item.title}-${item.description ?? ''}`}
              className='rounded-[12px] bg-white px-4 py-[18px] sm:px-5'
            >
              <p className='relative pl-9' style={checklistTitleStyle}>
                <span className='absolute left-0 top-[-1px]'>
                  <ChecklistIcon />
                </span>
                {item.title}
              </p>
              {item.description && (
                <p className='mt-2 pl-9' style={checklistDescriptionStyle}>
                  {item.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <SectionCtaAnchor
        href={ctaHref}
        className='mt-auto h-[58px] w-full max-w-[360px] rounded-[10px] px-5 es-focus-ring-medium sm:h-[67px] sm:px-6'
        style={ctaStyle}
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
  const overlayCardAlignmentClassName =
    overlayCardPosition === 'left' ? 'justify-start' : 'justify-end';
  const headerClassName =
    headerAlignment === 'center'
      ? 'mx-auto max-w-[760px] text-center'
      : 'max-w-[760px] text-left';

  return (
    <SectionShell
      id='resources'
      ariaLabel={content.title}
      dataFigmaNode='Resources'
      style={{ backgroundColor: SECTION_BG }}
    >
      <div className='mx-auto w-full max-w-[1464px]'>
        <div data-testid='free-resource-header' className={headerClassName}>
          <SectionEyebrowChip
            label={eyebrowLabel}
            labelStyle={eyebrowStyle}
            className='px-4 py-[11px] sm:px-5'
            style={{ borderColor: BORDER_COLOR }}
          />

          <h2 className='mt-6 text-balance' style={sectionTitleStyle}>
            {content.title}
          </h2>
        </div>

        <div className='mt-10 sm:mt-12 lg:mt-14'>
          <div className='overflow-hidden rounded-[18px]'>
            {isOverlayLayout ? (
              <div
                data-testid='free-resource-layout'
                data-layout='overlay'
                className='relative overflow-hidden rounded-[16px] border border-black/5'
                style={cardBackgroundPatternStyle}
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
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-[0px_10px_22px_-18px_rgba(0,0,0,0.58)] sm:px-6'>
                      <p className='whitespace-nowrap' style={mediaPillTextStyle}>
                        {mediaTitleLine1}
                      </p>
                    </div>
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-[0px_10px_22px_-18px_rgba(0,0,0,0.58)] sm:px-6'>
                      <p className='whitespace-nowrap' style={mediaPillTextStyle}>
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
                    className='relative flex w-full max-w-[530px] min-h-[420px] flex-col overflow-hidden rounded-[15px] p-6 sm:min-h-[460px] sm:p-8'
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
                className='grid overflow-hidden rounded-[16px] border border-black/5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
                style={cardBackgroundPatternStyle}
              >
                <div
                  data-testid='free-resource-text-pane'
                  className={`relative z-0 p-4 sm:p-6 lg:p-[35px] ${splitTextPaneOrderClassName}`}
                >
                  <article
                    className='relative flex h-full min-h-[370px] flex-col overflow-hidden rounded-[15px] p-6 sm:min-h-[440px] sm:p-8 lg:min-h-[516px]'
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
                  className={`relative z-10 min-h-[280px] overflow-hidden sm:min-h-[370px] lg:min-h-[587px] ${splitMediaPaneOrderClassName}`}
                >
                  <Image
                    src={RESOURCE_IMAGE_SRC}
                    alt={mediaAltText}
                    fill
                    className='object-cover'
                    sizes='(min-width: 1024px) 58vw, 100vw'
                  />

                  <div className='absolute left-1/2 top-[10%] z-10 flex -translate-x-1/2 flex-col items-center gap-2 sm:gap-3'>
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-[0px_10px_22px_-18px_rgba(0,0,0,0.58)] sm:px-6'>
                      <p className='whitespace-nowrap' style={mediaPillTextStyle}>
                        {mediaTitleLine1}
                      </p>
                    </div>
                    <div className='rounded-full bg-white/95 px-5 py-2 shadow-[0px_10px_22px_-18px_rgba(0,0,0,0.58)] sm:px-6'>
                      <p className='whitespace-nowrap' style={mediaPillTextStyle}>
                        {mediaTitleLine2}
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
