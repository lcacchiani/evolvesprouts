import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FreeGuidesAndResourcesLibrary } from '@/components/sections/free-guides-and-resources-library';
import enContent from '@/content/en.json';
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
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Patience Guide',
    description: 'Gentle strategies about patience for parents.',
    asset_type: 'guide',
    file_name: 'patience.pdf',
    resource_key: 'patience-free-guide',
    content_language: 'en',
    content_type: 'application/pdf',
    updated_at: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Helper PDF Pack',
    description: 'Printable tips for helpers.',
    asset_type: 'pdf',
    file_name: 'helpers.pdf',
    resource_key: null,
    content_language: 'zh-HK',
    content_type: 'application/pdf',
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

  it('filters by language pills before asset type pills', async () => {
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

    const zhHk = content.languageFilters.find((f) => f.id === 'zh-HK');
    if (!zhHk) {
      throw new Error('Expected zh-HK language filter');
    }
    fireEvent.click(screen.getByRole('button', { name: zhHk.label }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Helper PDF Pack' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('heading', { name: 'Patience Guide' }),
    ).not.toBeInTheDocument();

    const allLang = content.languageFilters.find((f) => f.id === 'all');
    if (!allLang) {
      throw new Error('Expected all languages filter');
    }
    fireEvent.click(screen.getByRole('button', { name: allLang.label }));

    expect(
      screen.getByRole('heading', { name: 'Patience Guide' }),
    ).toBeInTheDocument();
  });

  it('filters by asset type', async () => {
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

    const pdfFilter = content.assetTypeFilters.find((c) => c.id === 'pdf');
    if (!pdfFilter) {
      throw new Error('Expected pdf asset type filter');
    }
    fireEvent.click(screen.getByRole('button', { name: pdfFilter.label }));

    expect(
      screen.queryByRole('heading', { name: 'Patience Guide' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Helper PDF Pack' }),
    ).toBeInTheDocument();
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
      id: '33333333-3333-3333-3333-333333333333',
      title: 'Second Page Guide',
      description: 'From page two.',
      asset_type: 'guide',
      file_name: 'second.pdf',
      resource_key: null,
      content_language: 'en',
      content_type: 'application/pdf',
      updated_at: null,
    };

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
                next_cursor: secondItem.id,
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
    ).toContain(`cursor=${encodeURIComponent(secondItem.id)}`);
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
