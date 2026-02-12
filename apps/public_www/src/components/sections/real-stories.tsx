import Image from 'next/image';
import { type CSSProperties } from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import {
  readCandidateText,
  readOptionalText,
} from '@/content/content-field-utils';
import type { RealStoriesContent } from '@/content';

interface RealStoriesProps {
  content: RealStoriesContent;
}

interface NormalizedStory {
  quote?: string;
  author?: string;
  role?: string;
  metaLocation?: string;
  badgeLabel?: string;
  mainImageSrc?: string;
  mainImageAlt?: string;
  avatarImageSrc?: string;
  avatarImageAlt?: string;
}

const TEXT_PRIMARY =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const TEXT_SECONDARY = 'var(--figma-colors-home, #4A4A4A)';
const BADGE_BORDER = '#EECAB0';
const PROFILE_CARD_BG = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const IMAGE_FALLBACK_BG = '#F3DCCB';

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

const descriptionTextStyle: CSSProperties = {
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
  fontSize: 'clamp(1.25rem, 2.3vw, 28px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1.7',
  letterSpacing: '0.01em',
};

const authorStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.4rem, 2.8vw, var(--figma-fontsizes-32, 32px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: '1.15',
};

const metaTextStyle: CSSProperties = {
  color: TEXT_SECONDARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 2.1vw, 1.2rem)',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: '1.5',
  letterSpacing: 'var(--figma-letterspacing-mom-of-2, 0.5px)',
};

function normalizeStory(item: unknown): NormalizedStory | null {
  if (typeof item === 'string') {
    const quote = readOptionalText(item);
    return quote ? { quote } : null;
  }

  if (typeof item !== 'object' || item === null) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const story: NormalizedStory = {
    badgeLabel: readCandidateText(record, [
      'badgeLabel',
      'badge',
      'eyebrow',
      'label',
    ]),
    quote: readCandidateText(record, [
      'quote',
      'testimonial',
      'text',
      'description',
      'content',
    ]),
    author: readCandidateText(record, ['author', 'name', 'parentName']),
    role: readCandidateText(record, ['role', 'subtitle', 'title']),
    metaLocation: readCandidateText(record, [
      'metaLocation',
      'from',
      'location',
      'city',
    ]),
    mainImageSrc: readCandidateText(record, [
      'mainImageSrc',
      'slideImageSrc',
      'imageSrc',
      'image',
    ]),
    mainImageAlt: readCandidateText(record, ['mainImageAlt', 'imageAlt']),
    avatarImageSrc: readCandidateText(record, [
      'avatarImageSrc',
      'authorImageSrc',
      'userImageSrc',
      'avatar',
    ]),
    avatarImageAlt: readCandidateText(record, [
      'avatarImageAlt',
      'authorImageAlt',
      'userImageAlt',
    ]),
  };

  return Object.values(story).some(Boolean) ? story : null;
}

function normalizeStories(items: unknown): NormalizedStory[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => normalizeStory(item))
    .filter((item): item is NormalizedStory => item !== null);
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

function ParentIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 134 134'
      className='h-[58px] w-[58px] sm:h-[68px] sm:w-[68px]'
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
  const stories = normalizeStories(content.items);
  const storiesToRender =
    stories.length > 0
      ? stories
      : [{ quote: content.title } satisfies NormalizedStory];
  const badgeLabel = storiesToRender[0]?.badgeLabel ?? content.title;
  const descriptionText = content.description.trim();

  return (
    <SectionShell
      ariaLabel={content.title}
      dataFigmaNode='Real Stories'
      className='relative isolate overflow-hidden'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute left-1/2 top-0 h-[540px] w-[980px] -translate-x-1/2'
        style={{
          background:
            'radial-gradient(circle at center, rgba(231,108,61,0.12) 0%, rgba(231,108,61,0) 64%)',
        }}
      />

      <div className='relative mx-auto w-full max-w-[1488px]'>
        <div className='mx-auto max-w-[760px] text-center'>
          <SectionEyebrowChip
            label={badgeLabel}
            labelStyle={badgeTextStyle}
            className='px-4 py-2.5'
            style={{
              borderColor: BADGE_BORDER,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
            }}
          />

          <h2 className='mt-6 text-balance' style={headingStyle}>
            {content.title}
          </h2>

          {descriptionText && (
            <p className='mt-3' style={descriptionTextStyle}>
              {descriptionText}
            </p>
          )}
        </div>

        <div className='mt-10 space-y-6 lg:mt-14'>
          {storiesToRender.map((story, index) => {
            const quoteText = story.quote ?? content.title;
            const showMeta =
              Boolean(story.author) ||
              Boolean(story.role) ||
              Boolean(story.metaLocation);

            return (
              <article
                key={`${story.author ?? 'story'}-${index}`}
                className='overflow-hidden rounded-[30px] border border-[#EFD7C7] bg-white shadow-[0_28px_70px_rgba(18,18,17,0.08)]'
              >
                <div className='grid lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)]'>
                  <div className='relative min-h-[260px] bg-[#F5DFCF] sm:min-h-[360px] lg:min-h-[540px]'>
                    {story.mainImageSrc ? (
                      <Image
                        src={story.mainImageSrc}
                        alt={
                          story.mainImageAlt ??
                          `${story.author ?? 'Parent'} testimonial image`
                        }
                        fill
                        sizes='(min-width: 1024px) 500px, 100vw'
                        className='object-cover'
                        priority={index === 0}
                      />
                    ) : (
                      <div
                        className='flex h-full min-h-[260px] items-center justify-center sm:min-h-[360px] lg:min-h-[540px]'
                        style={{ backgroundColor: IMAGE_FALLBACK_BG }}
                      >
                        <ParentIcon />
                      </div>
                    )}
                  </div>

                  <div className='flex flex-col p-6 sm:p-9 lg:px-12 lg:pb-10 lg:pt-12'>
                    <div className='flex items-start gap-3 border-b border-[rgba(31,31,31,0.2)] pb-8 sm:gap-5 lg:pb-[52px]'>
                      <span className='shrink-0 pt-1'>
                        <QuoteIcon />
                      </span>
                      <p className='text-balance' style={quoteTextStyle}>
                        {quoteText}
                      </p>
                    </div>

                    {showMeta && (
                      <div className='mt-6 flex items-start gap-4 sm:mt-8 sm:gap-6'>
                        {story.avatarImageSrc ? (
                          <Image
                            src={story.avatarImageSrc}
                            alt={
                              story.avatarImageAlt ??
                              `${story.author ?? 'Parent'} avatar`
                            }
                            width={100}
                            height={100}
                            className='h-[82px] w-[71px] shrink-0 rounded-[16px] object-cover sm:h-[100px] sm:w-[100px] sm:rounded-[20px]'
                          />
                        ) : (
                          <span
                            className='inline-flex h-[82px] w-[71px] shrink-0 items-center justify-center rounded-[16px] sm:h-[100px] sm:w-[100px] sm:rounded-[20px]'
                            style={{ backgroundColor: PROFILE_CARD_BG }}
                          >
                            <ParentIcon />
                          </span>
                        )}

                        <div className='min-w-0'>
                          {story.author && <p style={authorStyle}>{story.author}</p>}
                          {story.role && (
                            <p
                              className={`max-w-[190px] ${story.author ? 'mt-1' : ''}`}
                              style={metaTextStyle}
                            >
                              {story.role}
                            </p>
                          )}
                          {story.metaLocation && (
                            <p className='mt-1 max-w-[190px]' style={metaTextStyle}>
                              {story.metaLocation}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
