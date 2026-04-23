import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockListAdminTags } = vi.hoisted(() => ({
  mockListAdminTags: vi.fn(),
}));

vi.mock('@/lib/tags-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tags-api')>();
  return {
    ...actual,
    listAdminTags: mockListAdminTags,
  };
});

import { TagsPage } from '@/components/admin/tags/tags-page';

const tagAlpha = {
  id: 't-alpha',
  name: 'Alpha',
  color: '#112233',
  description: null,
  archived_at: null,
  usage_count: 0,
  is_system: false,
};

const tagBeta = {
  id: 't-beta',
  name: 'Beta',
  color: null,
  description: null,
  archived_at: null,
  usage_count: 1,
  is_system: false,
};

describe('TagsPage', () => {
  beforeEach(() => {
    mockListAdminTags.mockReset();
    mockListAdminTags.mockResolvedValue([tagAlpha, tagBeta]);
  });

  it('shows Tag as the create editor title and filters rows by name search', async () => {
    const user = userEvent.setup();
    render(<TagsPage />);

    expect(await screen.findByRole('heading', { name: 'Tag' })).toBeInTheDocument();

    const tagsCard = screen.getByRole('heading', { name: 'Tags' }).closest('section');
    expect(tagsCard).toBeTruthy();
    const tagsSection = tagsCard as HTMLElement;

    expect(within(tagsSection).getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    expect(within(tagsSection).getByRole('cell', { name: 'Beta' })).toBeInTheDocument();

    const searchInput = within(tagsSection).getByPlaceholderText('Name');
    await user.type(searchInput, 'alp');

    expect(within(tagsSection).getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    expect(within(tagsSection).queryByRole('cell', { name: 'Beta' })).not.toBeInTheDocument();
  });
});
