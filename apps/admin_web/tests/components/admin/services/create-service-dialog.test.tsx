import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CreateServiceDialog } from '@/components/admin/services/create-service-dialog';

describe('CreateServiceDialog', () => {
  it('disables create action until title is provided', () => {
    render(
      <CreateServiceDialog
        open
        isLoading={false}
        error=''
        onClose={() => undefined}
        onCreate={async () => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Create service' })).toBeDisabled();
  });

  it('submits create payload when form is valid', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateServiceDialog
        open
        isLoading={false}
        error=''
        onClose={() => undefined}
        onCreate={onCreate}
      />
    );

    await user.type(screen.getByLabelText('Title'), 'My service');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My service',
        service_type: 'training_course',
      })
    );
  });
});
