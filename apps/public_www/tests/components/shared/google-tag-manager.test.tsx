import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoogleTagManager } from '@/components/shared/google-tag-manager';

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const CURRENT_DIRECTORY = path.dirname(CURRENT_FILE_PATH);
const GTM_SCRIPT_SELECTOR = 'script[src="/scripts/init-gtm.js"]';
const GTM_REMOTE_SCRIPT_SELECTOR =
  'script[src^="https://www.googletagmanager.com/gtm.js?id="]';
const GTM_INIT_SCRIPT_SOURCE = readFileSync(
  path.resolve(CURRENT_DIRECTORY, '../../../public/scripts/init-gtm.js'),
  'utf8',
);

function runInitGtmScript(): void {
  window.eval(GTM_INIT_SCRIPT_SOURCE);
}

describe('GoogleTagManager', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.querySelectorAll(GTM_SCRIPT_SELECTOR).forEach((el) => el.remove());
    document.querySelectorAll(GTM_REMOTE_SCRIPT_SELECTOR).forEach((el) => el.remove());
    document.documentElement.removeAttribute('data-gtm-id');
    document.documentElement.removeAttribute('data-gtm-allowed-hosts');
    (window as { dataLayer?: unknown[] }).dataLayer = undefined;
  });

  it('renders a script tag when NEXT_PUBLIC_GTM_ID is set', () => {
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', 'GTM-TEST123');

    render(<GoogleTagManager />);

    expect(document.querySelector(GTM_SCRIPT_SELECTOR)).not.toBeNull();
  });

  it('renders nothing when NEXT_PUBLIC_GTM_ID is empty', () => {
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', '');

    const { container } = render(<GoogleTagManager />);

    expect(container.innerHTML).toBe('');
    expect(document.querySelector(GTM_SCRIPT_SELECTOR)).toBeNull();
  });

  it('renders nothing when NEXT_PUBLIC_GTM_ID is undefined', () => {
    delete process.env.NEXT_PUBLIC_GTM_ID;

    const { container } = render(<GoogleTagManager />);

    expect(container.innerHTML).toBe('');
    expect(document.querySelector(GTM_SCRIPT_SELECTOR)).toBeNull();
  });

  it('injects the GTM runtime script when current host is allowlisted', () => {
    document.documentElement.setAttribute('data-gtm-id', 'GTM-TEST123');
    document.documentElement.setAttribute(
      'data-gtm-allowed-hosts',
      'localhost, www.example.com',
    );

    runInitGtmScript();

    expect(document.querySelector(GTM_REMOTE_SCRIPT_SELECTOR)).not.toBeNull();
    expect(Array.isArray((window as { dataLayer?: unknown[] }).dataLayer)).toBe(true);
  });

  it('does not inject GTM runtime script when current host is not allowlisted', () => {
    document.documentElement.setAttribute('data-gtm-id', 'GTM-TEST123');
    document.documentElement.setAttribute('data-gtm-allowed-hosts', 'www.example.com');

    runInitGtmScript();

    expect(document.querySelector(GTM_REMOTE_SCRIPT_SELECTOR)).toBeNull();
  });

  it('does not inject GTM runtime script when allowlist is missing', () => {
    document.documentElement.setAttribute('data-gtm-id', 'GTM-TEST123');

    runInitGtmScript();

    expect(document.querySelector(GTM_REMOTE_SCRIPT_SELECTOR)).toBeNull();
  });
});
