import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';

describe('renderQuotedDescriptionText', () => {
  it('renders straight-quoted text in an es-quote box without quote marks', () => {
    const text = 'Before "quoted phrase" after.';
    const { container } = render(<p>{renderQuotedDescriptionText(text)}</p>);

    const quoteText = screen.getByText('quoted phrase');
    expect(quoteText.className).toContain('es-quote-text');
    const quoteBox = quoteText.closest('.es-quote');
    expect(quoteBox).not.toBeNull();
    expect(container.textContent).not.toContain('"quoted phrase"');
    expect(container.textContent).toContain('Before ');
    expect(container.textContent).toContain('quoted phrase');
    expect(container.textContent).toContain(' after.');
    expect(quoteBox?.querySelector('.es-quote-icon.es-testimonial-quote-icon')).not.toBeNull();
  });

  it('renders typographic quoted text in an es-quote box', () => {
    const { container } = render(<p>{renderQuotedDescriptionText('前文“引用內容”後文。')}</p>);

    const quoteText = screen.getByText('引用內容');
    expect(quoteText.closest('.es-quote')).not.toBeNull();
    expect(container.textContent).not.toContain('“引用內容”');
  });
});
