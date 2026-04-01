import { fireEvent, render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FreeGuidesAndResourcesLibrary } from '@/components/sections/free-guides-and-resources-library';
import enContent from '@/content/en.json';

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

describe('FreeGuidesAndResourcesLibrary', () => {
  const content = enContent.freeGuidesAndResources.library;
  const mediaFormContent = enContent.resources;
  const firstItem = content.items[0];
  if (!firstItem) {
    throw new Error('Expected at least one library item in en.json');
  }

  it('renders tile grid with items and section shell identifiers', () => {
    const { container } = render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    const section = container.querySelector(
      'section[data-figma-node="free-guides-and-resources-library"]',
    );
    expect(section).not.toBeNull();
    expect(section?.id).toBe('free-guides-and-resources-library');
    expect(section?.className).toContain('es-free-guides-and-resources-library-section');
    expect(
      container.querySelector('.es-course-highlights-overlay'),
    ).not.toBeNull();

    expect(
      screen.getByRole('heading', { name: firstItem.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(firstItem.description)).toBeInTheDocument();
    expect(screen.getByText(firstItem.format)).toBeInTheDocument();

    const cta = screen.getByRole('button', { name: mediaFormContent.ctaLabel });
    expect(cta.className).toContain('es-btn--primary');
    expect(cta.className).toContain('es-btn--outline');
  });

  it('uses anchor CTA for non-guide library items', () => {
    const contentWithExtraItem = {
      ...content,
      items: [
        ...content.items,
        {
          id: 'other-resource',
          title: 'Other downloadable',
          description: 'A different resource.',
          format: 'PDF',
          categoryId: 'parenting-tips',
          ctaLabel: 'Download',
          ctaHref: 'https://example.com/file.pdf',
        },
      ],
    };

    render(
      <FreeGuidesAndResourcesLibrary
        content={contentWithExtraItem}
        mediaFormContent={mediaFormContent}
      />,
    );

    const link = screen.getByRole('link', { name: 'Download' });
    expect(link).toHaveAttribute('href', 'https://example.com/file.pdf');
  });

  it('filters by search on title and description', () => {
    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    const search = screen.getByRole('textbox', {
      name: content.searchPlaceholder,
    });

    fireEvent.change(search, { target: { value: 'patience' } });
    expect(
      screen.getByRole('heading', { name: firstItem.title }),
    ).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'xyznonexistent123' } });
    expect(screen.getByText(content.emptySearchResultsLabel)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: firstItem.title }),
    ).not.toBeInTheDocument();
  });

  it('category pills filter by categoryId and All shows every item', () => {
    render(
      <FreeGuidesAndResourcesLibrary
        content={content}
        mediaFormContent={mediaFormContent}
      />,
    );

    const montessori = content.categories.find((c) => c.id === 'montessori');
    if (!montessori) {
      throw new Error('Expected montessori category');
    }

    fireEvent.click(screen.getByRole('button', { name: montessori.label }));
    expect(screen.getByText(content.emptySearchResultsLabel)).toBeInTheDocument();

    const allLabel = content.categories.find((c) => c.id === 'all');
    if (!allLabel) {
      throw new Error('Expected all category');
    }
    fireEvent.click(screen.getByRole('button', { name: allLabel.label }));
    expect(
      screen.getByRole('heading', { name: firstItem.title }),
    ).toBeInTheDocument();
  });
});
