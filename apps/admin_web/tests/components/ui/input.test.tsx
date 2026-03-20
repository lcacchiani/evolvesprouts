import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('always applies min-width reset class', () => {
    render(<Input aria-label='Generic input' />);

    expect(screen.getByLabelText('Generic input')).toHaveClass('min-w-0');
  });

  it('applies WebKit picker utility classes and width cap for date and datetime-local inputs', () => {
    const { rerender } = render(<Input aria-label='Date input' type='date' />);
    let el = screen.getByLabelText('Date input');
    let className = el.getAttribute('class') ?? '';

    expect(className).toContain('[&::-webkit-calendar-picker-indicator]:ml-0');
    expect(className).toContain('[&::-webkit-calendar-picker-indicator]:shrink-0');
    expect(className).toContain('[&::-webkit-datetime-edit-fields-wrapper]:py-0');
    expect(className).toContain('max-w-[12rem]');

    rerender(<Input aria-label='Date input' type='datetime-local' />);
    el = screen.getByLabelText('Date input');
    className = el.getAttribute('class') ?? '';
    expect(className).toContain('[&::-webkit-calendar-picker-indicator]:ml-0');
    expect(className).toContain('max-w-[24rem]');

    rerender(<Input aria-label='Date input' type='text' />);
    className = screen.getByLabelText('Date input').getAttribute('class') ?? '';

    expect(className).not.toContain('[&::-webkit-calendar-picker-indicator]:ml-0');
    expect(className).not.toContain('[&::-webkit-calendar-picker-indicator]:shrink-0');
    expect(className).not.toContain('[&::-webkit-datetime-edit-fields-wrapper]:py-0');
    expect(className).not.toContain('max-w-[12rem]');
    expect(className).not.toContain('max-w-[24rem]');
  });
});
