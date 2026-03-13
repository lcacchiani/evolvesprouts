import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie/my-best-auntie-description';
import enContent from '@/content/en.json';

describe('MyBestAuntieDescription section', () => {
  it('uses migrated section background class and left-aligned heading', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntie.description} />);

    const section = screen.getByRole('region', {
      name: enContent.myBestAuntie.description.title,
    });

    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-my-best-auntie-description-section');

    const title = screen.getByRole('heading', {
      level: 2,
      name: enContent.myBestAuntie.description.title,
    });
    const titleWrapperClassName = title.parentElement?.className ?? '';

    expect(titleWrapperClassName).toContain('text-left');
    expect(titleWrapperClassName).not.toContain('text-center');
  });

  it('keeps controls in the same header row as the title', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntie.description} />);

    const header = screen.getByTestId('my-best-auntie-description-header');
    const controls = screen.getByTestId('my-best-auntie-description-controls');

    expect(header.className).toContain('md:flex-row');
    expect(header.className).toContain('md:items-end');
    expect(controls.parentElement).toBe(header);
    expect(controls.className).toContain('hidden');
    expect(controls.className).toContain('md:flex');
  });

  it('uses fixed 3-up desktop card sizing with start snap', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntie.description} />);

    const firstCardTitle = enContent.myBestAuntie.description.items[0]?.title;
    expect(firstCardTitle).toBeDefined();

    const firstCardHeading = screen.getByRole('heading', {
      level: 3,
      name: firstCardTitle,
    });
    const firstCardListItem = firstCardHeading.closest('li');

    expect(firstCardListItem).not.toBeNull();
    expect(firstCardListItem?.className).toContain('md:w-[calc((100%-3rem)/3)]');
    expect(firstCardListItem?.className).toContain('md:snap-start');
  });

  it('renders highlight cards without box shadow', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntie.description} />);

    const cardHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(cardHeadings).toHaveLength(enContent.myBestAuntie.description.items.length);
    expect(
      screen.queryByRole('link', {
        name: enContent.myBestAuntie.description.items[0]?.ctaLabel,
      }),
    ).not.toBeInTheDocument();

    const firstCardTitle = enContent.myBestAuntie.description.items[0]?.title;
    expect(firstCardTitle).toBeDefined();

    const cardHeading = screen.getByRole('heading', {
      level: 3,
      name: firstCardTitle,
    });
    const cardArticle = cardHeading.closest('article');

    expect(cardArticle?.className).toContain('es-my-best-auntie-description-card');
    expect(cardArticle?.getAttribute('style')).toBeNull();
    expect(cardHeading.className).toContain('es-my-best-auntie-description-card-title');

    const cardBody = cardArticle?.querySelector('p');
    expect(cardBody?.className).toContain('es-my-best-auntie-description-card-description');
    expect(
      screen.getByRole('link', { name: enContent.myBestAuntie.description.ctaLabel }),
    ).toHaveAttribute('href', enContent.myBestAuntie.description.ctaHref);
  });

  it('applies icon masks and repeats green-blue-red tones', () => {
    const { container } = render(
      <MyBestAuntieDescription content={enContent.myBestAuntie.description} />,
    );

    const icons = container.querySelectorAll('.es-my-best-auntie-description-icon');
    expect(icons).toHaveLength(enContent.myBestAuntie.description.items.length);

    const expectedMaskClasses = [
      'es-my-best-auntie-description-icon--training',
      'es-my-best-auntie-description-icon--coaching',
      'es-my-best-auntie-description-icon--call',
      'es-my-best-auntie-description-icon--community',
      'es-my-best-auntie-description-icon--toolbox',
      'es-my-best-auntie-description-icon--support',
      'es-my-best-auntie-description-icon--review',
      'es-my-best-auntie-description-icon--graduation',
    ];
    const expectedToneClasses = [
      'es-my-best-auntie-description-icon-tone--green',
      'es-my-best-auntie-description-icon-tone--blue',
      'es-my-best-auntie-description-icon-tone--red',
      'es-my-best-auntie-description-icon-tone--green',
      'es-my-best-auntie-description-icon-tone--blue',
      'es-my-best-auntie-description-icon-tone--red',
      'es-my-best-auntie-description-icon-tone--green',
      'es-my-best-auntie-description-icon-tone--blue',
    ];

    icons.forEach((icon, index) => {
      expect(icon.className).toContain(expectedMaskClasses[index]);
      expect(icon.className).toContain(expectedToneClasses[index]);
    });
  });
});
