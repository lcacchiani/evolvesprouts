import { SectionContainer } from '@/components/sections/shared/section-container';
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
                <th className='border-b es-border-soft pb-4 pr-4 text-sm font-semibold es-text-dim'>
                  &nbsp;
                </th>
                <th className='border-b es-border-soft pb-4 px-4 text-sm font-bold es-text-heading'>
                  {content.essentialsLabel}
                </th>
                <th className='border-b es-border-soft pb-4 pl-4 text-sm font-bold es-text-heading'>
                  {content.deepDiveLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row) => (
                <tr key={row.label}>
                  <td className='border-b es-border-soft py-4 pr-4 text-sm font-medium es-text-heading'>
                    {row.label}
                  </td>
                  <td className='border-b es-border-soft py-4 px-4 text-sm es-text-dim'>
                    {row.essentials}
                  </td>
                  <td className='border-b es-border-soft py-4 pl-4 text-sm es-text-dim'>
                    {row.deepDive}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className='mt-6 text-center text-sm es-text-muted'>
          {content.footnote}
        </p>
      </SectionContainer>
    </SectionShell>
  );
}
