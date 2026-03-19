import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FaqCardGrid } from '@/components/sections/shared/faq-card-grid';

describe('FaqCardGrid', () => {
  it('renders each question and answer as a card article', () => {
    const items = [
      {
        question: 'How does this work?',
        answer: 'You choose a session and complete a short form.',
      },
      {
        question: 'Can I reschedule?',
        answer: 'Yes, message us at least 24 hours in advance.',
      },
    ];

    const { container } = render(<FaqCardGrid items={items} />);

    expect(screen.getByRole('heading', { name: items[0].question })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: items[1].question })).toBeInTheDocument();
    expect(screen.getByText(items[0].answer)).toBeInTheDocument();
    expect(screen.getByText(items[1].answer)).toBeInTheDocument();
    expect(container.querySelectorAll('article')).toHaveLength(items.length);

    for (const item of items) {
      const answer = screen.getByText(item.answer);
      const answerWrapper = answer.closest('div');
      expect(answerWrapper).not.toBeNull();
      expect(answerWrapper?.className).toContain('border-l-[4.1px]');
      expect(answerWrapper?.className).toContain('es-divider-green');
    }
  });
});
