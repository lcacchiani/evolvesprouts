import type { CSSProperties } from 'react';

import type { RealStoriesContent } from '@/content';

interface RealStoriesProps {
  content: RealStoriesContent;
}

interface NormalizedStory {
  quote?: string;
  author?: string;
  role?: string;
  cardLocation?: string;
  metaLocation?: string;
  organization?: string;
  badgeLabel?: string;
  previousButtonLabel?: string;
  nextButtonLabel?: string;
}

const SECTION_BG = 'var(--figma-colors-desktop, #FFFFFF)';
const TEXT_PRIMARY =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const TEXT_SECONDARY = 'var(--figma-colors-home, #4A4A4A)';
const CONTROL_BG = 'var(--figma-colors-frame-1000007814, #1F1F1F)';
const CONTROL_ICON = 'var(--figma-colors-rectangle-240648655, #FFBA89)';
const CARD_BG = 'var(--figma-colors-frame-2147224783, #121211)';
const PROFILE_CARD_BG = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const DIVIDER_COLOR = 'rgba(31, 31, 31, 0.2)';
const BADGE_BORDER = '#EECAB0';

const badgeTextStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: 'var(--figma-lineheights-testimonials, 100%)',
};

const headingStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(2rem, 5.8vw, var(--figma-fontsizes-55, 55px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight:
    'clamp(2.6rem, 7vw, calc(var(--figma-lineheights-real-stories-from-parents-in-hong-kong, 70) * 1px))',
};

const introTextStyle: CSSProperties = {
  color: TEXT_SECONDARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: 'var(--figma-lineheights-home, 28px)',
  letterSpacing: 'var(--figma-letterspacing-home, 0.5px)',
};

const quoteTextStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.6rem, 4.2vw, var(--figma-fontsizes-37, 37px))',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight:
    'clamp(2.3rem, 6.2vw, calc(var(--figma-lineheights-ida-was-fantastic-she-helped-me-understand-how-i-could-set-up-my-home-in-a-montessori-way-without-disrupting-my-style, 64) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-ida-was-fantastic-she-helped-me-understand-how-i-could-set-up-my-home-in-a-montessori-way-without-disrupting-my-style, 0.37) * 1px)',
};

const authorStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.6rem, 3.5vw, var(--figma-fontsizes-32, 32px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: 'var(--figma-lineheights-mary-lo, 100%)',
  opacity: 0.86,
};

const metaTextStyle: CSSProperties = {
  color: TEXT_SECONDARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.1rem, 2.8vw, var(--figma-fontsizes-26, 26px))',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: 'var(--figma-lineheights-mom-of-2, 100%)',
  letterSpacing: 'var(--figma-letterspacing-mom-of-2, 0.5px)',
  opacity: 0.68,
};

const cardBrandStyle: CSSProperties = {
  color: 'var(--figma-colors-desktop, #FFFFFF)',
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.75rem, 4vw, var(--figma-fontsizes-37, 37px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-lineheights-evolve-sprouts, 100%)',
};

const cardLocationStyle: CSSProperties = {
  color: 'var(--figma-colors-desktop, #FFFFFF)',
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-300, 300)',
  lineHeight: 'var(--figma-lineheights-hong-kong-china, 100%)',
  letterSpacing: 'var(--figma-letterspacing-hong-kong-china, 0.5px)',
};

function getStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getCandidate(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = getStringValue(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizePrimaryStory(items: unknown): NormalizedStory | null {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const firstItem = items[0];
  if (typeof firstItem === 'string') {
    const quote = getStringValue(firstItem);
    return quote ? { quote } : null;
  }

  if (typeof firstItem !== 'object' || firstItem === null) {
    return null;
  }

  const record = firstItem as Record<string, unknown>;
  const story: NormalizedStory = {
    badgeLabel: getCandidate(record, ['badgeLabel', 'badge', 'eyebrow', 'label']),
    quote: getCandidate(record, [
      'quote',
      'testimonial',
      'text',
      'description',
      'content',
    ]),
    author: getCandidate(record, ['author', 'name', 'parentName']),
    role: getCandidate(record, ['role', 'subtitle', 'title']),
    cardLocation: getCandidate(record, ['cardLocation', 'location', 'city', 'country']),
    metaLocation: getCandidate(record, ['metaLocation', 'from', 'location', 'city']),
    organization: getCandidate(record, ['organization', 'company', 'brand']),
    previousButtonLabel: getCandidate(record, [
      'previousButtonLabel',
      'previousAriaLabel',
      'previousLabel',
    ]),
    nextButtonLabel: getCandidate(record, [
      'nextButtonLabel',
      'nextAriaLabel',
      'nextLabel',
    ]),
  };

  return Object.values(story).some(Boolean) ? story : null;
}

function BadgeMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 31 31'
      className={className}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle cx='15.5' cy='15.5' r='15' fill='rgba(23, 72, 121, 0.14)' />
      <circle cx='11' cy='10.5' r='3.3' fill='var(--figma-colors-frame-2147235242, #174879)' />
      <circle cx='20' cy='10.5' r='3.3' fill='#B31D1F' />
      <circle cx='15.5' cy='19.8' r='3.3' fill='#5D9D49' />
      <path
        d='M15.5 4.5V8.5'
        stroke='#2A7834'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
      <path
        d='M15.5 7.6C15.5 6 13.7 5.1 12.5 5.8'
        stroke='#A8CB44'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
      <path
        d='M15.5 7.6C15.5 6 17.3 5.1 18.5 5.8'
        stroke='#135227'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`h-8 w-8 ${rotationClass}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 4L16 12L8 20'
        stroke={CONTROL_ICON}
        strokeWidth='2.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 43 32'
      className='h-8 w-11 sm:h-10 sm:w-12'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M18.8 0H6.1L0 12.2V32H19.3V12.2H9.4L13.6 4.1H18.8V0Z'
        fill='#E76C3D'
      />
      <path
        d='M42.7 0H30.1L24 12.2V32H43.3V12.2H33.4L37.6 4.1H42.7V0Z'
        fill='#E76C3D'
      />
    </svg>
  );
}

function LocationPin({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={className}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M12 21C15.2 17.5 19 14.1 19 9.5C19 5.4 15.9 2.3 12 2.3C8.1 2.3 5 5.4 5 9.5C5 14.1 8.8 17.5 12 21Z'
        stroke={color}
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <circle cx='12' cy='9.5' r='2.3' stroke={color} strokeWidth='1.8' />
    </svg>
  );
}

function ParentIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 134 134'
      className='h-[78px] w-[78px] sm:h-[92px] sm:w-[92px]'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle
        cx='67'
        cy='46'
        r='20'
        stroke={TEXT_SECONDARY}
        strokeWidth='6'
        opacity='0.9'
      />
      <path
        d='M31 106C35.2 85.4 49.4 75 67 75C84.6 75 98.8 85.4 103 106'
        stroke={TEXT_SECONDARY}
        strokeWidth='6'
        strokeLinecap='round'
        opacity='0.9'
      />
      <circle cx='95' cy='43' r='8' fill={TEXT_SECONDARY} opacity='0.22' />
      <circle cx='39' cy='89' r='7' fill={TEXT_SECONDARY} opacity='0.22' />
    </svg>
  );
}

export function RealStories({ content }: RealStoriesProps) {
  const story = normalizePrimaryStory(content.items);
  const normalizedDescription = content.description.trim();
  const fallbackQuote = normalizedDescription || content.title;
  const quoteText = story?.quote ?? fallbackQuote;
  const introText = story?.quote ? normalizedDescription : '';
  const showMeta =
    Boolean(story?.author) ||
    Boolean(story?.role) ||
    Boolean(story?.metaLocation);
  const cardLabel = story?.organization ?? content.title;
  const badgeLabel = story?.badgeLabel ?? content.title;
  const previousButtonLabel = story?.previousButtonLabel ?? badgeLabel;
  const nextButtonLabel = story?.nextButtonLabel ?? badgeLabel;

  return (
    <section
      aria-label={content.title}
      data-figma-node='Real Stories'
      className='relative isolate w-full overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24'
      style={{ backgroundColor: SECTION_BG }}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[76%] overflow-hidden opacity-25'
      >
        <div
          className='absolute left-1/2 top-[-30rem] h-[84rem] w-[110rem] -translate-x-1/2 rounded-full blur-3xl'
          style={{
            background:
              'radial-gradient(circle at 50% 58%, rgba(23, 72, 121, 0.72) 0%, rgba(179, 29, 31, 0.35) 36%, rgba(93, 157, 73, 0.24) 58%, rgba(255, 255, 255, 0) 82%)',
          }}
        />
      </div>

      <div className='relative mx-auto w-full max-w-[1488px]'>
        <div className='flex flex-col items-center gap-6 lg:gap-8'>
          <div className='flex w-full flex-col items-center justify-between gap-4 sm:flex-row'>
            <div
              className='inline-flex items-center gap-2 rounded-full border px-4 py-2.5'
              style={{
                borderColor: BADGE_BORDER,
                backgroundColor: 'rgba(255, 255, 255, 0.64)',
              }}
            >
              <span className='inline-flex h-[31px] w-[31px] items-center justify-center'>
                <BadgeMark className='h-[31px] w-[31px]' />
              </span>
              <span style={badgeTextStyle}>{badgeLabel}</span>
            </div>

            <div className='flex items-center gap-[14px] sm:gap-[21px]'>
              <button
                type='button'
                disabled
                aria-label={previousButtonLabel}
                className='inline-flex h-[72px] w-[72px] items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-100 sm:h-[85px] sm:w-[86px]'
                style={{ backgroundColor: CONTROL_BG }}
              >
                <ChevronIcon direction='left' />
              </button>
              <button
                type='button'
                disabled
                aria-label={nextButtonLabel}
                className='inline-flex h-[72px] w-[72px] items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-100 sm:h-[85px] sm:w-[86px]'
                style={{ backgroundColor: CONTROL_BG }}
              >
                <ChevronIcon direction='right' />
              </button>
            </div>
          </div>

          <h2 className='max-w-[760px] text-balance text-center' style={headingStyle}>
            {content.title}
          </h2>

          {introText && (
            <p className='max-w-[760px] text-center' style={introTextStyle}>
              {introText}
            </p>
          )}
        </div>

        <div className='mt-10 grid items-start gap-8 lg:mt-14 lg:grid-cols-[minmax(0,618px)_minmax(0,1fr)] lg:gap-12 xl:gap-16'>
          <article
            className='relative isolate overflow-hidden rounded-[28px] p-7 sm:p-10 lg:min-h-[608px] lg:rounded-[32px]'
            style={{ backgroundColor: CARD_BG }}
          >
            <div
              aria-hidden='true'
              className='absolute inset-x-[-26%] bottom-[-30%] h-[72%] rounded-full blur-[90px]'
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(231, 108, 61, 0.32), rgba(179, 29, 31, 0.3) 36%, rgba(23, 72, 121, 0.25) 64%, rgba(18, 18, 17, 0) 100%)',
              }}
            />
            <div
              aria-hidden='true'
              className='absolute inset-x-[8%] top-[10%] h-[45%] rounded-[28px] border border-white/10 bg-white/5'
            />

            <div className='relative flex h-full min-h-[360px] flex-col items-center justify-center text-center lg:min-h-[528px]'>
              <span className='inline-flex h-[108px] w-[109px] items-center justify-center rounded-[20px] bg-white'>
                <BadgeMark className='h-[66px] w-[66px]' />
              </span>
              <p className='mt-7 text-balance' style={cardBrandStyle}>
                {cardLabel}
              </p>

              {story?.cardLocation && (
                <p className='mt-3 inline-flex items-center gap-2' style={cardLocationStyle}>
                  <LocationPin
                    color='var(--figma-colors-desktop, #FFFFFF)'
                    className='h-[18px] w-[18px]'
                  />
                  {story.cardLocation}
                </p>
              )}
            </div>
          </article>

          <div className='flex flex-col'>
            <div className='flex items-start gap-3 sm:gap-5'>
              <span className='shrink-0 pt-1'>
                <QuoteIcon />
              </span>
              <p className='text-balance' style={quoteTextStyle}>
                {quoteText}
              </p>
            </div>

            {showMeta && (
              <>
                <div
                  aria-hidden='true'
                  className='mt-8 h-px w-full'
                  style={{ backgroundColor: DIVIDER_COLOR }}
                />

                <div className='mt-8 flex items-start gap-4 sm:gap-6'>
                  <span
                    className='inline-flex h-[110px] w-[98px] shrink-0 items-center justify-center rounded-[20px] sm:h-[137px] sm:w-[123px]'
                    style={{ backgroundColor: PROFILE_CARD_BG }}
                  >
                    <ParentIcon />
                  </span>

                  <div className='min-w-0'>
                    {story?.author && <p style={authorStyle}>{story.author}</p>}
                    {story?.role && (
                      <p className={story?.author ? 'mt-1' : ''} style={metaTextStyle}>
                        {story.role}
                      </p>
                    )}
                    {story?.metaLocation && (
                      <p
                        className='mt-1 inline-flex items-center gap-2'
                        style={metaTextStyle}
                      >
                        <LocationPin color={TEXT_SECONDARY} className='h-[18px] w-[18px]' />
                        {story.metaLocation}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
