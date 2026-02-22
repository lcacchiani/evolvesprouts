import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoogleTagManager } from '@/components/shared/google-tag-manager';

describe('GoogleTagManager', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a script tag when NEXT_PUBLIC_GTM_ID is set', () => {
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', 'GTM-TEST123');

    const { container } = render(<GoogleTagManager />);
    const script = container.querySelector('script[src="/scripts/init-gtm.js"]');

    expect(script).not.toBeNull();
    expect(script?.getAttribute('async')).toBeDefined();
  });

  it('renders nothing when NEXT_PUBLIC_GTM_ID is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', '');

    const { container } = render(<GoogleTagManager />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when NEXT_PUBLIC_GTM_ID is undefined', () => {
    delete process.env.NEXT_PUBLIC_GTM_ID;

    const { container } = render(<GoogleTagManager />);

    expect(container.innerHTML).toBe('');
  });
});
