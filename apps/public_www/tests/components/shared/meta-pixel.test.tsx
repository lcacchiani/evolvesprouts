import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MetaPixel } from '@/components/shared/meta-pixel';

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const CURRENT_DIRECTORY = path.dirname(CURRENT_FILE_PATH);
const META_PIXEL_SCRIPT_SELECTOR = 'script[src="/scripts/init-meta-pixel.js"]';
const META_PIXEL_REMOTE_SCRIPT_SELECTOR =
  'script[src="https://connect.facebook.net/en_US/fbevents.js"]';
const META_PIXEL_INIT_SCRIPT_SOURCE = readFileSync(
  path.resolve(CURRENT_DIRECTORY, '../../../public/scripts/init-meta-pixel.js'),
  'utf8',
);

function runInitMetaPixelScript(): void {
  window.eval(META_PIXEL_INIT_SCRIPT_SOURCE);
}

describe('MetaPixel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.querySelectorAll(META_PIXEL_SCRIPT_SELECTOR).forEach((el) => el.remove());
    document
      .querySelectorAll(META_PIXEL_REMOTE_SCRIPT_SELECTOR)
      .forEach((el) => el.remove());
    document.documentElement.removeAttribute('data-meta-pixel-id');
    document.documentElement.removeAttribute('data-meta-pixel-allowed-hosts');
    delete (window as Record<string, unknown>).fbq;
    delete (window as Record<string, unknown>)._fbq;
  });

  it('renders a script tag when NEXT_PUBLIC_META_PIXEL_ID is set', () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '123456789');

    render(<MetaPixel />);

    expect(document.querySelector(META_PIXEL_SCRIPT_SELECTOR)).not.toBeNull();
  });

  it('renders nothing when NEXT_PUBLIC_META_PIXEL_ID is empty', () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '');

    const { container } = render(<MetaPixel />);

    expect(container.innerHTML).toBe('');
    expect(document.querySelector(META_PIXEL_SCRIPT_SELECTOR)).toBeNull();
  });

  it('renders nothing when NEXT_PUBLIC_META_PIXEL_ID is undefined', () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;

    const { container } = render(<MetaPixel />);

    expect(container.innerHTML).toBe('');
    expect(document.querySelector(META_PIXEL_SCRIPT_SELECTOR)).toBeNull();
  });

  it('injects the fbevents.js script when current host is allowlisted', () => {
    document.documentElement.setAttribute('data-meta-pixel-id', '123456789');
    document.documentElement.setAttribute(
      'data-meta-pixel-allowed-hosts',
      'localhost, www.example.com',
    );

    runInitMetaPixelScript();

    expect(document.querySelector(META_PIXEL_REMOTE_SCRIPT_SELECTOR)).not.toBeNull();
    expect(typeof (window as Record<string, unknown>).fbq).toBe('function');
  });

  it('does not inject fbevents.js when current host is not allowlisted', () => {
    document.documentElement.setAttribute('data-meta-pixel-id', '123456789');
    document.documentElement.setAttribute(
      'data-meta-pixel-allowed-hosts',
      'www.example.com',
    );

    runInitMetaPixelScript();

    expect(document.querySelector(META_PIXEL_REMOTE_SCRIPT_SELECTOR)).toBeNull();
  });

  it('does not inject fbevents.js when allowlist is missing', () => {
    document.documentElement.setAttribute('data-meta-pixel-id', '123456789');

    runInitMetaPixelScript();

    expect(document.querySelector(META_PIXEL_REMOTE_SCRIPT_SELECTOR)).toBeNull();
  });

  it('does not inject fbevents.js when pixel ID is non-numeric', () => {
    document.documentElement.setAttribute('data-meta-pixel-id', 'abc');
    document.documentElement.setAttribute(
      'data-meta-pixel-allowed-hosts',
      'localhost',
    );

    runInitMetaPixelScript();

    expect(document.querySelector(META_PIXEL_REMOTE_SCRIPT_SELECTOR)).toBeNull();
  });

  it('calls fbq init and PageView when loaded', () => {
    document.documentElement.setAttribute('data-meta-pixel-id', '123456789');
    document.documentElement.setAttribute(
      'data-meta-pixel-allowed-hosts',
      'localhost',
    );

    runInitMetaPixelScript();

    const fbq = (window as Record<string, unknown>).fbq as { queue: unknown[][] };
    const queueAsArrays = fbq.queue.map((item) => Array.from(item));
    expect(queueAsArrays).toEqual(
      expect.arrayContaining([
        ['init', '123456789'],
        ['track', 'PageView'],
      ]),
    );
  });
});
