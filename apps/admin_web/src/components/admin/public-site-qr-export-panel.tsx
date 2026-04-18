'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  trackAdminAnalyticsEvent,
  type AdminAnalyticsEventName,
  type AdminAnalyticsEventParams,
} from '@/lib/admin-analytics';
import { generateReferralQrPngDataUrl } from '@/lib/qr-code-image';

export interface PublicSiteQrFieldIds {
  includeLogo: string;
  applyBranding: string;
  previewUrl: string;
}

const DEFAULT_PUBLIC_SITE_QR_FIELD_IDS: PublicSiteQrFieldIds = {
  includeLogo: 'public-site-qr-include-logo',
  applyBranding: 'public-site-qr-apply-branding',
  previewUrl: 'public-site-qr-preview-url',
};

export interface PublicSiteQrExportPanelProps {
  builtUrl: string;
  configError: string;
  previewAriaLabel: string;
  /** Downloaded file base: `{downloadFilenameBase}-512.png`. */
  downloadFilenameBase: string;
  downloadEvent?: AdminAnalyticsEventName;
  analyticsParams?: AdminAnalyticsEventParams;
  /** Override default `public-site-qr-*` control ids (for example referral dialog). */
  fieldIds?: Partial<PublicSiteQrFieldIds>;
}

export function PublicSiteQrExportPanel({
  builtUrl,
  configError,
  previewAriaLabel,
  downloadFilenameBase,
  downloadEvent,
  analyticsParams,
  fieldIds: fieldIdsProp,
}: PublicSiteQrExportPanelProps) {
  const fieldIds = { ...DEFAULT_PUBLIC_SITE_QR_FIELD_IDS, ...fieldIdsProp };
  const [includeLogoInQr, setIncludeLogoInQr] = useState(true);
  const [applyBranding, setApplyBranding] = useState(true);
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!builtUrl) {
        setPreviewDataUrl('');
        setRenderError('');
        setIsRenderingPreview(false);
        return;
      }
      setIsRenderingPreview(true);
      setRenderError('');
      const logoSrc = includeLogoInQr ? `${window.location.origin}/evolvesprouts-logo.svg` : '';
      void generateReferralQrPngDataUrl({
        url: builtUrl,
        size: 220,
        logoSrc,
        applyBranding,
      })
        .then((dataUrl) => {
          if (!cancelled) {
            setPreviewDataUrl(dataUrl);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRenderError('Could not render QR preview.');
            setPreviewDataUrl('');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsRenderingPreview(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [applyBranding, builtUrl, includeLogoInQr]);

  async function downloadPng(size: number) {
    if (!builtUrl) {
      return;
    }
    const logoSrc = includeLogoInQr ? `${window.location.origin}/evolvesprouts-logo.svg` : '';
    const dataUrl = await generateReferralQrPngDataUrl({
      url: builtUrl,
      size,
      logoSrc,
      applyBranding,
    });
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${downloadFilenameBase}-${size}.png`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    if (downloadEvent) {
      trackAdminAnalyticsEvent(downloadEvent, {
        ...analyticsParams,
        png_size_px: size,
      });
    }
  }

  return (
    <div className='space-y-4' aria-label='Public site QR configuration and preview'>
      {configError ? <p className='text-sm text-red-600'>{configError}</p> : null}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <input
                id={fieldIds.includeLogo}
                type='checkbox'
                className='h-4 w-4 rounded border-slate-300 text-slate-900'
                checked={includeLogoInQr}
                onChange={(event) => setIncludeLogoInQr(event.target.checked)}
                disabled={Boolean(configError)}
              />
              <Label htmlFor={fieldIds.includeLogo} className='mb-0 cursor-pointer font-normal'>
                Include logo in QR code
              </Label>
            </div>
            <div className='flex items-center gap-2'>
              <input
                id={fieldIds.applyBranding}
                type='checkbox'
                className='h-4 w-4 rounded border-slate-300 text-slate-900'
                checked={applyBranding}
                onChange={(event) => setApplyBranding(event.target.checked)}
                disabled={Boolean(configError)}
              />
              <Label htmlFor={fieldIds.applyBranding} className='mb-0 cursor-pointer font-normal'>
                Apply branding
              </Label>
            </div>
          </div>
        </div>
      </div>
      <div className='space-y-2'>
        <Label htmlFor={fieldIds.previewUrl}>Preview URL</Label>
        {builtUrl ? (
          <a
            id={fieldIds.previewUrl}
            href={builtUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='block max-w-full break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 underline decoration-slate-400 underline-offset-2 hover:text-slate-950'
          >
            {builtUrl}
          </a>
        ) : (
          <p
            id={fieldIds.previewUrl}
            className='block max-w-full break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-500'
          >
            —
          </p>
        )}
      </div>
      <div className='space-y-2'>
        <Label>QR preview</Label>
        <div
          className='flex justify-center rounded border border-slate-200 bg-white p-4'
          aria-label={previewAriaLabel}
        >
          {isRenderingPreview ? (
            <p className='text-sm text-slate-500'>Rendering…</p>
          ) : previewDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL preview from canvas
            <img src={previewDataUrl} alt='' className='h-44 w-44' width={176} height={176} />
          ) : (
            <p className='text-sm text-slate-500'>{renderError || 'Preview unavailable'}</p>
          )}
        </div>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          disabled={!builtUrl}
          onClick={() => void downloadPng(512)}
        >
          Download PNG (512)
        </Button>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          disabled={!builtUrl}
          onClick={() => void downloadPng(1024)}
        >
          Download PNG (1024)
        </Button>
      </div>
    </div>
  );
}
