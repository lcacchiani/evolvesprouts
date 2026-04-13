'use client';

import { useState } from 'react';

import { MediaForm } from '@/components/sections/media-form';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { FreeResourcesOverlayLayout } from '@/components/sections/free-resources-overlay-layout';
import { FreeResourcesSplitLayout } from '@/components/sections/free-resources-split-layout';
import enContent from '@/content/en.json';
import {
  readOptionalText,
  readStringUnion,
  toRecord,
} from '@/content/content-field-utils';
import type { Locale, ResourcesContent } from '@/content';

interface FreeResourcesForGentleParentingProps {
  content: ResourcesContent;
  locale: Locale;
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
  resourceKey: string;
  formFirstNameLabel: string;
  formEmailLabel: string;
  formFirstNameValidationMessage: string;
  formEmailValidationMessage: string;
  formSubmitLabel: string;
  formSubmittingLabel: string;
  formSuccessMessage: string;
  formErrorMessage: string;
  formMarketingOptInLabel: string;
  formCaptchaRequiredError: string;
  formCaptchaLoadError: string;
  formCaptchaUnavailableError: string;
  formCaptchaLabel: string;
  locale: Locale;
  showChecklist: boolean;
  onFormOpened: () => void;
}

const HEADER_ALIGNMENT_VALUES = ['left', 'center'] as const;
const LAYOUT_VARIANT_VALUES = ['split', 'overlay'] as const;
const HORIZONTAL_POSITION_VALUES = ['left', 'right'] as const;

const fallbackResourcesContent = enContent.resources;

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
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG asset from /public/images */}
      <img
        src='/images/free-resources-checklist-icon.svg'
        alt=''
        aria-hidden
        className='h-7 w-7 shrink-0'
      />
    </>
  );
}

function ResourceCardContent({
  cardTitle,
  cardDescription,
  checklistItems,
  ctaLabel,
  resourceKey,
  formFirstNameLabel,
  formEmailLabel,
  formFirstNameValidationMessage,
  formEmailValidationMessage,
  formSubmitLabel,
  formSubmittingLabel,
  formSuccessMessage,
  formErrorMessage,
  formMarketingOptInLabel,
  formCaptchaRequiredError,
  formCaptchaLoadError,
  formCaptchaUnavailableError,
  formCaptchaLabel,
  locale,
  showChecklist,
  onFormOpened,
}: ResourceCardContentProps) {
  return (
    <>
      <h3 className='max-w-[366px] text-balance es-free-resources-card-title'>
        {cardTitle}
      </h3>

      {cardDescription && (
        <p className='mt-4 max-w-[420px] text-balance es-free-resources-card-body'>
          {renderQuotedDescriptionText(cardDescription)}
        </p>
      )}

      {showChecklist && checklistItems.length > 0 && (
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
                  {renderQuotedDescriptionText(item.description)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <MediaForm
        ctaLabel={ctaLabel}
        resourceKey={resourceKey}
        analyticsSectionId='resources'
        locale={locale}
        formMarketingOptInLabel={formMarketingOptInLabel}
        formFirstNameLabel={formFirstNameLabel}
        formEmailLabel={formEmailLabel}
        formFirstNameValidationMessage={formFirstNameValidationMessage}
        formEmailValidationMessage={formEmailValidationMessage}
        formSubmitLabel={formSubmitLabel}
        formSubmittingLabel={formSubmittingLabel}
        formSuccessMessage={formSuccessMessage}
        formErrorMessage={formErrorMessage}
        formCaptchaRequiredError={formCaptchaRequiredError}
        formCaptchaLoadError={formCaptchaLoadError}
        formCaptchaUnavailableError={formCaptchaUnavailableError}
        formCaptchaLabel={formCaptchaLabel}
        onFormOpened={onFormOpened}
      />
    </>
  );
}

export function FreeResourcesForGentleParenting({
  content,
  locale,
}: FreeResourcesForGentleParentingProps) {
  const [hasOpenedMediaForm, setHasOpenedMediaForm] = useState(false);

  const sectionConfig = readSectionConfig(content);
  const eyebrowLabel = readOptionalText(content.eyebrow) ?? content.title;
  const cardTitle = readOptionalText(content.cardTitle) ?? content.title;
  const cardDescription =
    readOptionalText(content.cardDescription) ??
    content.description;
  const ctaLabel = readOptionalText(content.ctaLabel) ?? fallbackResourcesContent.ctaLabel;
  const resourceKey =
    readOptionalText(content.resourceKey) ?? 'patience-free-guide';
  const formFirstNameLabel =
    readOptionalText(content.formFirstNameLabel)
    ?? fallbackResourcesContent.formFirstNameLabel;
  const formEmailLabel =
    readOptionalText(content.formEmailLabel)
    ?? fallbackResourcesContent.formEmailLabel;
  const formFirstNameValidationMessage =
    readOptionalText(content.formFirstNameValidationMessage)
    ?? fallbackResourcesContent.formFirstNameValidationMessage;
  const formEmailValidationMessage =
    readOptionalText(content.formEmailValidationMessage)
    ?? fallbackResourcesContent.formEmailValidationMessage;
  const formSubmitLabel =
    readOptionalText(content.formSubmitLabel)
    ?? fallbackResourcesContent.formSubmitLabel;
  const formSubmittingLabel =
    readOptionalText(content.formSubmittingLabel)
    ?? fallbackResourcesContent.formSubmittingLabel;
  const formSuccessMessage =
    readOptionalText(content.formSuccessMessage) ??
    fallbackResourcesContent.formSuccessMessage;
  const formErrorMessage =
    readOptionalText(content.formErrorMessage) ??
    fallbackResourcesContent.formErrorMessage;
  const formMarketingOptInLabel =
    readOptionalText(content.formMarketingOptInLabel) ??
    fallbackResourcesContent.formMarketingOptInLabel;
  const formCaptchaRequiredError =
    readOptionalText(content.formCaptchaRequiredError) ??
    fallbackResourcesContent.formCaptchaRequiredError;
  const formCaptchaLoadError =
    readOptionalText(content.formCaptchaLoadError) ??
    fallbackResourcesContent.formCaptchaLoadError;
  const formCaptchaUnavailableError =
    readOptionalText(content.formCaptchaUnavailableError) ??
    fallbackResourcesContent.formCaptchaUnavailableError;
  const formCaptchaLabel =
    readOptionalText(content.formCaptchaLabel) ??
    fallbackResourcesContent.formCaptchaLabel;
  const checklistItems = resolveChecklistItems(content.items);
  const mediaTitleLine1 =
    readOptionalText(content.mediaTitleLine1) ??
    fallbackResourcesContent.mediaTitleLine1;
  const mediaTitleLine2 =
    readOptionalText(content.mediaTitleLine2) ??
    fallbackResourcesContent.mediaTitleLine2;
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
      resourceKey={resourceKey}
      formFirstNameLabel={formFirstNameLabel}
      formEmailLabel={formEmailLabel}
      formFirstNameValidationMessage={formFirstNameValidationMessage}
      formEmailValidationMessage={formEmailValidationMessage}
      formSubmitLabel={formSubmitLabel}
      formSubmittingLabel={formSubmittingLabel}
      formSuccessMessage={formSuccessMessage}
      formErrorMessage={formErrorMessage}
      formMarketingOptInLabel={formMarketingOptInLabel}
      formCaptchaRequiredError={formCaptchaRequiredError}
      formCaptchaLoadError={formCaptchaLoadError}
      formCaptchaUnavailableError={formCaptchaUnavailableError}
      formCaptchaLabel={formCaptchaLabel}
      locale={locale}
      showChecklist={!hasOpenedMediaForm}
      onFormOpened={() => {
        setHasOpenedMediaForm(true);
      }}
    />
  );

  return (
    <SectionShell
      id='resources'
      ariaLabel={content.title}
      dataFigmaNode='resources'
      className='es-section-bg-overlay es-free-resources-section'
    >
      <div
        aria-hidden='true'
        className='es-course-highlights-overlay pointer-events-none absolute inset-0'
      />

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
