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
      <p className='text-sm font-semibold es-text-heading'>{title}</p>
      <ul className='mt-3 space-y-2' aria-label={title}>
        {methods.map((method) => (
          <li key={method.key}>
            <SmartLink
              href={method.href}
              className='inline-flex items-center gap-2 text-sm leading-6 text-[color:var(--site-primary-text)] transition-opacity hover:opacity-80'
            >
              <span
                aria-hidden='true'
                data-testid={`contact-method-icon-${method.key}`}
                className='inline-flex h-4 w-4 shrink-0 items-center justify-center es-text-heading'
              >
                <Image
                  src={method.iconSrc}
                  alt=''
                  width={16}
                  height={16}
                  className='h-4 w-4'
                />
              </span>
              <span>{method.label}</span>
            </SmartLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
