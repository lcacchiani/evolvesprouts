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
      className='es-section-bg-overlay es-consultations-comparison-section'
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div className='mt-10'>
          <table className='es-consultations-comparison-table w-full table-fixed border-collapse text-left'>
            <thead>
              <tr>
                <th className='border-b es-border-soft pb-4 pr-2 align-bottom sm:pr-4'>
                  &nbsp;
                </th>
                <th className='border-b es-border-soft px-1 pb-4 align-bottom sm:px-3'>
                  <div className='flex flex-col items-center gap-2 text-center sm:gap-3'>
                    <img
                      src='/images/essentials.svg'
                      alt=''
                      width={40}
                      height={40}
                      className='h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10'
                    />
                    <span className='es-type-subtitle es-text-heading'>
                      {content.essentialsLabel}
                    </span>
                  </div>
                </th>
                <th className='border-b es-border-soft px-1 pb-4 align-bottom sm:px-3'>
                  <div className='flex flex-col items-center gap-2 text-center sm:gap-3'>
                    <img
                      src='/images/deep-dive.svg'
                      alt=''
                      width={40}
                      height={40}
                      className='h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10'
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
                  <td className='border-b es-border-soft py-3 pr-2 align-top sm:py-4 sm:pr-4'>
                    <div className='min-w-0'>
                      <div className='font-medium es-type-body es-text-heading'>
                        {row.label}
                      </div>
                      <div className='mt-1 es-type-detail es-text-dim'>
                        {row.detail}
                      </div>
                    </div>
                  </td>
                  <td className='border-b es-border-soft px-1 py-3 text-center align-middle sm:px-3 sm:py-4'>
                    <img
                      src={
                        row.essentials
                          ? '/images/check.svg'
                          : '/images/cross.svg'
                      }
                      alt={
                        row.essentials
                          ? content.includedAlt
                          : content.notIncludedAlt
                      }
                      width={24}
                      height={24}
                      className='mx-auto h-6 w-6 object-contain'
                    />
                  </td>
                  <td className='border-b es-border-soft px-1 py-3 text-center align-middle sm:px-3 sm:py-4'>
                    <img
                      src={
                        row.deepDive
                          ? '/images/check.svg'
                          : '/images/cross.svg'
                      }
                      alt={
                        row.deepDive
                          ? content.includedAlt
                          : content.notIncludedAlt
                      }
                      width={24}
                      height={24}
                      className='mx-auto h-6 w-6 object-contain'
                    />
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
