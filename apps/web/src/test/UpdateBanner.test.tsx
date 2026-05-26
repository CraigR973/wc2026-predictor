import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UpdateBanner } from '@/components/UpdateBanner';

// Staging's UpdateBanner uses registerSW from virtual:pwa-register (not the
// React-specific useRegisterSW). The mock triggers onNeedRefresh immediately
// so the banner shows on mount.
const mockUpdateSW = vi.fn().mockResolvedValue(undefined);

type RegisterSWCallbacks = {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
};

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((callbacks: RegisterSWCallbacks) => {
    callbacks.onNeedRefresh?.();
    return mockUpdateSW;
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpdateBanner', () => {
  it('renders when onNeedRefresh fires', async () => {
    render(<UpdateBanner />);
    await waitFor(() =>
      expect(screen.getByText('A new version is available')).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy();
  });

  it('calls updateSW(true) on Refresh click', async () => {
    render(<UpdateBanner />);
    await waitFor(() => screen.getByText('A new version is available'));
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(mockUpdateSW).toHaveBeenCalledWith(true));
  });

  it('hides the banner when dismiss is clicked without calling updateSW', async () => {
    render(<UpdateBanner />);
    await waitFor(() => screen.getByText('A new version is available'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText('A new version is available')).toBeNull();
    expect(mockUpdateSW).not.toHaveBeenCalled();
  });

  it('renders nothing when onNeedRefresh is never triggered', async () => {
    const { registerSW } = await import('virtual:pwa-register');
    vi.mocked(registerSW).mockImplementationOnce(
      (_cb: RegisterSWCallbacks) => mockUpdateSW,
    );

    render(<UpdateBanner />);
    expect(screen.queryByText('A new version is available')).toBeNull();
  });
});
