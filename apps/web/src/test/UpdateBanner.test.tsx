import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateBanner } from '@/components/UpdateBanner';

// Mock the virtual PWA module — Vitest cannot resolve virtual: imports without this.
const mockUpdateServiceWorker = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(() => ({
    needRefresh: [true, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpdateBanner', () => {
  it('renders when needRefresh is true', () => {
    render(<UpdateBanner />);
    expect(screen.getByText('New version available')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy();
  });

  it('calls updateServiceWorker(true) and reloads on Update click', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    });

    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('hides the banner when × is clicked without reloading', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    });

    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText('New version available')).toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
  });

  it('renders nothing when needRefresh is false', async () => {
    const { useRegisterSW } = await import('virtual:pwa-register/react');
    vi.mocked(useRegisterSW).mockReturnValueOnce({
      needRefresh: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
      offlineReady: [false, vi.fn()],
    });

    render(<UpdateBanner />);
    expect(screen.queryByText('New version available')).toBeNull();
  });
});
