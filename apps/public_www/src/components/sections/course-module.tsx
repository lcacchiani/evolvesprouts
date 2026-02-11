import type { CSSProperties } from 'react';

import { BackgroundGlow } from '@/components/background-glow';
import { SectionCtaLink } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { CourseModuleContent } from '@/content';

interface CourseModuleProps {
  content: CourseModuleContent;
}

type ModuleIconVariant = 'foundation' | 'coaching' | 'practice';

interface ModuleStep {
  step: string;
  title: string;
  week: string;
  icon: ModuleIconVariant;
}

const DEFAULT_STEP_ICONS: ModuleIconVariant[] = [
  'foundation',
  'coaching',
  'practice',
];

const SECTION_BG = 'var(--figma-colors-desktop, #FFFFFF)';
const HEADING_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const WEEK_COLOR = 'var(--figma-colors-week-01-04, #313131)';
const CARD_BG = 'var(--figma-colors-frame-2147235252, #F8F8F8)';
const ICON_SURFACE = 'var(--figma-colors-rectangle-240648654, #D9D9D9)';
const CTA_BG = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT = 'var(--figma-colors-desktop, #FFFFFF)';
const TIMELINE_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const MUTED_STEP_TEXT = 'var(--figma-colors-03, #DDDDDD)';
const BRAND_BLUE = 'var(--figma-colors-frame-2147235242, #174879)';
const BADGE_SHADOW =
  'var(--figma-boxshadow-ellipse-1966-2, 0px 2.2361302375793457px 5.217637062072754px 0px rgba(0, 0, 0, 0.32))';
const ICON_SHADOW =
  'var(--figma-boxshadow-ellipse-1966-3, 0px 10.664373397827148px 24.8835391998291px 0px rgba(0, 0, 0, 0.32))';

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
  lineHeight: 'clamp(3rem, 7vw, 70px)',
};

const moduleTitlePrimaryStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-22, 22px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1.2',
};

const moduleTitleSecondaryStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-20, 20px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1.2',
};

const moduleWeekPrimaryStyle: CSSProperties = {
  color: WEEK_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-28, 28px)',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: '1.2',
};

const moduleWeekSecondaryStyle: CSSProperties = {
  color: WEEK_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-26, 26px)',
  fontWeight: 'var(--figma-fontweights-700, 700)',
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
  backgroundColor: CTA_BG,
  color: CTA_TEXT,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.05rem, 2.4vw, var(--figma-fontsizes-28, 28px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-fontsizes-28, 28px)',
};

function ModuleGlyph({ variant }: { variant: ModuleIconVariant }) {
  if (variant === 'foundation') {
    return (
      <svg
        aria-hidden='true'
        viewBox='0 0 84 84'
        className='h-[52px] w-[52px]'
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
        className='h-[52px] w-[52px]'
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
      className='h-[52px] w-[52px]'
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

export function CourseModule({ content }: CourseModuleProps) {
  const moduleSteps: ModuleStep[] = content.modules.map((module, index) => ({
    step: module.step,
    title: module.title,
    week: module.week,
    icon: isModuleIconVariant(module.icon)
      ? module.icon
      : DEFAULT_STEP_ICONS[index] ?? 'foundation',
  }));

  return (
    <SectionShell
      id='courses'
      ariaLabel={content.title}
      dataFigmaNode='Course module'
      className='relative isolate overflow-hidden'
      style={{ backgroundColor: SECTION_BG }}
    >
      <BackgroundGlow
        className='left-1/2 top-1/2 h-[58rem] w-[58rem] -translate-x-1/2 -translate-y-1/2 opacity-60 blur-3xl'
        background='radial-gradient(circle at 50% 50%, rgba(237, 98, 46, 0.11) 0%, rgba(23, 72, 121, 0.1) 42%, rgba(255, 255, 255, 0) 78%)'
      />

      <div className='relative mx-auto w-full max-w-[1585px]'>
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
            {content.title}
          </h2>
        </div>

        <div className='relative mt-12 sm:mt-14 lg:mt-16'>
          <div
            aria-hidden='true'
            className='absolute left-[16%] right-[16%] top-[26px] hidden h-[4px] rounded-full lg:block'
            style={{ backgroundColor: TIMELINE_COLOR }}
          />

          <ul className='relative grid gap-7 lg:grid-cols-3 lg:gap-8'>
            {moduleSteps.map((module, index) => {
              const stepTextColor =
                index === moduleSteps.length - 1
                  ? MUTED_STEP_TEXT
                  : 'var(--figma-colors-desktop, #FFFFFF)';
              const titleStyleByIndex =
                index === 1 ? moduleTitleSecondaryStyle : moduleTitlePrimaryStyle;
              const weekStyleByIndex =
                index === 1 ? moduleWeekSecondaryStyle : moduleWeekPrimaryStyle;

              return (
                <li key={module.step} className='relative pl-16 lg:pl-0 lg:pt-10'>
                  {index !== moduleSteps.length - 1 && (
                    <span
                      aria-hidden='true'
                      className='absolute bottom-[-22px] left-[26px] top-[74px] w-[2px] lg:hidden'
                      style={{ backgroundColor: TIMELINE_COLOR }}
                    />
                  )}

                  <span
                    className='absolute left-0 top-5 z-10 inline-flex h-[53px] w-[53px] items-center justify-center rounded-full lg:left-1/2 lg:top-0 lg:-translate-x-1/2'
                    style={{
                      backgroundColor: HEADING_COLOR,
                      boxShadow: BADGE_SHADOW,
                    }}
                  >
                    <span
                      style={{
                        color: stepTextColor,
                        fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
                        fontSize: 'var(--figma-fontsizes-20, 20px)',
                        fontWeight: 'var(--figma-fontweights-800, 800)',
                        lineHeight: 'var(--figma-fontsizes-20, 20px)',
                      }}
                    >
                      {module.step}
                    </span>
                  </span>

                  <article
                    className='relative h-full min-h-[305px] overflow-hidden rounded-[32px] border border-black/5 px-5 py-8 sm:px-7 lg:min-h-[700px] lg:rounded-[42px] lg:px-9 lg:py-10'
                    style={{
                      background:
                        'linear-gradient(180deg, #FFFFFF 0%, rgba(248, 248, 248, 0.94) 100%)',
                    }}
                  >
                    <BackgroundGlow
                      className='-right-14 top-12 h-44 w-44 blur-3xl'
                      background={
                        index === 1
                          ? 'rgba(23, 72, 121, 0.12)'
                          : 'rgba(237, 98, 46, 0.12)'
                      }
                    />
                    <BackgroundGlow
                      className='-left-12 bottom-12 h-36 w-36 blur-3xl'
                      background='rgba(93, 157, 73, 0.16)'
                    />

                    <div className='relative z-10 flex h-full flex-col items-center text-center'>
                      <div
                        className='mt-4 inline-flex items-center justify-center rounded-full lg:mt-6'
                        style={{
                          width: 'clamp(120px, 18vw, 162px)',
                          height: 'clamp(120px, 18vw, 162px)',
                          backgroundColor: ICON_SURFACE,
                          boxShadow: ICON_SHADOW,
                        }}
                      >
                        <div
                          className='inline-flex items-center justify-center rounded-full'
                          style={{
                            width: 'clamp(102px, 16vw, 140px)',
                            height: 'clamp(102px, 16vw, 140px)',
                            backgroundColor: ICON_SURFACE,
                          }}
                        >
                          <ModuleGlyph variant={module.icon} />
                        </div>
                      </div>

                      <div className='mt-auto pb-2'>
                        <h3 style={titleStyleByIndex}>{module.title}</h3>
                        <p className='mt-2' style={weekStyleByIndex}>
                          {module.week}
                        </p>
                      </div>
                    </div>

                    <div
                      aria-hidden='true'
                      className='absolute inset-x-[10%] bottom-0 h-[2px] rounded-full'
                      style={{ backgroundColor: CARD_BG }}
                    />
                  </article>
                </li>
              );
            })}
          </ul>
        </div>

        <div className='mx-auto mt-12 max-w-[760px] text-center lg:mt-16'>
          {content.description && (
            <p className='text-balance' style={descriptionStyle}>
              {content.description}
            </p>
          )}

          <SectionCtaLink
            href={content.ctaHref}
            className='mt-8 h-[62px] w-full max-w-[491px] rounded-[10px] px-5 focus-visible:outline-black/30 sm:h-[72px] sm:px-7 lg:mt-10 lg:h-[81px]'
            style={ctaStyle}
          >
            {content.ctaLabel}
          </SectionCtaLink>
        </div>
      </div>
    </SectionShell>
  );
}
