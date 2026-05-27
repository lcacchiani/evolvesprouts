import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import WorkshopFoodJun26PollPage from '@/app/polls/workshop-food-jun-26/page';

describe('WorkshopFoodJun26PollPage', () => {
  it('renders centered test copy', () => {
    render(<WorkshopFoodJun26PollPage />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
