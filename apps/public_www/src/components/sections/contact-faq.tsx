import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ContactUsContent } from '@/content';

interface ContactFaqProps {
  content: ContactUsContent['contactFaq'];
}

export function ContactFaq({ content }: ContactFaqProps) {
  return (
    <SectionShell
      id='contact-faq'
      ariaLabel={content.title}
      dataFigmaNode='contact-faq'
      className='es-section-bg-overlay es-contact-faq-section overflow-hidden'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
        />

        <ul className='mt-10 grid grid-cols-1 gap-4 sm:gap-5 lg:mt-12 lg:grid-cols-2'>
          {content.cards.map((card) => (
            <li key={card.question}>
              <article className='flex h-full flex-col rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-card sm:px-6 sm:py-6'>
                <h3 className='es-type-subtitle'>{card.question}</h3>
                <p className='mt-3 es-section-body text-base leading-7'>{card.answer}</p>
              </article>
            </li>
          ))}
        </ul>
      </SectionContainer>
    </SectionShell>
  );
}
