import type { StripeElementsOptions } from '@stripe/stripe-js';

import {
  parseHexColorRgb,
  resolveCssColorToken,
  rgbaFromCssColor,
} from '@/lib/css-token-utils';
import {
  SITE_PRIMARY_FONT_STACK,
  STRIPE_APPEARANCE_CSS_VARS,
  STRIPE_APPEARANCE_FALLBACK_HEX,
} from '@/lib/design-tokens';

export function getStripePaymentElementAppearance(): NonNullable<
  StripeElementsOptions['appearance']
> {
  const primaryRgbFallback = parseHexColorRgb(STRIPE_APPEARANCE_FALLBACK_HEX.brandOrange) ?? {
    r: 200,
    g: 74,
    b: 22,
  };
  const dangerRgbFallback = parseHexColorRgb(
    STRIPE_APPEARANCE_FALLBACK_HEX.textDangerStrong,
  ) ?? {
    r: 180,
    g: 35,
    b: 24,
  };

  const colorPrimary = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.brandOrange,
    STRIPE_APPEARANCE_FALLBACK_HEX.brandOrange,
  );
  const colorBackground = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.surfaceWhite,
    STRIPE_APPEARANCE_FALLBACK_HEX.surfaceWhite,
  );
  const colorBackgroundMuted = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.surfaceMuted,
    STRIPE_APPEARANCE_FALLBACK_HEX.surfaceMuted,
  );
  const colorText = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textHeading,
    STRIPE_APPEARANCE_FALLBACK_HEX.textHeading,
  );
  const colorTextSecondary = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textNeutralStrong,
    STRIPE_APPEARANCE_FALLBACK_HEX.textNeutralStrong,
  );
  const colorTextPlaceholder = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textPlaceholder,
    STRIPE_APPEARANCE_FALLBACK_HEX.textPlaceholder,
  );
  const colorDanger = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textDangerStrong,
    STRIPE_APPEARANCE_FALLBACK_HEX.textDangerStrong,
  );
  const borderInput = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.borderInput,
    STRIPE_APPEARANCE_FALLBACK_HEX.borderInput,
  );

  const focusRingPrimary = rgbaFromCssColor(colorPrimary, 0.55, primaryRgbFallback);
  const focusRingDanger = rgbaFromCssColor(colorDanger, 0.55, dangerRgbFallback);
  const focusRingPrimaryStrong = rgbaFromCssColor(colorPrimary, 0.65, primaryRgbFallback);

  return {
    theme: 'stripe',
    variables: {
      colorPrimary,
      colorBackground,
      colorText,
      colorTextSecondary,
      colorTextPlaceholder,
      colorDanger,
      fontFamily: SITE_PRIMARY_FONT_STACK,
      fontSizeBase: '14px',
      borderRadius: '10px',
      spacingUnit: '4px',
    },
    rules: {
      '.Label': {
        color: colorText,
        fontWeight: '600',
      },
      '.Input': {
        border: `1px solid ${borderInput}`,
        boxShadow: 'none',
        color: colorText,
      },
      '.Input::placeholder': {
        color: colorTextPlaceholder,
      },
      '.Input:focus': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Input:focus-visible': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Input--invalid': {
        borderColor: colorDanger,
        boxShadow: 'none',
      },
      '.Input--invalid:focus': {
        borderColor: colorDanger,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingDanger}`,
      },
      '.Error': {
        color: colorDanger,
      },
      '.Block': {
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
      },
      '.Tab': {
        border: `1px solid ${borderInput}`,
        backgroundColor: colorBackgroundMuted,
        color: colorText,
      },
      '.Tab:hover': {
        backgroundColor: colorBackground,
        color: colorText,
      },
      '.Tab:focus': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Tab:focus-visible': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Tab--selected': {
        backgroundColor: colorBackground,
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 2px ${focusRingPrimaryStrong}`,
        color: colorText,
      },
      '.TabIcon': {
        color: colorTextSecondary,
      },
      '.TabIcon--selected': {
        color: colorPrimary,
      },
    },
  };
}
