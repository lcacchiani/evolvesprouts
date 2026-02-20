import { useEffect, useMemo, useRef } from 'react';

import { mergeClassNames } from '@/lib/class-name-utils';

type TurnstileTheme = 'light' | 'dark' | 'auto';
type TurnstileSize = 'normal' | 'compact' | 'flexible';
type TurnstileExecutionMode = 'render' | 'execute';
type TurnstileAppearanceMode = 'always' | 'execute' | 'interaction-only';
type TurnstileRetryMode = 'auto' | 'never';
type TurnstileRefreshMode = 'auto' | 'manual' | 'never';

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  theme?: TurnstileTheme;
  size?: TurnstileSize;
  execution?: TurnstileExecutionMode;
  appearance?: TurnstileAppearanceMode;
  retry?: TurnstileRetryMode;
  'retry-interval'?: number;
  'refresh-expired'?: TurnstileRefreshMode;
  'refresh-timeout'?: TurnstileRefreshMode;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (errorCode?: string) => void;
  'timeout-callback'?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __evolveSproutsTurnstileLoaderPromise?: Promise<void>;
  }
}

const TURNSTILE_SCRIPT_ID = 'evolve-sprouts-turnstile-script';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_WIDGET_APPEARANCE: TurnstileAppearanceMode = 'interaction-only';
const TURNSTILE_WIDGET_RETRY_MODE: TurnstileRetryMode = 'never';
const TURNSTILE_WIDGET_REFRESH_EXPIRED_MODE: TurnstileRefreshMode = 'manual';
const TURNSTILE_WIDGET_REFRESH_TIMEOUT_MODE: TurnstileRefreshMode = 'manual';

function hasExplicitScriptSource(scriptElement: HTMLScriptElement): boolean {
  const sourceAttribute = scriptElement.getAttribute('src');
  if (typeof sourceAttribute !== 'string') {
    return false;
  }

  const normalizedSource = sourceAttribute.trim();
  if (normalizedSource === '') {
    return false;
  }

  try {
    const resolvedSource = new URL(normalizedSource, window.location.href);
    return resolvedSource.protocol === 'http:' || resolvedSource.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveTurnstileReady(
  resolve: () => void,
  reject: (error: Error) => void,
): () => void {
  return () => {
    if (window.turnstile) {
      resolve();
      return;
    }

    reject(new Error('Turnstile script loaded without API'));
  };
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (window.__evolveSproutsTurnstileLoaderPromise) {
    return window.__evolveSproutsTurnstileLoaderPromise;
  }

  window.__evolveSproutsTurnstileLoaderPromise = new Promise<void>((resolve, reject) => {
    const existingScriptElement = document.getElementById(
      TURNSTILE_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const handleLoad = resolveTurnstileReady(resolve, reject);
    const handleError = () => {
      reject(new Error('Failed to load Turnstile script'));
    };

    if (existingScriptElement) {
      if (!hasExplicitScriptSource(existingScriptElement)) {
        existingScriptElement.src = TURNSTILE_SCRIPT_SRC;
      }
      existingScriptElement.async = true;
      existingScriptElement.defer = true;

      if (existingScriptElement.dataset.loaded === 'true') {
        handleLoad();
        return;
      }

      existingScriptElement.addEventListener('load', handleLoad, {
        once: true,
      });
      existingScriptElement.addEventListener('error', handleError, {
        once: true,
      });
      return;
    }

    const scriptElement = document.createElement('script');
    scriptElement.id = TURNSTILE_SCRIPT_ID;
    scriptElement.src = TURNSTILE_SCRIPT_SRC;
    scriptElement.async = true;
    scriptElement.defer = true;
    scriptElement.addEventListener(
      'load',
      () => {
        scriptElement.dataset.loaded = 'true';
        handleLoad();
      },
      { once: true },
    );
    scriptElement.addEventListener('error', handleError, { once: true });

    document.head.append(scriptElement);
  }).catch((error) => {
    window.__evolveSproutsTurnstileLoaderPromise = undefined;
    throw error;
  });

  return window.__evolveSproutsTurnstileLoaderPromise;
}

export interface TurnstileCaptchaProps {
  siteKey: string;
  className?: string;
  theme?: TurnstileTheme;
  size?: TurnstileSize;
  widgetAction?: string;
  onTokenChange: (token: string | null) => void;
  onLoadError: () => void;
}

export function TurnstileCaptcha({
  siteKey,
  className,
  theme = 'auto',
  size = 'flexible',
  widgetAction,
  onTokenChange,
  onLoadError,
}: TurnstileCaptchaProps) {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onLoadErrorRef = useRef(onLoadError);
  const normalizedSiteKey = useMemo(() => siteKey.trim(), [siteKey]);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  useEffect(() => {
    let isDisposed = false;

    if (!normalizedSiteKey) {
      onTokenChangeRef.current(null);
      onLoadErrorRef.current();
      return () => {
        isDisposed = true;
      };
    }

    onTokenChangeRef.current(null);

    loadTurnstileScript()
      .then(() => {
        if (isDisposed) {
          return;
        }

        const widgetContainer = widgetContainerRef.current;
        const turnstileApi = window.turnstile;
        if (!widgetContainer || !turnstileApi) {
          onTokenChangeRef.current(null);
          onLoadErrorRef.current();
          return;
        }

        widgetContainer.replaceChildren();
        widgetIdRef.current = turnstileApi.render(widgetContainer, {
          sitekey: normalizedSiteKey,
          action: widgetAction,
          theme,
          size,
          appearance: TURNSTILE_WIDGET_APPEARANCE,
          retry: TURNSTILE_WIDGET_RETRY_MODE,
          'refresh-expired': TURNSTILE_WIDGET_REFRESH_EXPIRED_MODE,
          'refresh-timeout': TURNSTILE_WIDGET_REFRESH_TIMEOUT_MODE,
          callback: (token) => {
            onTokenChangeRef.current(token);
          },
          'expired-callback': () => {
            onTokenChangeRef.current(null);
          },
          'timeout-callback': () => {
            onTokenChangeRef.current(null);
          },
          'error-callback': (_errorCode) => {
            // Runtime challenge warnings can be transient (for example PAT 401s).
            // Keep the widget recoverable instead of hard-disabling the form.
            onTokenChangeRef.current(null);
          },
        });
      })
      .catch(() => {
        if (!isDisposed) {
          onTokenChangeRef.current(null);
          onLoadErrorRef.current();
        }
      });

    return () => {
      isDisposed = true;
      if (typeof window === 'undefined') {
        return;
      }

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [
    normalizedSiteKey,
    size,
    theme,
    widgetAction,
  ]);

  return (
    <div
      ref={widgetContainerRef}
      className={mergeClassNames('min-h-[65px]', className)}
      data-testid='turnstile-captcha'
    />
  );
}
