'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import enContent from '@/content/en.json';
import type { CommonContent } from '@/content';

const REDIRECT_DELAY_MS = 500;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;
const ASSET_SHARE_BASE_URL_ENV_NAME = 'NEXT_PUBLIC_ASSET_SHARE_BASE_URL';

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    return null;
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol === 'https:') {
    return parsedUrl.toString().replace(/\/+$/, '');
  }
  if (protocol === 'http:' && parsedUrl.hostname.toLowerCase() === 'localhost') {
    return parsedUrl.toString().replace(/\/+$/, '');
  }

  return null;
}

function buildShareUrl(baseUrl: string, token: string): string {
  return new URL(`/v1/assets/share/${token}`, `${baseUrl}/`).toString();
}

export function MediaDownloadRedirectPage({
  content = enContent.common.mediaDownload,
}: {
  content?: CommonContent['mediaDownload'];
}) {
  const copy = content;
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const hasValidToken = TOKEN_PATTERN.test(token);
  const normalizedShareBaseUrl = useMemo(
    () => normalizeBaseUrl(process.env[ASSET_SHARE_BASE_URL_ENV_NAME]),
    [],
  );
  const destinationUrl =
    normalizedShareBaseUrl && hasValidToken
      ? buildShareUrl(normalizedShareBaseUrl, token)
      : '';

  useEffect(() => {
    if (!destinationUrl) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.location.assign(destinationUrl);
    }, REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [destinationUrl]);

  if (!hasValidToken) {
    return (
      <main
        id='main-content'
        tabIndex={-1}
        className='mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center'
      >
        <h1 className='text-3xl font-semibold es-text-heading'>{copy.invalidTitle}</h1>
        <p className='mt-4 text-base leading-7 es-text-body'>
          {copy.invalidDescription}
        </p>
      </main>
    );
  }

  if (!normalizedShareBaseUrl) {
    return (
      <main
        id='main-content'
        tabIndex={-1}
        className='mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center'
      >
        <h1 className='text-3xl font-semibold es-text-heading'>{copy.unavailableTitle}</h1>
        <p className='mt-4 text-base leading-7 es-text-body'>
          {copy.unavailableDescription}
        </p>
      </main>
    );
  }

  return (
    <main
      id='main-content'
      tabIndex={-1}
      className='mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center'
    >
      <div className='flex w-full max-w-lg flex-col items-center'>
        <div className='h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--site-primary-soft,#EAD5C4)] border-t-[color:var(--site-primary,#D19253)]' />
        <div className='mt-6 w-full min-h-0 overflow-hidden rounded-inner border es-border-success es-bg-surface-success-pale p-4 text-left'>
          <p className='text-base leading-7 es-text-success'>{copy.preparingMessage}</p>
        </div>
        <a
          href={destinationUrl}
          className='mt-5 text-base font-semibold underline underline-offset-4 es-text-brand'
        >
          {copy.manualDownloadLabel}
        </a>
      </div>
    </main>
  );
}
