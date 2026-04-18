'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { PublicSiteQrExportPanel } from '@/components/admin/public-site-qr-export-panel';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { trackAdminAnalyticsEvent } from '@/lib/admin-analytics';
import { getPublicSiteBaseUrl } from '@/lib/config';
import { PUBLIC_SITE_PAGE_PRESETS } from '@/lib/public-site-page-presets';
import {
  buildLocalizedPublicPageUrl,
  normalizePublicSitePathInput,
} from '@/lib/public-site-page-urls';
import {
  MY_BEST_AUNTIE_REFERRAL_LOCALES,
  REFERRAL_LOCALE_DISPLAY_LABELS,
  type MyBestAuntieReferralLocale,
} from '@/lib/referral-links';

const CUSTOM_PRESET_VALUE = '__custom__';

function pathToDownloadBase(path: string): string {
  if (path === '/') {
    return 'home';
  }
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed.replace(/\//g, '-') || 'page';
}

export function WebsiteQrPage() {
  const baseUrl = useMemo(() => getPublicSiteBaseUrl(), []);
  const [locale, setLocale] = useState<MyBestAuntieReferralLocale>('en');
  const [presetValue, setPresetValue] = useState<string>(PUBLIC_SITE_PAGE_PRESETS[0]?.pathInput ?? '/');
  const [customPathInput, setCustomPathInput] = useState('');
  const openedLoggedKey = useRef<string | null>(null);
  const isCustom = presetValue === CUSTOM_PRESET_VALUE;

  const normalizedPathResult = useMemo(() => {
    if (isCustom && !customPathInput.trim()) {
      return { path: '', error: 'Enter a path, or choose a preset above.' };
    }
    const raw = isCustom ? customPathInput : presetValue;
    return normalizePublicSitePathInput(raw);
  }, [customPathInput, isCustom, presetValue]);

  const builtUrl = useMemo(() => {
    if (!baseUrl || normalizedPathResult.error || !normalizedPathResult.path) {
      return '';
    }
    return buildLocalizedPublicPageUrl({
      baseUrl,
      locale,
      path: normalizedPathResult.path,
    });
  }, [baseUrl, locale, normalizedPathResult.error, normalizedPathResult.path]);

  const pathForAnalytics = normalizedPathResult.path || '';

  useEffect(() => {
    if (!builtUrl) {
      return;
    }
    const key = `${locale}|${pathForAnalytics}`;
    if (openedLoggedKey.current === key) {
      return;
    }
    openedLoggedKey.current = key;
    trackAdminAnalyticsEvent('admin_public_page_qr_opened', {
      public_site_path: pathForAnalytics,
      locale,
    });
  }, [builtUrl, locale, pathForAnalytics]);

  const configError = !baseUrl.trim()
    ? 'Set NEXT_PUBLIC_PUBLIC_SITE_BASE_URL to generate public page links.'
    : '';

  const pathError = normalizedPathResult.error;

  const downloadBase = `public-page-${pathToDownloadBase(normalizedPathResult.path || '/')}-${locale}`;

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Public website QR codes'
        description='Create printable QR codes that open pages on the public Evolve Sprouts site. Choose a locale and page; URLs match the static site (locale prefix and trailing slash).'
      >
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div>
            <Label htmlFor='website-qr-locale'>Locale</Label>
            <Select
              id='website-qr-locale'
              value={locale}
              onChange={(event) => setLocale(event.target.value as MyBestAuntieReferralLocale)}
              disabled={Boolean(configError)}
            >
              {MY_BEST_AUNTIE_REFERRAL_LOCALES.map((entry) => (
                <option key={entry} value={entry}>
                  {REFERRAL_LOCALE_DISPLAY_LABELS[entry]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='website-qr-preset-page'>Page</Label>
            <Select
              id='website-qr-preset-page'
              value={isCustom ? CUSTOM_PRESET_VALUE : presetValue}
              onChange={(event) => {
                const next = event.target.value;
                setPresetValue(next);
              }}
              disabled={Boolean(configError)}
            >
              {PUBLIC_SITE_PAGE_PRESETS.map((preset) => (
                <option key={preset.pathInput} value={preset.pathInput}>
                  {preset.label}
                </option>
              ))}
              <option value={CUSTOM_PRESET_VALUE}>Custom path…</option>
            </Select>
          </div>
        </div>
        {isCustom ? (
          <div>
            <Label htmlFor='website-qr-custom-path'>Custom path</Label>
            <Input
              id='website-qr-custom-path'
              value={customPathInput}
              onChange={(event) => setCustomPathInput(event.target.value)}
              placeholder='e.g. /about-us or /easter-2026-montessori-play-coaching-workshop'
              disabled={Boolean(configError)}
              autoComplete='off'
            />
            <p className='mt-1 text-xs text-slate-500'>
              Site path only (letters, numbers, hyphens per segment). Omit the locale; it is added
              automatically.
            </p>
          </div>
        ) : null}
        {pathError ? <p className='text-sm text-red-600'>{pathError}</p> : null}
        <PublicSiteQrExportPanel
          builtUrl={builtUrl && !pathError ? builtUrl : ''}
          configError={configError}
          previewAriaLabel={`QR code preview for public page ${pathForAnalytics || '/'}`}
          downloadFilenameBase={downloadBase}
          downloadEvent='admin_public_page_qr_downloaded'
          analyticsParams={{
            public_site_path: pathForAnalytics,
            locale,
          }}
        />
      </AdminEditorCard>
    </div>
  );
}
