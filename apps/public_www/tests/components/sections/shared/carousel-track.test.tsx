import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import enContent from '@/content/en.json';

describe('CarouselTrack', () => {
  it('uses region + carousel roledescription by default', () => {
    render(
      <CarouselTrack ariaLabel='Test track'>
        <span>child</span>
      </CarouselTrack>,
    );

    const track = screen.getByRole('region', { name: 'Test track' });
    expect(track.getAttribute('aria-roledescription')).toBe(
      enContent.common.accessibility.carouselRoleDescription,
    );
  });

  it('uses group without roledescription in presentation mode', () => {
    render(
      <CarouselTrack
        ariaLabel='Options'
        presentation='group'
      >
        <span>child</span>
      </CarouselTrack>,
    );

    const group = screen.getByRole('group', { name: 'Options' });
    expect(group.getAttribute('aria-roledescription')).toBeNull();
  });
});
