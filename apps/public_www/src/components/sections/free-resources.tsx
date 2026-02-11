import type { CSSProperties } from 'react';

import type { FreeResourcesContent } from '@/content';

interface FreeResourcesProps {
  content: FreeResourcesContent;
}

const SECTION_BG = 'var(--figma-colors-desktop, #FFFFFF)';
const HEADING_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const PANEL_BG = 'var(--figma-colors-frame-2147235252, #F8F8F8)';
const MEDIA_BG = 'var(--figma-colors-rectangle-240648654, #D9D9D9)';
const CTA_BG = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT = 'var(--figma-colors-desktop, #FFFFFF)';
const BRAND_BLUE = 'var(--figma-colors-frame-2147235242, #174879)';
const BORDER_COLOR = '#EECAB0';
const RED_ACCENT = '#B31D1F';
const GREEN_ACCENT = '#5D9D49';
const GREEN_LIGHT_ACCENT = '#A8CB44';

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

const checklistStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 2.4vw, var(--figma-fontsizes-24, 24px))',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: 'var(--figma-fontsizes-24, 24px)',
  letterSpacing:
    'calc(var(--figma-letterspacing-the-firstthen-trick, 0.336) * 1px)',
};

const ctaStyle: CSSProperties = {
  backgroundColor: CTA_BG,
  color: CTA_TEXT,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.05rem, 2.8vw, var(--figma-fontsizes-26, 26px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-fontsizes-26, 26px)',
};

const mediaCaptionTitleStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.1rem, 2.2vw, var(--figma-fontsizes-30, 30px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: '1.2',
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return trimmedValue;
}

function resolveChecklistItems(items: unknown): string[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === 'string') {
        return readOptionalText(item);
      }

      if (item && typeof item === 'object') {
        const typedItem = item as Record<string, unknown>;

        return (
          readOptionalText(typedItem.label) ??
          readOptionalText(typedItem.title) ??
          readOptionalText(typedItem.text)
        );
      }

      return null;
    })
    .filter((item): item is string => item !== null)
    .slice(0, 3);
}

function EyebrowGlyph() {
  return (
    <span
      aria-hidden='true'
      className='relative inline-flex h-[23px] w-[31px] items-center justify-center'
    >
      <span
        className='absolute left-[2px] top-[7px] block h-[9px] w-[9px] rounded-full'
        style={{ backgroundColor: BRAND_BLUE }}
      />
      <span
        className='absolute right-[2px] top-[7px] block h-[9px] w-[9px] rounded-full'
        style={{ backgroundColor: RED_ACCENT }}
      />
      <span
        className='absolute bottom-[1px] left-1/2 block h-[10px] w-[10px] -translate-x-1/2 rounded-full'
        style={{ backgroundColor: GREEN_ACCENT }}
      />
      <span
        className='absolute left-[10px] top-[1px] block h-[6px] w-[10px] rounded-full'
        style={{ backgroundColor: GREEN_LIGHT_ACCENT }}
      />
    </span>
  );
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

function DownloadIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 28 28'
      className='h-7 w-7 shrink-0'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M14 4.5V17.5M8.4 12.8L14 18.4L19.6 12.8M6 23H22'
        stroke={CTA_TEXT}
        strokeWidth='2.4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function DecorativeMark() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 128 128'
      className='h-[160px] w-[160px] lg:h-[205px] lg:w-[205px]'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle cx='64' cy='64' r='54' fill='rgba(231, 108, 61, 0.17)' />
      <circle cx='38' cy='57' r='14' fill='rgba(179, 29, 31, 0.28)' />
      <circle cx='88' cy='47' r='14' fill='rgba(93, 157, 73, 0.28)' />
      <circle cx='64' cy='87' r='16' fill='rgba(168, 203, 68, 0.3)' />
      <path
        d='M33 104C46 90 58 84 76 78C87 75 96 71 105 63'
        stroke='rgba(23, 72, 121, 0.28)'
        strokeWidth='10'
        strokeLinecap='round'
      />
    </svg>
  );
}

export function FreeResources({ content }: FreeResourcesProps) {
  const customContent = content as Record<string, unknown>;
  const eyebrowLabel =
    readOptionalText(customContent.eyebrow) ?? content.title;
  const mediaBadgeLabel =
    readOptionalText(customContent.mediaBadgeLabel) ??
    eyebrowLabel;
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

  return (
    <section
      id='resources'
      aria-label={content.title}
      data-figma-node='Free Resources'
      className='w-full px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24'
      style={{ backgroundColor: SECTION_BG }}
    >
      <div className='mx-auto w-full max-w-[1464px]'>
        <div className='mx-auto max-w-[760px] text-center'>
          <div
            className='inline-flex items-center gap-2 rounded-full border px-4 py-[11px] sm:px-5'
            style={{ borderColor: BORDER_COLOR }}
          >
            <EyebrowGlyph />
            <span style={eyebrowStyle}>{eyebrowLabel}</span>
          </div>

          <h2 className='mt-6 text-balance' style={sectionTitleStyle}>
            {content.title}
          </h2>
        </div>

        <div className='mt-10 overflow-hidden rounded-[14px] border border-black/5 sm:mt-12 lg:mt-14'>
          <div className='grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]'>
            <div
              className='relative min-h-[280px] overflow-hidden sm:min-h-[370px] lg:min-h-[587px]'
              style={{ backgroundColor: MEDIA_BG }}
            >
              <div
                aria-hidden='true'
                className='absolute inset-0'
                style={{
                  background:
                    'linear-gradient(128deg, rgba(23, 72, 121, 0.18) 0%, rgba(248, 248, 248, 0.65) 47%, rgba(231, 108, 61, 0.28) 100%)',
                }}
              />
              <div
                aria-hidden='true'
                className='absolute -left-12 top-[14%] h-44 w-44 rounded-full blur-3xl sm:h-56 sm:w-56'
                style={{ backgroundColor: 'rgba(93, 157, 73, 0.24)' }}
              />
              <div
                aria-hidden='true'
                className='absolute -right-10 bottom-[8%] h-44 w-44 rounded-full blur-3xl sm:h-56 sm:w-56'
                style={{ backgroundColor: 'rgba(231, 108, 61, 0.28)' }}
              />
              <div
                aria-hidden='true'
                className='absolute inset-[6%] rounded-[14px] border border-white/35 bg-white/12 backdrop-blur-[1.5px]'
              />

              <div className='absolute bottom-4 left-4 right-4 rounded-xl border border-white/40 bg-white/70 p-4 shadow-[0px_12px_28px_-18px_rgba(0,0,0,0.35)] backdrop-blur sm:bottom-6 sm:left-6 sm:right-auto sm:w-[78%] sm:p-5 lg:w-[70%]'>
                <p
                  className='text-sm uppercase tracking-[0.11em]'
                  style={{
                    color: BODY_COLOR,
                    fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
                    fontWeight: 'var(--figma-fontweights-600, 600)',
                  }}
                >
                  {mediaBadgeLabel}
                </p>
                <p className='mt-2 text-balance' style={mediaCaptionTitleStyle}>
                  {content.title}
                </p>
              </div>
            </div>

            <div className='relative p-4 sm:p-6 lg:p-[35px]'>
              <article
                className='relative isolate flex h-full min-h-[370px] flex-col overflow-hidden rounded-lg p-6 sm:min-h-[440px] sm:p-8 lg:min-h-[516px]'
                style={{
                  backgroundColor: PANEL_BG,
                  boxShadow:
                    '0px 22px 60px -36px rgba(28, 53, 66, 0.38)',
                }}
              >
                <div
                  aria-hidden='true'
                  className='pointer-events-none absolute -top-20 right-0 h-36 w-36 rounded-full blur-3xl'
                  style={{ backgroundColor: 'rgba(23, 72, 121, 0.14)' }}
                />

                <h3 className='max-w-[366px] text-balance' style={cardTitleStyle}>
                  {cardTitle}
                </h3>

                {cardDescription && (
                  <p className='mt-4 max-w-[420px] text-balance' style={cardBodyStyle}>
                    {cardDescription}
                  </p>
                )}

                {checklistItems.length > 0 && (
                  <ul className='mt-7 space-y-5 sm:mt-8'>
                    {checklistItems.map((item) => (
                      <li key={item} className='flex items-center gap-2'>
                        <ChecklistIcon />
                        <span style={checklistStyle}>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <a
                  href={ctaHref}
                  className='mt-auto inline-flex h-[58px] w-full max-w-[327px] items-center justify-center gap-[11px] rounded-lg px-5 text-center transition-transform duration-200 hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/35 sm:h-[67px] sm:px-6'
                  style={ctaStyle}
                >
                  <DownloadIcon />
                  <span className='whitespace-nowrap'>{ctaLabel}</span>
                </a>

                <div className='pointer-events-none absolute -bottom-16 -right-14 opacity-55'>
                  <DecorativeMark />
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
