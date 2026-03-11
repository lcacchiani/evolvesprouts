'use client';

import { Fragment, type KeyboardEvent, type ReactNode, useState } from 'react';
import Image from 'next/image';

import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { MyBestAuntieOutlineContent } from '@/content';
import { HEADING_TEXT_COLOR } from '@/lib/design-tokens';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';

interface MyBestAuntieOutlineProps {
  content: MyBestAuntieOutlineContent;
  ctaHref?: string;
}

type ModuleIconVariant =
  | 'home'
  | 'limits'
  | 'independence'
  | 'foundation'
  | 'coaching'
  | 'practice';
type ModuleToneVariant = 'gold' | 'red' | 'blue';

interface ModuleStep {
  step: string;
  title: string;
  week: string;
  icon: ModuleIconVariant;
  activity?: string;
}

interface ParsedModuleActivity {
  summary: string;
  points: string[];
}

const DEFAULT_STEP_ICONS: ModuleIconVariant[] = [
  'home',
  'limits',
  'independence',
];

const HEADING_COLOR = HEADING_TEXT_COLOR;
const MODULE_ICON_SOURCE_BY_VARIANT: Record<ModuleIconVariant, string> = {
  home: '/images/home.svg',
  limits: '/images/limits.svg',
  independence: '/images/independence.svg',
  foundation: '/images/home.svg',
  coaching: '/images/limits.svg',
  practice: '/images/independence.svg',
};

const MODULE_TONES: readonly ModuleToneVariant[] = ['gold', 'red', 'blue'];

function isModuleIconVariant(value: string): value is ModuleIconVariant {
  return (
    value === 'home' ||
    value === 'limits' ||
    value === 'independence' ||
    value === 'foundation' ||
    value === 'coaching' ||
    value === 'practice'
  );
}

function getModuleIconSource(variant: ModuleIconVariant): string {
  return MODULE_ICON_SOURCE_BY_VARIANT[variant];
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

function parseModuleActivity(activity: string | undefined): ParsedModuleActivity | null {
  if (!activity) {
    return null;
  }

  const lines = activity
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return null;
  }

  const [summary, ...points] = lines;
  return {
    summary,
    points: points.slice(0, 3),
  };
}

function splitActivityPointLabel(point: string): {
  label: string;
  detail: string;
} {
  const trimmedPoint = point.trim();
  const match = /^([^:：]+[:：])\s*(.*)$/.exec(trimmedPoint);
  if (!match) {
    return {
      label: '',
      detail: trimmedPoint,
    };
  }

  return {
    label: match[1],
    detail: match[2],
  };
}
function MyBestAuntieOutlineCard({
  module,
  index,
  showFullActivity,
  isExpanded,
  onToggleDescription,
}: {
  module: ModuleStep;
  index: number;
  showFullActivity: boolean;
  isExpanded: boolean;
  onToggleDescription?: () => void;
}) {
  const tone = getModuleTone(index);
  const isInteractive = !showFullActivity;
  const isDescriptionVisible = showFullActivity || isExpanded;
  const isActivityPreviewCollapsed = isInteractive && !isExpanded;
  const parsedActivity = parseModuleActivity(module.activity);
  const countLineSizeClassName = isDescriptionVisible
    ? '-top-[70px] h-[74px]'
    : '-top-[144px] h-[148px] md:group-hover:-top-[70px] md:group-hover:h-[74px]';

  function handleCardClick() {
    if (!isInteractive) {
      return;
    }

    onToggleDescription?.();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isInteractive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleDescription?.();
    }
  }
  const interactionProps = isInteractive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-expanded': isExpanded,
        onClick: handleCardClick,
        onKeyDown: handleCardKeyDown,
      }
    : {};

  return (
    <article
      {...interactionProps}
      className={`group relative flex min-h-[750px] flex-col overflow-hidden rounded-card-xl px-4 pb-6 pt-6 sm:px-6 es-my-best-auntie-outline-card es-my-best-auntie-outline-card--${tone} ${isInteractive ? 'cursor-pointer' : ''}`}
    >
      <div
        aria-hidden='true'
        className={`pointer-events-none absolute -right-8 top-10 h-36 w-36 rounded-full blur-3xl es-my-best-auntie-outline-icon-glow es-my-best-auntie-outline-icon-glow--${tone}`}
      />
      <div className='relative flex flex-1 flex-col items-center text-center'>
        <span
          aria-hidden='true'
          className='inline-flex h-[84px] w-[84px] items-center justify-center rounded-full bg-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
        >
          <Image
            src={getModuleIconSource(module.icon)}
            alt=''
            width={44}
            height={44}
            className='h-[44px] w-[44px]'
          />
        </span>
        <h3 className='mt-5 es-my-best-auntie-outline-module-title'>
          {module.title}
        </h3>
        <p className='mt-2 es-my-best-auntie-outline-module-week'>
          {module.week}
        </p>
        {parsedActivity && (
          <div
            className={`mx-auto mt-4 max-w-[34ch] text-left transition-[max-height] duration-300 es-my-best-auntie-outline-activity ${isActivityPreviewCollapsed ? 'max-h-[92px] overflow-hidden [mask-image:linear-gradient(#000_0%,#0000)] [-webkit-mask-image:linear-gradient(#000_0%,#0000)] md:group-hover:max-h-[520px] md:group-hover:overflow-visible md:group-hover:[mask-image:none] md:group-hover:[-webkit-mask-image:none]' : ''}`}
          >
            <p className='italic es-my-best-auntie-outline-activity-summary'>
              {parsedActivity.summary}
            </p>
            {parsedActivity.points.length > 0 && (
              <div className='mt-3 space-y-2'>
                {parsedActivity.points.map((point) => {
                  const { label, detail } = splitActivityPointLabel(point);
                  return (
                    <p key={point} className='es-my-best-auntie-outline-activity-point'>
                      {label ? <strong>{label}</strong> : null}
                      {detail ? (label ? ` ${detail}` : detail) : ''}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className='relative z-20 mt-auto flex -translate-y-[50px] flex-col items-center gap-4 pt-6'>
          <div className='relative'>
            <span
              aria-hidden='true'
              className={`pointer-events-none absolute left-1/2 z-0 w-2 -translate-x-1/2 rounded-full es-my-best-auntie-outline-count-line es-my-best-auntie-outline-count-line--${tone} ${countLineSizeClassName}`}
            />
            <span className='relative z-20 inline-flex h-[50px] w-[50px] items-center justify-center rounded-full es-bg-heading shadow-[0_3px_6px_rgba(0,0,0,0.32)]'>
              <span className={`es-my-best-auntie-outline-count-text es-my-best-auntie-outline-count-text--${tone}`}>
                {module.step}
              </span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MyBestAuntieOutline({
  content,
  ctaHref,
}: MyBestAuntieOutlineProps) {
  const [expandedModuleStep, setExpandedModuleStep] = useState<string | null>(
    null,
  );

  const { carouselRef } = useHorizontalCarousel<HTMLDivElement>({
    itemCount: content.modules.length,
    loop: false,
  });

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
  const computedCtaHref =
    ctaHref?.trim() || content.ctaHref?.trim() || '#my-best-auntie-booking';

  function handleToggleModule(step: string) {
    setExpandedModuleStep((previousStep) =>
      previousStep === step ? null : step,
    );
  }

  return (
    <SectionShell
      id='courses'
      ariaLabel={content.title}
      dataFigmaNode='my-best-auntie-outline'
      className='es-section-bg-overlay es-my-best-auntie-outline-section'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={renderMultilineText(content.title)}
          description={content.subtitle}
        />

        <div className='relative mt-12 sm:mt-14 lg:mt-16'>
          {/* Desktop / tablet grid (md+) */}
          <ul className='relative hidden gap-6 md:grid md:grid-cols-3'>
            {moduleSteps.map((module, index) => (
              <li key={module.step}>
                <MyBestAuntieOutlineCard
                  module={module}
                  index={index}
                  showFullActivity={false}
                  isExpanded={expandedModuleStep === module.step}
                  onToggleDescription={() => handleToggleModule(module.step)}
                />
              </li>
            ))}
          </ul>
          {/* Wave connector — desktop (static overlay on the grid) */}
          <div
            aria-hidden='true'
            className='pointer-events-none absolute bottom-[62px] left-0 right-0 z-10 hidden md:block'
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
                  x1='15.9'
                  y1='5'
                  x2='96.2'
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
                d='M15.9,5 C21.23,7 27.23,9 32.56,9 S43.73,7 49.23,5 S60.23,1 65.9,1 S77.23,3 82.56,5 S92.23,8 96.2,8'
                stroke='url(#wave-fade-lg)'
                strokeWidth='3.5'
                strokeLinecap='round'
                vectorEffect='non-scaling-stroke'
              />
            </svg>
          </div>
          {/* Mobile carousel (< md) with wave scrolling alongside cards */}
          <div data-css-fallback='hide-when-css-missing' className='md:hidden'>
            <CarouselTrack
              carouselRef={carouselRef}
              ariaLabel={`${content.title} carousel`}
              className='pb-2'
            >
              <ul className='relative inline-flex gap-4'>
                {moduleSteps.map((module, index) => (
                  <li
                    key={module.step}
                    className='w-[80vw] shrink-0 snap-center sm:w-[66vw]'
                  >
                    <MyBestAuntieOutlineCard
                      module={module}
                      index={index}
                      showFullActivity
                      isExpanded
                    />
                  </li>
                ))}
                {/* Wave connector — mobile (scrolls with the cards) */}
                <li
                  aria-hidden='true'
                  className='pointer-events-none absolute bottom-[62px] left-0 right-0 z-10'
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
                        x1='15.9'
                        y1='5'
                        x2='96.2'
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
                      d='M15.9,5 C21.23,7 27.23,9 32.56,9 S43.73,7 49.23,5 S60.23,1 65.9,1 S77.23,3 82.56,5 S92.23,8 96.2,8'
                      stroke='url(#wave-fade-sm)'
                      strokeWidth='3.5'
                      strokeLinecap='round'
                      vectorEffect='non-scaling-stroke'
                    />
                  </svg>
                </li>
              </ul>
            </CarouselTrack>
          </div>
        </div>

        <div className='mx-auto max-w-[760px] text-center'>
          {content.description && (
            <p className='es-type-body-italic text-balance'>
              {content.description}
            </p>
          )}

          <SectionCtaAnchor
            href={computedCtaHref}
            className='mt-8 w-full max-w-[491px] lg:mt-10'
          >
            {computedCtaLabel}
          </SectionCtaAnchor>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
