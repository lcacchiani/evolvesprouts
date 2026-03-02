import Image from 'next/image';

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
        className='mt-4 flex max-w-full flex-wrap items-start'
        aria-label={title}
      >
        {methods.map((method) => {
          const isLinkedInIcon = method.key === 'linkedin';
          const linkWidthClassName = isLinkedInIcon ? 'w-auto' : 'w-[100px]';
          const iconContainerWidthClassName = isLinkedInIcon ? 'w-auto' : 'w-[100px]';
          const imageWidth = isLinkedInIcon ? 635 : 100;
          const imageHeight = isLinkedInIcon ? 540 : 100;
          const imageWidthClassName = isLinkedInIcon ? 'w-auto' : 'w-[100px]';

          return (
            <li key={method.key} className='m-[10px]'>
              <SmartLink
                href={method.href}
                aria-label={method.label}
                className={`inline-flex ${linkWidthClassName} flex-col items-center gap-3 text-center transition-opacity hover:opacity-80`}
              >
                {() => (
                  <>
                    <span
                      aria-hidden='true'
                      data-testid={`contact-method-icon-${method.key}`}
                      className={`inline-flex h-[100px] ${iconContainerWidthClassName} shrink-0 items-center justify-center es-text-heading`}
                    >
                      <Image
                        src={method.iconSrc}
                        alt=''
                        width={imageWidth}
                        height={imageHeight}
                        className={`h-[100px] ${imageWidthClassName}`}
                      />
                    </span>
                  </>
                )}
              </SmartLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
