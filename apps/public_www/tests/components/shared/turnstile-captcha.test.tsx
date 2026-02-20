import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';

const TURNSTILE_SCRIPT_ID = 'evolve-sprouts-turnstile-script';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function appendExistingTurnstileScript(src?: string): HTMLScriptElement {
  const scriptElement = document.createElement('script');
  scriptElement.id = TURNSTILE_SCRIPT_ID;
  if (src) {
    scriptElement.setAttribute('src', src);
  }
  document.head.append(scriptElement);
  return scriptElement;
}

afterEach(() => {
  document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
  window.turnstile = undefined;
  window.__evolveSproutsTurnstileLoaderPromise = undefined;
});

describe('TurnstileCaptcha script loading', () => {
  it('sets default script src when an existing script has no src', async () => {
    const existingScriptElement = appendExistingTurnstileScript();
    const onTokenChange = vi.fn();
    const onLoadError = vi.fn();
    const turnstileRender = vi.fn(() => 'test-widget-id');
    const turnstileRemove = vi.fn();

    const { unmount } = render(
      <TurnstileCaptcha
        siteKey='test-site-key'
        onTokenChange={onTokenChange}
        onLoadError={onLoadError}
      />,
    );

    await waitFor(() => {
      expect(existingScriptElement.getAttribute('src')).toBe(TURNSTILE_SCRIPT_SRC);
    });

    window.turnstile = {
      render: turnstileRender,
      remove: turnstileRemove,
    };
    fireEvent.load(existingScriptElement);

    await waitFor(() => {
      expect(turnstileRender).toHaveBeenCalledTimes(1);
    });

    expect(onLoadError).not.toHaveBeenCalled();

    unmount();

    expect(turnstileRemove).toHaveBeenCalledWith('test-widget-id');
  });

  it('does not overwrite an existing explicit script src', async () => {
    const explicitSource = 'https://example.com/custom-turnstile-loader.js';
    const existingScriptElement = appendExistingTurnstileScript(explicitSource);
    const onTokenChange = vi.fn();
    const onLoadError = vi.fn();

    render(
      <TurnstileCaptcha
        siteKey='test-site-key'
        onTokenChange={onTokenChange}
        onLoadError={onLoadError}
      />,
    );

    await waitFor(() => {
      expect(existingScriptElement.getAttribute('src')).toBe(explicitSource);
    });

    fireEvent.error(existingScriptElement);

    await waitFor(() => {
      expect(onLoadError).toHaveBeenCalled();
    });
  });
});
