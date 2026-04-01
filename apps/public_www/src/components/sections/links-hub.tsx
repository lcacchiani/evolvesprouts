'use client';

import Image from 'next/image';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LinksHubContent } from '@/content';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import {
  type MetaPixelStaticContentName,
  PIXEL_CONTENT_NAME,
} from '@/lib/meta-pixel-taxonomy';

const LOGO_SRC = '/images/evolvesprouts-logo.svg';
const LOGO_SIZE = 72;
const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';
const INSTAGRAM_ICON_SRC = '/images/contact-instagram.svg';
const SOCIAL_ICON_SIZE = 20;
const HUB_BUTTON_CLASSNAME =
  'w-full min-h-[50px] rounded-control px-6 text-base font-semibold';

interface LinksHubProps {
  content: LinksHubContent;
  localizedCourseHref: string;
  localizedContactHref: string;
  localizedEventsHref: string;
  whatsappHref: string;
  instagramHref: string;
}

interface LinkItem {
  label: string;
  href: string;
  trackingName: MetaPixelStaticContentName;
}

function trackLinkClick(contentName: MetaPixelStaticContentName) {
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
  instagramHref,
}: LinksHubProps) {
  const links: LinkItem[] = [
    {
      label: content.courseLabel,
      href: localizedCourseHref,
      trackingName: PIXEL_CONTENT_NAME.my_best_auntie_course,
    },
    {
      label: content.contactLabel,
      href: localizedContactHref,
      trackingName: PIXEL_CONTENT_NAME.contact_us,
    },
    {
      label: content.eventsLabel,
      href: localizedEventsHref,
      trackingName: PIXEL_CONTENT_NAME.events,
    },
  ];

  const hasWhatsapp = whatsappHref !== '';
  const hasInstagram = instagramHref !== '';

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
            <ButtonPrimitive
              key={link.trackingName}
              href={link.href}
              variant='outline'
              className={HUB_BUTTON_CLASSNAME}
              onClick={() => trackLinkClick(link.trackingName)}
            >
              {link.label}
            </ButtonPrimitive>
          ))}

          {hasWhatsapp ? (
            <ButtonPrimitive
              href={whatsappHref}
              variant='primary'
              openInNewTab
              className={`${HUB_BUTTON_CLASSNAME} es-btn--whatsapp-cta`}
              onClick={() => {
                trackLinkClick(PIXEL_CONTENT_NAME.whatsapp);
                trackAnalyticsEvent('whatsapp_click', {
                  sectionId: 'links-hub',
                  ctaLocation: 'links_page',
                });
                trackMetaPixelEvent('Contact', { content_name: PIXEL_CONTENT_NAME.whatsapp });
              }}
            >
              <span className='inline-flex items-center gap-2'>
                <Image
                  src={WHATSAPP_ICON_SRC}
                  alt=''
                  width={SOCIAL_ICON_SIZE}
                  height={SOCIAL_ICON_SIZE}
                />
                {content.whatsappLabel}
              </span>
            </ButtonPrimitive>
          ) : null}

          {hasInstagram ? (
            <ButtonPrimitive
              href={instagramHref}
              variant='outline'
              openInNewTab
              className={HUB_BUTTON_CLASSNAME}
              onClick={() => trackLinkClick(PIXEL_CONTENT_NAME.instagram)}
            >
              <span className='inline-flex items-center gap-2'>
                <Image
                  src={INSTAGRAM_ICON_SRC}
                  alt=''
                  width={SOCIAL_ICON_SIZE}
                  height={SOCIAL_ICON_SIZE}
                />
                {content.instagramLabel}
              </span>
            </ButtonPrimitive>
          ) : null}
        </nav>
      </div>
    </SectionShell>
  );
}
