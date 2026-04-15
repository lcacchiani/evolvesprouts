'use client';

import { ServiceCard } from '@/components/sections/service-card';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type {
  CommonAccessibilityContent,
  ServicesContent,
} from '@/content';
import enContent from '@/content/en.json';

interface ServicesProps {
  content: ServicesContent;
  commonAccessibility?: CommonAccessibilityContent;
}

interface ServiceCardData {
  id: string;
  title: string;
  href: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
  description?: string;
}

interface ServiceCardMeta {
  id: string;
  href: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
}

const CARD_TONES = ['green', 'blue'] as const;

const fallbackServicesCopy = enContent.services;

const serviceCardMeta: ServiceCardMeta[] = [
  {
    id: 'my-best-auntie',
    href: '/services/my-best-auntie-training-course',
    imageSrc: '/images/services/course-card-1.webp',
    imageWidth: 344,
    imageHeight: 309,
    imageClassName: 'h-[235px] sm:h-[265px] lg:h-[305px]',
  },
  {
    id: 'family-consultations',
    href: '/services/consultations',
    imageSrc: '/images/services/course-card-2.webp',
    imageWidth: 433,
    imageHeight: 424,
    imageClassName: 'h-[250px] sm:h-[285px] lg:h-[328px]',
  },
  {
    id: 'free-guides',
    href: '/services/free-guides-and-resources',
    imageSrc: '/images/services/course-card-3.webp',
    imageWidth: 282,
    imageHeight: 335,
    imageClassName: 'h-[230px] sm:h-[265px] lg:h-[305px]',
  },
];

function getServiceCards(content: ServicesContent): ServiceCardData[] {
  const activeItems =
    content.items.length > 0
      ? content.items
      : fallbackServicesCopy.items;
  const itemById = new Map(activeItems.map((item) => [item.id, item]));
  const cards: ServiceCardData[] = [];

  for (const meta of serviceCardMeta) {
    const cardCopy = itemById.get(meta.id);
    if (!cardCopy) {
      continue;
    }

    const descriptionText =
      typeof cardCopy.description === 'string'
        ? cardCopy.description.trim()
        : '';

    if (descriptionText) {
      cards.push({
        ...meta,
        title: cardCopy.title,
        href: cardCopy.href || meta.href,
        description: descriptionText,
      });
    } else {
      cards.push({
        ...meta,
        title: cardCopy.title,
        href: cardCopy.href || meta.href,
      });
    }
  }

  return cards;
}

export function Services({
  content,
  commonAccessibility: _commonAccessibility = enContent.common.accessibility,
}: ServicesProps) {
  const sectionTitle = content.title || fallbackServicesCopy.title;
  const sectionEyebrow =
    content.eyebrow || fallbackServicesCopy.eyebrow;
  const serviceCards = getServiceCards(content);

  return (
    <SectionShell
      id='services'
      ariaLabel={sectionTitle}
      dataFigmaNode='services'
      className='es-section-bg-overlay es-services-section'
    >
      <div
        aria-hidden='true'
        className='es-section-brand-overlay pointer-events-none absolute inset-0'
      />

      <SectionContainer>
        <SectionHeader
          eyebrow={sectionEyebrow}
          title={sectionTitle}
        />

        <div className='relative'>
          <ul className='grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3'>
            {serviceCards.map((card, index) => {
              const tone = CARD_TONES[index % CARD_TONES.length];

              return (
                <li key={card.id}>
                  <ServiceCard
                    id={card.id}
                    title={card.title}
                    href={card.href}
                    imageSrc={card.imageSrc}
                    imageWidth={card.imageWidth}
                    imageHeight={card.imageHeight}
                    imageClassName={card.imageClassName}
                    description={card.description}
                    tone={tone}
                    goToServiceAriaLabelTemplate={content.goToServiceAriaLabelTemplate}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
