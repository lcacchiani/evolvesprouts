import Image from 'next/image';

import { ExternalLinkInlineContent } from '@/components/shared/external-link-icon';
import { SmartLink } from '@/components/shared/smart-link';
import type { ContactUsContent } from '@/content';

export interface ContactMethodLinkItem {
  key: string;
  href: string;
  label: string;
  iconSrc: string;
}

interface ContactMethodListProps {
  title: ContactUsContent['contactUsForm']['contactMethodsTitle'];
  methods: readonly ContactMethodLinkItem[];
}

export function ContactMethodList({ title, methods }: ContactMethodListProps) {
  return (
    <div className='mt-6'>
      <p className='es-section-body text-[1.05rem] leading-8'>{title}</p>
      <ul
        className='mt-4 flex flex-nowrap items-start gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
        aria-label={title}
      >
        {methods.map((method) => (
          <li key={method.key} className='shrink-0'>
            <SmartLink
              href={method.href}
              className='inline-flex min-w-[100px] flex-col items-center gap-3 text-center es-section-body text-[1.05rem] leading-8 transition-opacity hover:opacity-80'
            >
              {({ isExternalHttp }) => (
                <>
                  <span
                    aria-hidden='true'
                    data-testid={`contact-method-icon-${method.key}`}
                    className='inline-flex h-[100px] w-[100px] shrink-0 items-center justify-center es-text-heading'
                  >
                    <Image
                      src={method.iconSrc}
                      alt=''
                      width={100}
                      height={100}
                      className={
                        method.key === 'whatsapp'
                          ? 'h-[100px] w-[100px] es-contact-us-contact-method-icon--whatsapp'
                          : 'h-[100px] w-[100px]'
                      }
                    />
                  </span>
                  <ExternalLinkInlineContent isExternalHttp={isExternalHttp}>
                    {method.label}
                  </ExternalLinkInlineContent>
                </>
              )}
            </SmartLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
