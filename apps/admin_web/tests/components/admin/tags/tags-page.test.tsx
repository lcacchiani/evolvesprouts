import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockListAdminTags, mockUpdateAdminTag } = vi.hoisted(() => ({
  mockListAdminTags: vi.fn(),
  mockUpdateAdminTag: vi.fn(),
}));

vi.mock('@/lib/tags-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tags-api')>();
  return {
    ...actual,
    listAdminTags: mockListAdminTags,
    updateAdminTag: mockUpdateAdminTag,
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
    mockUpdateAdminTag.mockReset();
    mockListAdminTags.mockResolvedValue([tagAlpha, tagBeta]);
    mockUpdateAdminTag.mockImplementation(async (tagId: string, body: { archived?: boolean }) => {
      if (body.archived === true) {
        return { ...tagAlpha, id: tagId, archived_at: '2026-01-01T00:00:00.000Z' };
      }
      if (body.archived === false) {
        return { ...tagAlpha, id: tagId, archived_at: null };
      }
      return null;
    });
  });

  it('shows Tag as the editor title and filters rows by name search', async () => {
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

  it('disables delete when usage is greater than zero and offers Archive', async () => {
    render(<TagsPage />);

    const tagsCard = screen.getByRole('heading', { name: 'Tags' }).closest('section');
    expect(tagsCard).toBeTruthy();
    const tagsSection = tagsCard as HTMLElement;
    await screen.findByRole('cell', { name: /Alpha/ });

    const betaRow = within(tagsSection).getByRole('cell', { name: /Beta/ }).closest('tr');
    expect(betaRow).toBeTruthy();
    expect(
      within(betaRow as HTMLElement).getByRole('button', { name: 'Cannot delete tag while it is in use' })
    ).toBeDisabled();
    expect(within(betaRow as HTMLElement).getByRole('button', { name: 'Archive' })).not.toBeDisabled();

    const alphaRow = within(tagsSection).getByRole('cell', { name: /Alpha/ }).closest('tr');
    expect(alphaRow).toBeTruthy();
    expect(within(alphaRow as HTMLElement).getByRole('button', { name: 'Delete tag' })).not.toBeDisabled();
  });

  it('archives a tag from the table after confirmation', async () => {
    const user = userEvent.setup();
    render(<TagsPage />);

    const tagsCard = screen.getByRole('heading', { name: 'Tags' }).closest('section');
    expect(tagsCard).toBeTruthy();
    const tagsSection = tagsCard as HTMLElement;
    await screen.findByRole('cell', { name: /Alpha/ });

    const alphaRow = within(tagsSection).getByRole('cell', { name: /Alpha/ }).closest('tr');
    expect(alphaRow).toBeTruthy();
    await user.click(within(alphaRow as HTMLElement).getByRole('button', { name: 'Archive' }));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));

    expect(mockUpdateAdminTag).toHaveBeenCalledWith('t-alpha', { archived: true });
  });
});
