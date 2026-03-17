'use client';

import Image from 'next/image';

import { SmartLink } from '@/components/shared/smart-link';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

interface WhatsappContactButtonProps {
  href: string;
  ariaLabel: string;
}

const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';

const buttonClassName =
  'fixed right-[30px] z-50 flex h-16 w-16 items-center justify-center ' +
  'es-whatsapp-contact-button-safe-bottom ' +
  'rounded-full bg-white shadow-es-whatsapp transition-' +
  'transform duration-150 hover:scale-105 focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-4 ' +
  'focus-visible:outline-[var(--es-color-whatsapp)]';

export function WhatsappContactButton({
  href,
  ariaLabel,
}: WhatsappContactButtonProps) {
  if (!href) {
    return null;
  }

  return (
    <SmartLink
      href={href}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={buttonClassName}
      onClick={() => {
        trackAnalyticsEvent('whatsapp_click', {
          sectionId: 'whatsapp-contact-button',
          ctaLocation: 'floating_button',
        });
        trackMetaPixelEvent('Contact', { content_name: 'whatsapp' });
      }}
    >
      <Image
        src={WHATSAPP_ICON_SRC}
        alt=''
        aria-hidden='true'
        width={44}
        height={44}
        className='h-11 w-11'
      />
    </SmartLink>
  );
}
