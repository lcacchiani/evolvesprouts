import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoogleTagManager } from '@/components/shared/google-tag-manager';

const GTM_SCRIPT_SELECTOR = 'script[src="/scripts/init-gtm.js"]';

describe('GoogleTagManager', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.querySelectorAll(GTM_SCRIPT_SELECTOR).forEach((el) => el.remove());
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
});
