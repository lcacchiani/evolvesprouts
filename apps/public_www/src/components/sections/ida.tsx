import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionShell } from '@/components/section-shell';
import type { IdaContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface IdaProps {
  content: IdaContent;
}

const SECTION_BACKGROUND = '#FFFFFF';

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: '1.15',
  fontSize: 'clamp(2rem, 6vw, 58px)',
};

const subtitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 500,
  lineHeight: '1.4',
  fontSize: 'clamp(1.05rem, 2.2vw, 26px)',
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: '1.5',
  fontSize: 'clamp(1rem, 1.95vw, 24px)',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 600,
  lineHeight: '1',
  fontSize: '18px',
};

export function Ida({ content }: IdaProps) {
  return (
    <SectionShell
      id='ida'
      ariaLabel={content.title}
      dataFigmaNode='ida'
      style={{ backgroundColor: SECTION_BACKGROUND }}
      className='overflow-hidden'
    >
      <div className='mx-auto grid w-full max-w-[1465px] items-center gap-7 lg:grid-cols-2 lg:gap-10'>
        <div className='order-1 relative z-10 lg:order-2 lg:pl-8 xl:pl-[110px]'>
          <h1 style={titleStyle}>{content.title}</h1>
          <p className='mt-4 max-w-[760px]' style={subtitleStyle}>
            {content.subtitle}
          </p>
          <p className='mt-4 max-w-[720px]' style={bodyStyle}>
            {content.description}
          </p>
          <SectionCtaAnchor
            href={content.ctaHref}
            className='mt-8 h-[56px] rounded-[10px] px-6 sm:h-[62px]'
            style={ctaStyle}
          >
            {content.ctaLabel}
          </SectionCtaAnchor>
        </div>

        <div className='order-2 lg:order-1'>
          <div className='w-full lg:ml-[-100px] lg:mr-[-50px] lg:w-[700px] xl:ml-[-180px] xl:mr-[-200px] xl:w-[1111px]'>
            <Image
              src='/images/about-us/ida-degregorio-evolvesprouts.webp'
              alt='Ida De Gregorio from Evolve Sprouts'
              width={1112}
              height={840}
              sizes='(min-width: 1280px) 1111px, (min-width: 1024px) 700px, 100vw'
              priority
              className='h-auto w-full'
            />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
