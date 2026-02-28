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

    expect(
      screen.getByRole('heading', { name: 'Thanks for reaching out!' }),
    ).toBeInTheDocument();
    expect(screen.getByText('We will reply shortly.')).toBeInTheDocument();
  });
});
