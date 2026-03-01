'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

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

export function FreeGuideDownloadRedirectPage() {
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
      <main className='mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center'>
        <h1 className='text-3xl font-bold es-text-heading'>Invalid download link</h1>
        <p className='mt-4 text-base leading-7 es-text-body'>
          This free-guide link is missing a valid token. Please request the guide again.
        </p>
      </main>
    );
  }

  if (!normalizedShareBaseUrl) {
    return (
      <main className='mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center'>
        <h1 className='text-3xl font-bold es-text-heading'>Download temporarily unavailable</h1>
        <p className='mt-4 text-base leading-7 es-text-body'>
          We could not prepare your download link. Please try again in a moment.
        </p>
      </main>
    );
  }

  return (
    <main className='mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center'>
      <div className='h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--site-primary-soft,#EAD5C4)] border-t-[color:var(--site-primary,#D19253)]' />
      <h1 className='mt-6 text-3xl font-bold es-text-heading'>Preparing your download...</h1>
      <p className='mt-4 text-base leading-7 es-text-body'>
        If your download does not start automatically, use the link below.
      </p>
      <a
        href={destinationUrl}
        className='mt-5 text-base font-semibold underline underline-offset-4 es-text-brand'
      >
        Download the guide manually
      </a>
    </main>
  );
}
