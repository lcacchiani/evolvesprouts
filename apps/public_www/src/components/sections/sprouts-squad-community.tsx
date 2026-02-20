import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { SproutsSquadCommunityContent } from '@/content';

interface SproutsSquadCommunityProps {
  content: SproutsSquadCommunityContent;
}

export function SproutsSquadCommunity({
  content,
}: SproutsSquadCommunityProps) {
  return (
    <SectionShell
      id='sprouts-squad-community'
      ariaLabel={content.heading}
      dataFigmaNode='sprouts-squad-community'
      className='relative isolate overflow-hidden es-sprouts-community-section'
    >
      <Image
        src='/images/footer-community-bg.webp'
        alt=''
        fill
        sizes='100vw'
        className='object-cover object-top'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 es-sprouts-community-overlay'
      />

      <SectionContainer className='flex min-h-[420px] flex-col justify-center gap-7 sm:min-h-[530px] lg:min-h-[740px] lg:gap-9'>
        <Image
          src='/images/evolvesprouts-logo.svg'
          alt=''
          width={250}
          height={250}
          className='h-auto w-[250px] es-sprouts-community-logo'
        />
        <SectionHeader
          title={content.heading}
          align='left'
          className='max-w-[620px]'
          titleClassName='!mt-0 text-[clamp(1.9rem,6vw,55px)] leading-[1.12] sm:-mt-6 lg:-mt-[52px] es-sprouts-community-heading'
        />

        <SectionCtaAnchor
          href={content.ctaHref}
          className='w-full max-w-[500px] lg:max-w-[410px]'
        >
          {content.ctaLabel}
        </SectionCtaAnchor>
      </SectionContainer>
    </SectionShell>
  );
}
