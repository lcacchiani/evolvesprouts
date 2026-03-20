import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('always applies min-width reset class', () => {
    render(<Input aria-label='Generic input' />);

    expect(screen.getByLabelText('Generic input')).toHaveClass('min-w-0');
  });

  it('applies WebKit date utility classes only for date inputs', () => {
    const { rerender } = render(<Input aria-label='Date input' type='date' />);
    const dateInput = screen.getByLabelText('Date input');
    const dateClassName = dateInput.getAttribute('class') ?? '';

    expect(dateClassName).toContain('[&::-webkit-calendar-picker-indicator]:ml-0');
    expect(dateClassName).toContain('[&::-webkit-calendar-picker-indicator]:shrink-0');
    expect(dateClassName).toContain('[&::-webkit-datetime-edit-fields-wrapper]:py-0');

    rerender(<Input aria-label='Date input' type='text' />);
    const textClassName = screen.getByLabelText('Date input').getAttribute('class') ?? '';

    expect(textClassName).not.toContain('[&::-webkit-calendar-picker-indicator]:ml-0');
    expect(textClassName).not.toContain('[&::-webkit-calendar-picker-indicator]:shrink-0');
    expect(textClassName).not.toContain('[&::-webkit-datetime-edit-fields-wrapper]:py-0');
  });
});
