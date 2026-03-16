'use client';

import Image from 'next/image';

import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import type { LinksHubContent } from '@/content';
import { SectionShell } from '@/components/sections/shared/section-shell';

const LOGO_SRC = '/images/evolvesprouts-logo.svg';
const LOGO_SIZE = 72;
const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';
const WHATSAPP_ICON_SIZE = 20;

interface LinksHubProps {
  content: LinksHubContent;
  localizedCourseHref: string;
  localizedContactHref: string;
  localizedEventsHref: string;
  whatsappHref: string;
}

interface LinkItem {
  label: string;
  href: string;
  trackingName: string;
}

function trackLinkClick(contentName: string) {
  trackAnalyticsEvent('links_hub_click', {
    sectionId: 'links-hub',
    ctaLocation: 'links_page',
    params: { content_name: contentName },
  });
  trackMetaPixelEvent('ViewContent', { content_name: contentName });
}

export function LinksHub({
  content,
  localizedCourseHref,
  localizedContactHref,
  localizedEventsHref,
  whatsappHref,
}: LinksHubProps) {
  const links: LinkItem[] = [
    {
      label: content.courseLabel,
      href: localizedCourseHref,
      trackingName: 'my_best_auntie_course',
    },
    {
      label: content.contactLabel,
      href: localizedContactHref,
      trackingName: 'contact_us',
    },
    {
      label: content.eventsLabel,
      href: localizedEventsHref,
      trackingName: 'events',
    },
  ];

  const hasWhatsapp = whatsappHref !== '';

  return (
    <SectionShell
      id='links-hub'
      ariaLabel={content.ariaLabel}
      dataFigmaNode='links-hub'
      className='flex min-h-svh items-center justify-center'
    >
      <div className='mx-auto w-full max-w-md px-5 py-12'>
        <div className='flex flex-col items-center text-center'>
          <Image
            src={LOGO_SRC}
            alt=''
            width={LOGO_SIZE}
            height={LOGO_SIZE}
            className='rounded-full'
            priority
          />
          <h1 className='mt-4 es-type-heading-2'>{content.heading}</h1>
          <p className='mt-1 es-section-body text-base'>{content.tagline}</p>
        </div>

        <nav aria-label={content.ariaLabel} className='mt-8 flex flex-col gap-3'>
          {links.map((link) => (
            <a
              key={link.trackingName}
              href={link.href}
              className='es-btn es-btn--outline w-full text-center'
              onClick={() => trackLinkClick(link.trackingName)}
            >
              {link.label}
            </a>
          ))}

          {hasWhatsapp ? (
            <a
              href={whatsappHref}
              target='_blank'
              rel='noopener noreferrer'
              className='es-btn es-btn--whatsapp-cta w-full text-center'
              onClick={() => {
                trackLinkClick('whatsapp');
                trackAnalyticsEvent('whatsapp_click', {
                  sectionId: 'links-hub',
                  ctaLocation: 'links_page',
                });
                trackMetaPixelEvent('Contact', { content_name: 'whatsapp' });
              }}
            >
              <span className='inline-flex items-center gap-2'>
                <Image
                  src={WHATSAPP_ICON_SRC}
                  alt=''
                  width={WHATSAPP_ICON_SIZE}
                  height={WHATSAPP_ICON_SIZE}
                />
                {content.whatsappLabel}
              </span>
            </a>
          ) : null}
        </nav>
      </div>
    </SectionShell>
  );
}
