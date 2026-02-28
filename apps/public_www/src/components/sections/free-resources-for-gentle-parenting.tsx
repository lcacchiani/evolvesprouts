import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { FreeResourcesOverlayLayout } from '@/components/sections/free-resources-overlay-layout';
import { FreeResourcesSplitLayout } from '@/components/sections/free-resources-split-layout';
import {
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

const GREEN_ACCENT = 'var(--es-color-accent-green, #5D9D49)';

function readSectionConfig(
  content: ResourcesContent,
): ResourceSectionConfig {
  const sectionConfig = content.sectionConfig;

  return {
    headerAlignment: readStringUnion(
      sectionConfig?.headerAlignment,
      HEADER_ALIGNMENT_VALUES,
    ),
    layoutVariant: readStringUnion(
      sectionConfig?.layoutVariant,
      LAYOUT_VARIANT_VALUES,
    ),
    imagePosition: readStringUnion(
      sectionConfig?.imagePosition,
      HORIZONTAL_POSITION_VALUES,
    ),
    cardPosition: readStringUnion(
      sectionConfig?.cardPosition,
      HORIZONTAL_POSITION_VALUES,
    ),
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
  const sectionConfig = readSectionConfig(content);
  const eyebrowLabel = readOptionalText(content.eyebrow) ?? content.title;
  const cardTitle = readOptionalText(content.cardTitle) ?? content.title;
  const cardDescription =
    readOptionalText(content.cardDescription) ??
    content.description;
  const ctaLabel = readOptionalText(content.ctaLabel) ?? `${content.title} PDF`;
  const ctaHref = readOptionalText(content.ctaHref) ?? '#resources';
  const checklistItems = resolveChecklistItems(content.items);
  const mediaTitleLine1 =
    readOptionalText(content.mediaTitleLine1) ??
    'Teach Patience';
  const mediaTitleLine2 =
    readOptionalText(content.mediaTitleLine2) ??
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
  const cardContent = (
    <ResourceCardContent
      cardTitle={cardTitle}
      cardDescription={cardDescription}
      checklistItems={checklistItems}
      ctaLabel={ctaLabel}
      ctaHref={ctaHref}
    />
  );

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
              <FreeResourcesOverlayLayout
                mediaAltText={mediaAltText}
                mediaTitleLine1={mediaTitleLine1}
                mediaTitleLine2={mediaTitleLine2}
                overlayCardAlignmentClassName={overlayCardAlignmentClassName}
                cardContent={cardContent}
              />
            ) : (
              <FreeResourcesSplitLayout
                mediaTitleLine1={mediaTitleLine1}
                mediaTitleLine2={mediaTitleLine2}
                splitTextPaneOrderClassName={splitTextPaneOrderClassName}
                splitMediaPaneOrderClassName={splitMediaPaneOrderClassName}
                splitMediaBleedClassName={splitMediaBleedClassName}
                cardContent={cardContent}
              />
            )}
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
