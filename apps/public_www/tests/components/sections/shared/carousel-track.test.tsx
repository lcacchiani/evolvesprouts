import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CarouselTrack } from '@/components/sections/shared/carousel-track';

describe('CarouselTrack', () => {
  it('renders with carousel accessibility semantics', () => {
    render(
      <CarouselTrack ariaLabel='Sample carousel' testId='carousel-track'>
        <div>Item</div>
      </CarouselTrack>,
    );

    const track = screen.getByTestId('carousel-track');
    expect(track).toHaveAttribute('role', 'region');
    expect(track).toHaveAttribute('aria-roledescription', 'carousel');
    expect(track).toHaveAttribute('aria-label', 'Sample carousel');
  });

  it('scrolls horizontally while dragging with the primary mouse pointer', () => {
    render(
      <CarouselTrack ariaLabel='Sample carousel' testId='carousel-track'>
        <div>Item</div>
      </CarouselTrack>,
    );

    const track = screen.getByTestId('carousel-track');
    track.scrollLeft = 100;

    fireEvent.pointerDown(track, {
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      clientX: 240,
    });
    fireEvent.pointerMove(track, {
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 200,
    });
    expect(track.scrollLeft).toBe(140);

    fireEvent.pointerUp(track, {
      pointerType: 'mouse',
      pointerId: 1,
    });
    fireEvent.pointerMove(track, {
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 160,
    });
    expect(track.scrollLeft).toBe(140);
  });

  it('ignores dragging with non-primary mouse pointers', () => {
    render(
      <CarouselTrack ariaLabel='Sample carousel' testId='carousel-track'>
        <div>Item</div>
      </CarouselTrack>,
    );

    const track = screen.getByTestId('carousel-track');
    track.scrollLeft = 80;

    fireEvent.pointerDown(track, {
      pointerType: 'mouse',
      pointerId: 1,
      button: 1,
      clientX: 240,
    });
    fireEvent.pointerMove(track, {
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 180,
    });

    expect(track.scrollLeft).toBe(80);
  });

  it('suppresses click events after drag movement', () => {
    const clickSpy = vi.fn();

    render(
      <CarouselTrack ariaLabel='Sample carousel' testId='carousel-track'>
        <button type='button' onClick={clickSpy}>
          Select
        </button>
      </CarouselTrack>,
    );

    const track = screen.getByTestId('carousel-track');
    const button = screen.getByRole('button', { name: 'Select' });

    fireEvent.pointerDown(track, {
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      clientX: 200,
    });
    fireEvent.pointerMove(track, {
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 120,
    });
    fireEvent.pointerUp(track, {
      pointerType: 'mouse',
      pointerId: 1,
    });
    fireEvent.click(button);

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
