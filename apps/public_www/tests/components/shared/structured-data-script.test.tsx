import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StructuredDataScript } from '@/components/shared/structured-data-script';

describe('StructuredDataScript', () => {
  it('does not render when structured data is empty', () => {
    const { container } = render(
      <StructuredDataScript id='empty-jsonld' data={{}} />,
    );

    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('renders JSON-LD script when data is provided', () => {
    render(
      <StructuredDataScript
        id='organization-jsonld'
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Evolve Sprouts',
        }}
      />,
    );

    const script = document.getElementById('organization-jsonld');
    expect(script).not.toBeNull();
    expect(script).toHaveAttribute('type', 'application/ld+json');
    expect(script?.textContent).toContain('"@type":"Organization"');
  });
});
