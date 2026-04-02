import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FreeGuidesAndResourcesLibrary } from '@/components/sections/free-guides-and-resources-library';
import enContent from '@/content/en.json';
import { formatContentTemplate } from '@/content/content-field-utils';
import { clearCrmApiGetCacheForTests } from '@/lib/crm-api-client';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/shared/turnstile-captcha', () => ({
  TurnstileCaptcha: () => null,
}));

const sampleApiItems = [
  {
    title: 'Patience Guide',
    description: 'Gentle strategies about patience for parents.',
    asset_type: 'guide',
    resource_key: 'patience-free-guide',
    content_language: 'en',
    updated_at: null,
  },
  {
    title: 'Helper PDF Pack',
    description: 'Printable tips for helpers.',
    asset_type: 'pdf',
    resource_key: null,
    content_language: 'zh-HK',
    updated_at: null,
  },
];

function mockFetchJsonResponse(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    }),
  );
}

describe('FreeGuidesAndResourcesLibrary', () => {
  const content = enContent.freeGuidesAndResources.library;
  const mediaFormContent = enContent.resources;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/www');
    vi.stubEnv('NEXT_PUBLIC_WWW_CRM_API_KEY', 'test-key');
    clearCrmApiGetCacheForTests();
    mockFetchJsonResponse({ items: sampleApiItems, next_cursor: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fetches free assets and renders cards with section shell identifiers', async () => {
    const { container } = render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    expect(screen.getByText(content.loadingLabel)).toBeInTheDocument();
    const loadingGear = screen.getByTestId('free-guides-library-loading-gear');
    expect(loadingGear).toHaveClass('animate-spin');

    await waitFor(() => {
      expect(screen.queryByText(content.loadingLabel)).not.toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/assets/free?'),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
        }),
      }),
    );

    const section = container.querySelector(
      'section[data-figma-node="free-guides-and-resources-library"]',
    );
    expect(section).not.toBeNull();
    expect(section?.id).toBe('free-guides-and-resources-library');
    expect(section?.className).toContain(
      'es-free-guides-and-resources-library-section',
    );
    expect(
      container.querySelector('.es-course-highlights-overlay'),
    ).not.toBeNull();

    expect(
      screen.getByRole('heading', { name: 'Patience Guide' }),
    ).toBeInTheDocument();
    expect(screen.getByText(sampleApiItems[1].description)).toBeInTheDocument();

    const enFlag = content.languageFlags.find((f) => f.id === 'en');
    if (!enFlag) {
      throw new Error('Expected en language flag');
    }
    const enCardFlag = screen.getByRole('img', {
      name: formatContentTemplate(content.flagAltTemplate, {
        label: enFlag.altLabel,
      }),
    });
    expect(enCardFlag).toHaveAttribute('src', enFlag.flagSrc);
  });

  it('renders MediaForm CTA when resource_key is set', async () => {
    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Get Patience Guide' }),
      ).toBeInTheDocument();
    });
  });

  it('disables CTA when resource_key is missing', async () => {
    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Helper PDF Pack' }),
      ).toBeInTheDocument();
    });

    const disabled = screen.getByRole('button', {
      name: content.unavailableCtaLabel,
    });
    expect(disabled).toBeDisabled();
  });

  it('filters by search on title and description', async () => {
    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Patience Guide' }),
      ).toBeInTheDocument();
    });

    const search = screen.getByRole('textbox', {
      name: content.searchPlaceholder,
    });

    fireEvent.change(search, { target: { value: 'patience' } });
    expect(
      screen.getByRole('heading', { name: 'Patience Guide' }),
    ).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'xyznonexistent123' } });
    expect(screen.getByText(content.emptySearchResultsLabel)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Patience Guide' }),
    ).not.toBeInTheDocument();
  });

  it('shows load error when the API client cannot be created', async () => {
    vi.stubEnv('NEXT_PUBLIC_WWW_CRM_API_KEY', '');
    clearCrmApiGetCacheForTests();

    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(content.loadErrorLabel)).toBeInTheDocument();
    });
  });

  it('follows next_cursor and merges pages', async () => {
    const secondItem = {
      title: 'Second Page Guide',
      description: 'From page two.',
      asset_type: 'guide',
      resource_key: null,
      content_language: 'en',
      updated_at: null,
    };
    const pageTwoCursor =
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    let callIndex = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        callIndex += 1;
        if (callIndex === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                items: [sampleApiItems[0]],
                next_cursor: pageTwoCursor,
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              items: [secondItem],
              next_cursor: null,
            }),
        });
      }),
    );

    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Second Page Guide' }),
      ).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]),
    ).toContain(`cursor=${encodeURIComponent(pageTwoCursor)}`);
  });

  it('shows load error when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network failure')),
    );

    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(content.loadErrorLabel)).toBeInTheDocument();
    });
  });

  it('shows empty API message when the list is empty', async () => {
    mockFetchJsonResponse({ items: [], next_cursor: null });

    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(content.emptyApiLabel)).toBeInTheDocument();
    });
  });

  it('exposes aria-live on the dynamic results region', async () => {
    const { container } = render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Patience Guide' }),
      ).toBeInTheDocument();
    });
  });
});
