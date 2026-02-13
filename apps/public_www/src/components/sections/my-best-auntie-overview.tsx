import { Fragment, type CSSProperties, type ReactNode } from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { MyBestAuntieOverviewContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface MyBestAuntieOverviewProps {
  content: MyBestAuntieOverviewContent;
}

type ModuleIconVariant = 'foundation' | 'coaching' | 'practice';

interface ModuleStep {
  step: string;
  title: string;
  week: string;
  icon: ModuleIconVariant;
  activity?: string;
}

interface ModuleTone {
  cardBackground: string;
  countColor: string;
  countLine: string;
  iconGlow: string;
}

const DEFAULT_STEP_ICONS: ModuleIconVariant[] = [
  'foundation',
  'coaching',
  'practice',
];

const SECTION_BG = 'var(--figma-colors-desktop, #FFFFFF)';
const SECTION_BACKGROUND_IMAGE = 'url("/images/tree-background.png")';
const SECTION_BACKGROUND_SIZE = '900px auto';
const HEADING_COLOR = HEADING_TEXT_COLOR;
const BODY_COLOR = BODY_TEXT_COLOR;
const WEEK_COLOR = 'var(--figma-colors-week-01-04, #313131)';
const BRAND_BLUE = 'var(--figma-colors-frame-2147235242, #174879)';

const MODULE_TONES: readonly ModuleTone[] = [
  {
    cardBackground: 'linear-gradient(180deg, #FFF3E0 0%, #FFFFFF 100%)',
    countColor: '#D7AB0A',
    countLine:
      'linear-gradient(to top, #F7C600 0%, rgba(247, 198, 0, 0.66) 50%, rgba(247, 198, 0, 0) 100%)',
    iconGlow: 'rgba(247, 198, 0, 0.25)',
  },
  {
    cardBackground: 'linear-gradient(180deg, #FFE9EE 0%, #FFFFFF 100%)',
    countColor: '#E3181B',
    countLine:
      'linear-gradient(to top, #E3181B 0%, rgba(227, 24, 27, 0.6) 50%, rgba(227, 24, 27, 0) 100%)',
    iconGlow: 'rgba(227, 24, 27, 0.22)',
  },
  {
    cardBackground: 'linear-gradient(180deg, #E3F0FF 0%, #FFFFFF 100%)',
    countColor: '#4592DE',
    countLine:
      'linear-gradient(to top, #4592DE 0%, rgba(69, 146, 222, 0.62) 50%, rgba(69, 146, 222, 0) 100%)',
    iconGlow: 'rgba(69, 146, 222, 0.24)',
  },
];

const eyebrowTextStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '18px',
};

const titleStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(2.2rem, 6vw, var(--figma-fontsizes-55, 55px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: 'clamp(2.95rem, 7vw, 70px)',
};

const moduleTitleStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.1rem, 2vw, 22px)',
  fontWeight: '500',
  lineHeight: '1.2',
  letterSpacing: '0.3px',
};

const moduleWeekStyle: CSSProperties = {
  color: WEEK_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.15rem, 2.2vw, 28px)',
  fontWeight: '700',
  lineHeight: '1.2',
};

const descriptionStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.1rem, 3vw, var(--figma-fontsizes-30, 30px))',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight:
    'clamp(1.75rem, 4vw, calc(var(--figma-lineheights-transform-your-auntie-into-a-montessori-guided-child-development-partner-2, 46) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-transform-your-auntie-into-a-montessori-guided-child-development-partner-2, 0.3) * 1px)',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.05rem, 2.4vw, var(--figma-fontsizes-28, 28px))',
  fontWeight: '600',
  lineHeight: 'var(--figma-fontsizes-28, 28px)',
};

const activityStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(0.875rem, 2vw, 16px)',
  fontWeight: '400',
  lineHeight: '1.45',
};

const countTextStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '20px',
  fontWeight: '700',
  lineHeight: '1',
};

function ModuleGlyph({
  variant,
  className = 'h-[52px] w-[52px]',
}: {
  variant: ModuleIconVariant;
  className?: string;
}) {
  if (variant === 'foundation') {
    return (
      <svg
        aria-hidden='true'
        viewBox='0 0 84 84'
        className={className}
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <rect
          x='16'
          y='11'
          width='52'
          height='62'
          rx='9'
          stroke={HEADING_COLOR}
          strokeWidth='5'
        />
        <rect
          x='28'
          y='4'
          width='28'
          height='12'
          rx='5'
          fill={BRAND_BLUE}
        />
        <path
          d='M28 35H56M28 46H56M28 57H46'
          stroke={HEADING_COLOR}
          strokeWidth='5'
          strokeLinecap='round'
        />
      </svg>
    );
  }

  if (variant === 'coaching') {
    return (
      <svg
        aria-hidden='true'
        viewBox='0 0 84 84'
        className={className}
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M13 20C13 12.82 18.82 7 26 7H58C65.18 7 71 12.82 71 20V44C71 51.18 65.18 57 58 57H38L22 72V57H26C18.82 57 13 51.18 13 44V20Z'
          stroke={HEADING_COLOR}
          strokeWidth='5'
          fill={BRAND_BLUE}
          fillOpacity='0.15'
        />
        <path
          d='M28 24H56M28 34H56M28 44H47'
          stroke={HEADING_COLOR}
          strokeWidth='5'
          strokeLinecap='round'
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 84 84'
      className={className}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M19 26C19 20.48 23.48 16 29 16H36V9C36 6.24 38.24 4 41 4H43C45.76 4 48 6.24 48 9V16H55C60.52 16 65 20.48 65 26V33H72C74.76 33 77 35.24 77 38V40C77 42.76 74.76 45 72 45H65V52C65 57.52 60.52 62 55 62H48V69C48 71.76 45.76 74 43 74H41C38.24 74 36 71.76 36 69V62H29C23.48 62 19 57.52 19 52V45H12C9.24 45 7 42.76 7 40V38C7 35.24 9.24 33 12 33H19V26Z'
        stroke={HEADING_COLOR}
        strokeWidth='5'
        fill={BRAND_BLUE}
        fillOpacity='0.12'
      />
      <path
        d='M31 31L53 53M53 31L31 53'
        stroke={HEADING_COLOR}
        strokeWidth='5'
        strokeLinecap='round'
      />
    </svg>
  );
}

function isModuleIconVariant(value: string): value is ModuleIconVariant {
  return (
    value === 'foundation' || value === 'coaching' || value === 'practice'
  );
}

function renderMultilineText(value: string): ReactNode {
  const lines = value.split('\n');
  if (lines.length === 1) {
    return value;
  }

  return lines.map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 && <br />}
    </Fragment>
  ));
}

function getModuleTone(index: number): ModuleTone {
  return MODULE_TONES[index % MODULE_TONES.length];
}

function MyBestAuntieOverviewCard({
  module,
  index,
  showFullActivity,
}: {
  module: ModuleStep;
  index: number;
  showFullActivity: boolean;
}) {
  const tone = getModuleTone(index);

  return (
    <article
      className='group relative flex min-h-[450px] flex-col overflow-hidden rounded-[32px] px-4 pb-6 pt-6 sm:min-h-[520px] sm:px-6 lg:min-h-[560px]'
      style={{ background: tone.cardBackground }}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute -right-8 top-10 h-36 w-36 rounded-full blur-3xl'
        style={{ backgroundColor: tone.iconGlow }}
      />
      <div className='relative flex flex-1 flex-col items-center text-center'>
        <span className='inline-flex h-[84px] w-[84px] items-center justify-center rounded-full bg-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.2)]'>
          <ModuleGlyph variant={module.icon} className='h-[44px] w-[44px]' />
        </span>
        <h3 className='mt-5' style={moduleTitleStyle}>
          {module.title}
        </h3>
        <p className='mt-2' style={moduleWeekStyle}>
          {module.week}
        </p>
        {module.activity && (
          <p
            className={`mx-auto mt-4 max-w-[34ch] transition-opacity duration-300 ${showFullActivity ? 'opacity-100' : 'opacity-0 lg:group-hover:opacity-100'}`}
            style={activityStyle}
          >
            {module.activity}
          </p>
        )}
        <div className='mt-auto flex flex-col items-center gap-4 pt-6'>
          <span className='relative inline-flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#333333] shadow-[0_3px_6px_rgba(0,0,0,0.32)]'>
            <span
              aria-hidden='true'
              className='pointer-events-none absolute -top-[70px] left-1/2 h-[70px] w-2 -translate-x-1/2 rounded-full'
              style={{ background: tone.countLine }}
            />
            <span style={{ ...countTextStyle, color: tone.countColor }}>
              {module.step}
            </span>
          </span>
          <span className='inline-flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white/88 shadow-[0_7px_16px_rgba(0,0,0,0.22)]'>
            <ModuleGlyph variant={module.icon} className='h-[34px] w-[34px]' />
          </span>
        </div>
      </div>
    </article>
  );
}

export function MyBestAuntieOverview({ content }: MyBestAuntieOverviewProps) {
  const moduleSteps: ModuleStep[] = content.modules.map((module, index) => ({
    step: module.step,
    title: module.title,
    week: module.week,
    activity: module.activity,
    icon: isModuleIconVariant(module.icon)
      ? module.icon
      : DEFAULT_STEP_ICONS[index] ?? 'foundation',
  }));

  const computedCtaLabel = content.ctaLabel.trim().replace(/\s*>$/, '');

  return (
    <SectionShell
      id='courses'
      ariaLabel={content.title}
      dataFigmaNode='My Best Auntie Overview'
      className='relative isolate overflow-hidden'
      style={{
        backgroundColor: SECTION_BG,
        backgroundImage: SECTION_BACKGROUND_IMAGE,
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: SECTION_BACKGROUND_SIZE,
      }}
    >
      <div className='relative mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[760px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowTextStyle}
            className='px-4 py-2.5 sm:px-5'
            style={{
              backgroundColor: 'var(--figma-colors-desktop, #FFFFFF)',
              borderColor: '#EECAB0',
              backdropFilter: 'blur(14px)',
            }}
          />

          <h2 className='mt-6 text-balance' style={titleStyle}>
            {renderMultilineText(content.title)}
          </h2>
        </div>

        <div className='relative mt-12 sm:mt-14 lg:mt-16'>
          <ul className='hidden gap-6 lg:grid lg:grid-cols-3'>
            {moduleSteps.map((module, index) => (
              <li key={module.step}>
                <MyBestAuntieOverviewCard
                  module={module}
                  index={index}
                  showFullActivity={false}
                />
              </li>
            ))}
          </ul>
          <div
            aria-hidden='true'
            className='pointer-events-none absolute bottom-[109px] left-0 right-0 z-10 hidden lg:block'
          >
            <svg
              viewBox='0 0 100 10'
              className='h-10 w-full'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              preserveAspectRatio='none'
            >
              <defs>
                <linearGradient
                  id='wave-connector-fade'
                  gradientUnits='userSpaceOnUse'
                  x1='0'
                  y1='5'
                  x2='100'
                  y2='5'
                >
                  <stop offset='0%' stopColor='#333333' stopOpacity='0' />
                  <stop
                    offset='3%'
                    stopColor='#333333'
                    stopOpacity='0.28'
                  />
                  <stop
                    offset='85%'
                    stopColor='#333333'
                    stopOpacity='0.28'
                  />
                  <stop
                    offset='100%'
                    stopColor='#333333'
                    stopOpacity='0'
                  />
                </linearGradient>
              </defs>
              <path
                d='M0,3 C5,3 12,4.4 16.67,5 S28,7 33.33,7 S44,5 50,5 S61,3 66.67,3 S78,5 83.33,5 S95,7 105,7'
                stroke='url(#wave-connector-fade)'
                strokeWidth='2'
                strokeLinecap='round'
                vectorEffect='non-scaling-stroke'
              />
            </svg>
          </div>
          <div className='lg:hidden'>
            <ul className='scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2'>
              {moduleSteps.map((module, index) => (
                <li
                  key={module.step}
                  className='w-[88%] shrink-0 snap-center sm:w-[72%]'
                >
                  <MyBestAuntieOverviewCard
                    module={module}
                    index={index}
                    showFullActivity
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className='mx-auto mt-12 max-w-[760px] text-center lg:mt-16'>
          {content.description && (
            <p className='text-balance' style={descriptionStyle}>
              {content.description}
            </p>
          )}

          <SectionCtaAnchor
            href={content.ctaHref}
            className='mt-8 h-[62px] w-full max-w-[491px] rounded-[10px] px-5 es-focus-ring-soft sm:h-[72px] sm:px-7 lg:mt-10 lg:h-[81px]'
            style={ctaStyle}
          >
            {computedCtaLabel}
          </SectionCtaAnchor>
        </div>
      </div>
    </SectionShell>
  );
}
