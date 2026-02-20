import { Fragment, type ReactNode } from 'react';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { MyBestAuntieOverviewContent } from '@/content';
import { HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface MyBestAuntieOverviewProps {
  content: MyBestAuntieOverviewContent;
}

type ModuleIconVariant = 'foundation' | 'coaching' | 'practice';
type ModuleToneVariant = 'gold' | 'red' | 'blue';

interface ModuleStep {
  step: string;
  title: string;
  week: string;
  icon: ModuleIconVariant;
  activity?: string;
}

const DEFAULT_STEP_ICONS: ModuleIconVariant[] = [
  'foundation',
  'coaching',
  'practice',
];

const HEADING_COLOR = HEADING_TEXT_COLOR;
const BRAND_BLUE = 'var(--figma-colors-frame-2147235242, #174879)';

const MODULE_TONES: readonly ModuleToneVariant[] = ['gold', 'red', 'blue'];

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

function getModuleTone(index: number): ModuleToneVariant {
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
      className={`group relative flex min-h-[520px] flex-col overflow-hidden rounded-[32px] px-4 pb-6 pt-6 sm:px-6 es-my-best-auntie-overview-card es-my-best-auntie-overview-card--${tone}`}
    >
      <div
        aria-hidden='true'
        className={`pointer-events-none absolute -right-8 top-10 h-36 w-36 rounded-full blur-3xl es-my-best-auntie-overview-icon-glow es-my-best-auntie-overview-icon-glow--${tone}`}
      />
      <div className='relative flex flex-1 flex-col items-center text-center'>
        <span className='inline-flex h-[84px] w-[84px] items-center justify-center rounded-full bg-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.2)]'>
          <ModuleGlyph variant={module.icon} className='h-[44px] w-[44px]' />
        </span>
        <h3 className='mt-5 es-my-best-auntie-overview-module-title'>
          {module.title}
        </h3>
        <p className='mt-2 es-my-best-auntie-overview-module-week'>
          {module.week}
        </p>
        {module.activity && (
          <p
            className={`mx-auto mt-4 max-w-[34ch] transition-opacity duration-300 es-my-best-auntie-overview-activity ${showFullActivity ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
          >
            {module.activity}
          </p>
        )}
        <div className='mt-auto flex flex-col items-center gap-4 pt-6'>
          <div className='relative'>
            <span
              aria-hidden='true'
              className={`pointer-events-none absolute -top-[70px] left-1/2 z-0 h-[74px] w-2 -translate-x-1/2 rounded-full es-my-best-auntie-overview-count-line es-my-best-auntie-overview-count-line--${tone}`}
            />
            <span className='relative z-20 inline-flex h-[50px] w-[50px] items-center justify-center rounded-full es-bg-heading shadow-[0_3px_6px_rgba(0,0,0,0.32)]'>
              <span className={`es-my-best-auntie-overview-count-text es-my-best-auntie-overview-count-text--${tone}`}>
                {module.step}
              </span>
            </span>
          </div>
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
      dataFigmaNode='my-best-auntie-overview'
      className='es-section-bg-overlay es-my-best-auntie-overview-section'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={renderMultilineText(content.title)}
        />

        <div className='relative mt-12 sm:mt-14 lg:mt-16'>
          {/* Desktop / tablet grid (md+) */}
          <ul className='hidden gap-6 md:grid md:grid-cols-3'>
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
          {/* Wave connector — desktop (static overlay on the grid) */}
          <div
            aria-hidden='true'
            className='pointer-events-none absolute bottom-[89px] left-0 right-0 z-10 hidden md:block'
          >
            <svg
              viewBox='0 0 100 10'
              className='h-20 w-full'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              preserveAspectRatio='none'
            >
              <defs>
                <linearGradient
                  id='wave-fade-lg'
                  gradientUnits='userSpaceOnUse'
                  x1='16.67'
                  y1='5'
                  x2='97'
                  y2='5'
                >
                  <stop offset='0%' stopColor={HEADING_COLOR} />
                  <stop offset='83%' stopColor={HEADING_COLOR} />
                  <stop
                    offset='100%'
                    stopColor={HEADING_COLOR}
                    stopOpacity='0'
                  />
                </linearGradient>
              </defs>
              <path
                d='M16.67,5 C22,7 28,9 33.33,9 S44.5,7 50,5 S61,1 66.67,1 S78,3 83.33,5 S93,8 97,8'
                stroke='url(#wave-fade-lg)'
                strokeWidth='3.5'
                strokeLinecap='round'
                vectorEffect='non-scaling-stroke'
              />
            </svg>
          </div>
          {/* Mobile carousel (< md) with wave scrolling alongside cards */}
          <div className='-mx-1 md:hidden'>
            <div className='scrollbar-hide snap-x snap-mandatory overflow-x-auto px-1 pb-2'>
              <ul className='relative inline-flex gap-4'>
                {moduleSteps.map((module, index) => (
                  <li
                    key={module.step}
                    className='w-[80vw] shrink-0 snap-center sm:w-[66vw]'
                  >
                    <MyBestAuntieOverviewCard
                      module={module}
                      index={index}
                      showFullActivity
                    />
                  </li>
                ))}
                {/* Wave connector — mobile (scrolls with the cards) */}
                <li
                  aria-hidden='true'
                  className='pointer-events-none absolute bottom-[89px] left-0 right-0 z-10'
                >
                  <svg
                    viewBox='0 0 100 10'
                    className='h-20 w-full'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                    preserveAspectRatio='none'
                  >
                    <defs>
                      <linearGradient
                        id='wave-fade-sm'
                        gradientUnits='userSpaceOnUse'
                        x1='16.67'
                        y1='5'
                        x2='97'
                        y2='5'
                      >
                        <stop offset='0%' stopColor={HEADING_COLOR} />
                        <stop offset='83%' stopColor={HEADING_COLOR} />
                        <stop
                          offset='100%'
                          stopColor={HEADING_COLOR}
                          stopOpacity='0'
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d='M16.67,5 C22,7 28,9 33.33,9 S44.5,7 50,5 S61,1 66.67,1 S78,3 83.33,5 S93,8 97,8'
                      stroke='url(#wave-fade-sm)'
                      strokeWidth='3.5'
                      strokeLinecap='round'
                      vectorEffect='non-scaling-stroke'
                    />
                  </svg>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className='mx-auto mt-12 max-w-[760px] text-center lg:mt-16'>
          {content.description && (
            <p className='es-type-body-italic text-balance'>
              {content.description}
            </p>
          )}

          <SectionCtaAnchor
            href={content.ctaHref}
            className='mt-8 w-full max-w-[491px] lg:mt-10'
          >
            {computedCtaLabel}
          </SectionCtaAnchor>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
