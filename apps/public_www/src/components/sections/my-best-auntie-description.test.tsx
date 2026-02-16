/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie-description';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    fill?: boolean;
    priority?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('MyBestAuntieDescription section', () => {
  it('uses course-highlights background properties and left-aligned heading', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntieDescription} />);

    const section = screen.getByRole('region', {
      name: enContent.myBestAuntieDescription.title,
    });
    const sectionStyle = section.getAttribute('style') ?? '';

    expect(section.className).toContain('es-section-bg-overlay');
    expect(sectionStyle).toContain(
      'background-color: var(--figma-colors-frame-2147235259, #FFEEE3)',
    );
    expect(sectionStyle).toContain(
      '--es-section-bg-position: center -900px',
    );
    expect(sectionStyle).toContain('--es-section-bg-size: 2000px auto');
    expect(sectionStyle).toContain(
      '--es-section-bg-filter: sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)',
    );
    expect(sectionStyle).toContain(
      '--es-section-bg-mask-image: linear-gradient(to bottom, black 5%, transparent 15%)',
    );

    const title = screen.getByRole('heading', {
      level: 2,
      name: enContent.myBestAuntieDescription.title,
    });
    const titleWrapperClassName = title.parentElement?.className ?? '';

    expect(titleWrapperClassName).toContain('text-left');
    expect(titleWrapperClassName).not.toContain('text-center');
  });
});
