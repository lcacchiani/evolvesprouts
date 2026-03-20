import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContactFormSuccess } from '@/components/sections/contact-us-form-success';

describe('ContactFormSuccess', () => {
  it('renders provided success title and description', () => {
    render(
      <ContactFormSuccess
        title='Thanks for reaching out!'
        description='We will reply shortly.'
      />,
    );

    const title = screen.getByRole('heading', { name: 'Thanks for reaching out!' });
    expect(title).toBeInTheDocument();
    expect(screen.getByText('We will reply shortly.')).toBeInTheDocument();

    const successContainer = title.closest('div');
    expect(successContainer).not.toBeNull();
    expect(successContainer?.className).not.toContain('es-bg-surface-muted');
  });
});
