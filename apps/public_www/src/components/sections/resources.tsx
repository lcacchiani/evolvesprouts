import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import { readOptionalText } from '@/content/content-field-utils';
import type { ResourcesContent } from '@/content';

interface ResourcesProps {
  content: ResourcesContent;
}

interface ChecklistEntry {
  title: string;
  description?: string;
}

const SECTION_BG = 'var(--figma-colors-desktop, #FFFFFF)';
const HEADING_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const PANEL_BG = 'var(--figma-colors-frame-2147235252, #F8F8F8)';
const MEDIA_BG = 'var(--figma-colors-rectangle-240648654, #D9D9D9)';
const RESOURCE_IMAGE_SRC = '/images/family.webp';
const BORDER_COLOR = '#EECAB0';
const GREEN_ACCENT = '#5D9D49';

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

function PlayIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 32 32'
      className='h-6 w-6'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M12 9.8L23 16L12 22.2V9.8Z'
        fill='#174879'
      />
    </svg>
  );
}

export function Resources({ content }: ResourcesProps) {
  const customContent = content as Record<string, unknown>;
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

  return (
    <SectionShell
      id='resources'
      ariaLabel={content.title}
      dataFigmaNode='Resources'
      style={{ backgroundColor: SECTION_BG }}
    >
      <div className='mx-auto w-full max-w-[1464px]'>
        <div className='mx-auto max-w-[760px] text-center'>
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
          <div className='overflow-hidden rounded-[18px] bg-[linear-gradient(145deg,#F6D6BE_0%,#FBE7D8_100%)] p-[2px]'>
            <div className='grid overflow-hidden rounded-[16px] border border-black/5 bg-white lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
              <div className='relative p-4 sm:p-6 lg:p-[35px]'>
                <article
                  className='relative isolate flex h-full min-h-[370px] flex-col overflow-hidden rounded-[15px] p-6 sm:min-h-[440px] sm:p-8 lg:min-h-[516px]'
                  style={{
                    backgroundColor: PANEL_BG,
                    boxShadow:
                      '0px 22px 60px -36px rgba(28, 53, 66, 0.38)',
                  }}
                >
                  <h3 className='max-w-[366px] text-balance' style={cardTitleStyle}>
                    {cardTitle}
                  </h3>

                  {cardDescription && (
                    <p className='mt-4 max-w-[420px] text-balance' style={cardBodyStyle}>
                      {cardDescription}
                    </p>
                  )}

                  {checklistItems.length > 0 && (
                    <ul className='mt-7 space-y-3 sm:mt-8'>
                      {checklistItems.map((item) => (
                        <li
                          key={`${item.title}-${item.description ?? ''}`}
                          className='rounded-[12px] bg-[#F8F8F8] px-4 py-[18px] sm:px-5'
                        >
                          <p className='relative pl-9' style={checklistTitleStyle}>
                            <span className='absolute left-0 top-[-1px]'>
                              <ChecklistIcon />
                            </span>
                            {item.title}
                          </p>
                          {item.description && (
                            <p
                              className='mt-2 pl-9'
                              style={checklistDescriptionStyle}
                            >
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
                    <span className='whitespace-nowrap'>{ctaLabel}</span>
                  </SectionCtaAnchor>
                </article>
              </div>

              <div
                className='relative min-h-[280px] overflow-hidden sm:min-h-[370px] lg:min-h-[587px]'
                style={{ backgroundColor: MEDIA_BG }}
              >
                <Image
                  src={RESOURCE_IMAGE_SRC}
                  alt={mediaAltText}
                  fill
                  className='object-cover'
                  sizes='(min-width: 1024px) 58vw, 100vw'
                />
                <div
                  aria-hidden='true'
                  className='absolute inset-0'
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.24) 100%)',
                  }}
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

                <div
                  aria-hidden='true'
                  className='absolute right-[30px] top-[44%] z-10 flex h-[72px] w-[72px] -translate-y-1/2 items-center justify-center rounded-full border border-[#174879]/10 bg-white/92 shadow-[0px_18px_38px_-20px_rgba(0,0,0,0.6)] backdrop-blur max-lg:left-1/2 max-lg:right-auto max-lg:top-1/2 max-lg:-translate-x-1/2'
                >
                  <PlayIcon />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
