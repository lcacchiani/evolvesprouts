import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EntityServicesSection } from '@/components/admin/contacts/entity-services-section';

describe('EntityServicesSection', () => {
  it('renders nothing when labels are empty', () => {
    const { container } = render(<EntityServicesSection id='crm-test-services' labels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Services summary and one list item per label', () => {
    render(
      <EntityServicesSection
        id='crm-test-services'
        labels={['Event: June Weekend', 'Training course: Course A']}
      />
    );

    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Event: June Weekend')).toBeInTheDocument();
    expect(screen.getByText('Training course: Course A')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
