import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ExternalLinkIcon,
  ExternalLinkInlineContent,
} from '@/components/shared/external-link-icon';

describe('ExternalLinkIcon', () => {
  it('applies the base class and preserves custom class names', () => {
    const { container } = render(<ExternalLinkIcon className='extra-icon-class' />);

    const icon = container.querySelector('svg[data-external-link-icon="true"]');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('class')).toContain('es-link-external-icon');
    expect(icon?.getAttribute('class')).toContain('extra-icon-class');
  });
});

describe('ExternalLinkInlineContent', () => {
  it('shows external icon only for external links', () => {
    const { rerender } = render(
      <ExternalLinkInlineContent isExternalHttp>
        Link label
      </ExternalLinkInlineContent>,
    );

    const label = screen.getByText('Link label');
    expect(label.className).toContain('es-link-external-label');
    expect(label.className).toContain('es-link-external-label--with-icon');
    const externalIcon = label.querySelector('svg[data-external-link-icon="true"]');
    expect(externalIcon).not.toBeNull();
    expect(externalIcon?.parentElement).toBe(label);

    rerender(
      <ExternalLinkInlineContent
        isExternalHttp={false}
        internalIcon={<span data-testid='internal-icon'>Internal icon</span>}
      >
        Link label
      </ExternalLinkInlineContent>,
    );

    expect(screen.getByText('Link label').className).toBe('');
    expect(document.querySelector('svg[data-external-link-icon="true"]')).toBeNull();
    expect(screen.getByTestId('internal-icon')).toBeInTheDocument();
  });
});
