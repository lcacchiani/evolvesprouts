import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebsitePage } from '@/components/admin/website/website-page';

vi.mock('@/lib/config', () => ({
  getPublicSiteBaseUrl: () => 'https://www.example.com',
  getTrainingSiteBaseUrl: () => 'https://training.example.com',
}));

vi.mock('@/lib/qr-code-image', () => ({
  generatePublicSiteQrPngDataUrl: vi.fn(async () => 'data:image/png;base64,AA'),
}));

vi.mock('@/components/admin/website/website-polls-panel', () => ({
  WebsitePollsPanel: () => <div>Polls panel</div>,
}));

describe('WebsitePage', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/website');
  });

  it('shows QR Codes tab by default', () => {
    render(<WebsitePage />);
    expect(screen.getByRole('group', { name: 'Website section views' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'QR Codes', pressed: true })).toBeInTheDocument();
    expect(screen.getByText('Website QR codes')).toBeInTheDocument();
  });

  it('switches to Polls tab', () => {
    render(<WebsitePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Polls' }));
    expect(screen.getByText('Polls panel')).toBeInTheDocument();
    expect(screen.queryByText('Website QR codes')).not.toBeInTheDocument();
  });
});
