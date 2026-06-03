import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormScrollSurvey } from '@/components/forms/form-scroll-survey';
import { FORMS_COMMON, getFormContent } from '@/lib/forms';

const form = getFormContent('workshop-exit-feedback');

describe('FormScrollSurvey', () => {
  it('renders scroll survey questions and disables submit until required answers', () => {
    if (!form) {
      throw new Error('Expected workshop-exit-feedback form');
    }

    render(<FormScrollSurvey form={form} common={FORMS_COMMON} />);

    expect(screen.getByText(/Two minutes of honesty/)).toBeInTheDocument();
    expect(screen.getByText(/How useful was this morning/)).toBeInTheDocument();
    expect(screen.getByText(/What was most useful/)).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: FORMS_COMMON.scroll.submitLabel });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'Loved it' }));
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(submit).not.toBeDisabled();
  });

  it('locks multiselect chips after max selections', () => {
    if (!form) {
      throw new Error('Expected workshop-exit-feedback form');
    }

    render(<FormScrollSurvey form={form} common={FORMS_COMMON} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mealtime scripts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practical tips' }));
    fireEvent.click(screen.getByRole('button', { name: 'Helper alignment' }));

    expect(
      screen.getByRole('button', { name: /The balanced plate \(maximum selections reached\)/ }),
    ).toBeDisabled();
  });
});
