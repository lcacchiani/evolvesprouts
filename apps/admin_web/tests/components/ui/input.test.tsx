import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('always applies min-width reset class', () => {
    render(<Input aria-label='Generic input' />);

    expect(screen.getByLabelText('Generic input')).toHaveClass('min-w-0');
  });

  it('applies appearance-none and WebKit picker utility classes for date and datetime-local without a fixed max-width', () => {
    const { rerender } = render(<Input aria-label='Date input' type='date' />);
    let el = screen.getByLabelText('Date input');
    let className = el.getAttribute('class') ?? '';

    expect(className).toContain('appearance-none');
    expect(className).toContain('[&::-webkit-date-and-time-value]:min-h-0');
    expect(className).toContain('[&::-webkit-datetime-edit]:p-0');
    expect(className).toContain('[&::-webkit-datetime-edit-fields-wrapper]:p-0');
    expect(className).toContain('[&::-webkit-calendar-picker-indicator]:m-0');
    expect(className).toContain('[&::-webkit-calendar-picker-indicator]:shrink-0');
    expect(className).toContain('[&::-webkit-calendar-picker-indicator]:p-0');
    expect(className).toContain('w-full');
    expect(className).not.toContain('max-w-[12rem]');

    rerender(<Input aria-label='Date input' type='datetime-local' />);
    el = screen.getByLabelText('Date input');
    className = el.getAttribute('class') ?? '';
    expect(className).toContain('appearance-none');
    expect(className).toContain('[&::-webkit-datetime-edit]:p-0');
    expect(className).toContain('[&::-webkit-date-and-time-value]:min-h-0');
    expect(className).toContain('[&::-webkit-calendar-picker-indicator]:m-0');
    expect(className).not.toContain('max-w-[24rem]');

    rerender(<Input aria-label='Date input' type='text' />);
    className = screen.getByLabelText('Date input').getAttribute('class') ?? '';

    expect(className).not.toContain('appearance-none');
    expect(className).not.toContain('[&::-webkit-datetime-edit]:p-0');
    expect(className).not.toContain('[&::-webkit-date-and-time-value]:min-h-0');
    expect(className).not.toContain('[&::-webkit-calendar-picker-indicator]:m-0');
    expect(className).not.toContain('[&::-webkit-calendar-picker-indicator]:shrink-0');
    expect(className).not.toContain('[&::-webkit-datetime-edit-fields-wrapper]:p-0');
    expect(className).not.toContain('max-w-[12rem]');
    expect(className).not.toContain('max-w-[24rem]');
  });
});
