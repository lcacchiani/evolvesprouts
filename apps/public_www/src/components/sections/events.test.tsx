import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Events } from '@/components/sections/events';
import enContent from '@/content/en.json';

vi.mock('@/lib/crm-api-client', () => ({
  createCrmApiClient: vi.fn(() => null),
}));

describe('Events section', () => {
  it('does not render the eyebrow label', () => {
    render(<Events content={enContent.events} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: enContent.events.title,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(enContent.events.eyebrow)).not.toBeInTheDocument();
  });
});
