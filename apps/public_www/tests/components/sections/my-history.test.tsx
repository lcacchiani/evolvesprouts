/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyHistory } from '@/components/sections/my-history';
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

describe('MyHistory section', () => {
  it('uses shared overlay and section classes for the muted background', () => {
    render(<MyHistory content={enContent.myHistory} />);

    const section = screen.getByRole('region', {
      name: enContent.myHistory.title,
    });

    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-my-history-section');
  });
});
