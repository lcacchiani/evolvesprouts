'use client';

import { useEffect } from 'react';

interface LocaleDocumentAttributesProps {
  locale: string;
  direction: 'ltr' | 'rtl';
}

export function LocaleDocumentAttributes({
  locale,
  direction,
}: LocaleDocumentAttributesProps) {
  useEffect(() => {
    const rootElement = document.documentElement;
    rootElement.lang = locale;
    rootElement.setAttribute('dir', direction);
  }, [locale, direction]);

  return null;
}
