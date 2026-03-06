import { render, screen, within } from '@testing-library/react';
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

  it('shows readable option labels and HKD currency default', () => {
    render(
      <CreateServiceDialog
        open
        isLoading={false}
        error=''
        onClose={() => undefined}
        onCreate={async () => undefined}
      />
    );

    const serviceTypeSelect = screen.getByLabelText('Service type');
    expect(within(serviceTypeSelect).getByRole('option', { name: 'Training Course' })).toBeInTheDocument();

    const deliveryModeSelect = screen.getByLabelText('Delivery mode');
    expect(within(deliveryModeSelect).getByRole('option', { name: 'In Person' })).toBeInTheDocument();

    const pricingUnitSelect = screen.getByLabelText('Pricing unit');
    expect(within(pricingUnitSelect).getByRole('option', { name: 'Per Person' })).toBeInTheDocument();

    const currencySelect = screen.getByLabelText('Currency');
    expect(currencySelect).toHaveValue('HKD');
    expect(within(currencySelect).getByRole('option', { name: 'HKD Hong Kong Dollar' })).toBeInTheDocument();
  });
});
