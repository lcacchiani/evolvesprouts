/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AboutUsIdaCoach } from '@/components/sections/about-us-ida-coach';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('AboutUsIdaCoach section', () => {
  it('renders ida coach content, image, and credential chips', () => {
    render(<AboutUsIdaCoach content={enContent.aboutUs.idaCoach} />);

    const section = document.getElementById('about-us-ida-coach');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('about-us-ida-coach');
    expect(section).toHaveClass('es-section-bg-overlay');
    expect(section).toHaveClass('es-about-us-ida-coach-section');
    expect(screen.getByText(enContent.aboutUs.idaCoach.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: enContent.aboutUs.idaCoach.title }))
      .toBeInTheDocument();
    expect(screen.getByText(enContent.aboutUs.idaCoach.subtitle)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: enContent.aboutUs.idaCoach.imageAlt })).toBeInTheDocument();

    const highlightedText = screen.getByText(enContent.aboutUs.idaCoach.highlightedPhrase);
    expect(highlightedText).toHaveClass('es-about-us-ida-coach-highlight');

    for (const tag of enContent.aboutUs.idaCoach.tags) {
      expect(screen.getByText(tag)).toBeInTheDocument();
    }
  });
});
