/* eslint-disable @next/next/no-img-element -- static SVG icons from /public/images */

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ConsultationsComparisonContent } from '@/content';

interface ConsultationsComparisonProps {
  content: ConsultationsComparisonContent;
}

export function ConsultationsComparison({
  content,
}: ConsultationsComparisonProps) {
  return (
    <SectionShell
      id='consultations-comparison'
      ariaLabel={content.title}
      dataFigmaNode='consultations-comparison'
      className='es-section-bg-overlay'
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div className='mt-10 overflow-x-auto'>
          <table className='w-full min-w-[480px] border-collapse text-left'>
            <thead>
              <tr>
                <th className='border-b es-border-soft pb-4 pr-4 align-bottom'>
                  &nbsp;
                </th>
                <th className='border-b es-border-soft px-4 pb-4 align-bottom'>
                  <div className='flex flex-col items-center gap-3 text-center'>
                    <img
                      src='/images/essentials.svg'
                      alt=''
                      width={40}
                      height={40}
                      className='h-10 w-10 shrink-0 object-contain'
                    />
                    <span className='es-type-subtitle es-text-heading'>
                      {content.essentialsLabel}
                    </span>
                  </div>
                </th>
                <th className='border-b es-border-soft pb-4 pl-4 align-bottom'>
                  <div className='flex flex-col items-center gap-3 text-center'>
                    <img
                      src='/images/deep-dive.svg'
                      alt=''
                      width={40}
                      height={40}
                      className='h-10 w-10 shrink-0 object-contain'
                    />
                    <span className='es-type-subtitle es-text-heading'>
                      {content.deepDiveLabel}
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row) => (
                <tr key={row.label}>
                  <td className='border-b es-border-soft py-4 pr-4 font-medium es-type-body es-text-heading'>
                    {row.label}
                  </td>
                  <td className='border-b es-border-soft px-4 py-4 es-type-body es-text-dim'>
                    {row.essentials}
                  </td>
                  <td className='border-b es-border-soft py-4 pl-4 es-type-body es-text-dim'>
                    {row.deepDive}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='mt-9 text-center sm:mt-11 lg:mt-12'>
          <p className='es-type-body-italic mx-auto max-w-[780px] text-balance'>
            {content.footnote}
          </p>
        </div>

        <div className='mt-8 flex justify-center sm:mt-10 lg:mt-11'>
          <SectionCtaAnchor
            href={content.ctaHref}
            className='w-full max-w-[488px]'
          >
            {content.ctaLabel}
          </SectionCtaAnchor>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
