import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { NotificationsPromptModal, isNotifPromptSeen } from '@/components/NotificationsPromptModal';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  // Mock matchMedia — standalone by default
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: true, addListener: vi.fn(), removeListener: vi.fn() }),
  });
  // Stub Notification API
  Object.defineProperty(window, 'Notification', {
    writable: true,
    value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
  });
  // Stub serviceWorker
  Object.defineProperty(navigator, 'serviceWorker', {
    writable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
          subscribe: vi.fn().mockResolvedValue({
            toJSON: () => ({ endpoint: 'https://push.example.com', keys: {} }),
          }),
        },
      }),
    },
  });
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

describe('NotificationsPromptModal', () => {
  it('renders Enable button and Maybe later when standalone', () => {
    render(<NotificationsPromptModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /enable match alerts/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /maybe later/i })).toBeTruthy();
  });

  it('sets localStorage flag and calls onClose when Maybe later clicked', () => {
    const onClose = vi.fn();
    render(<NotificationsPromptModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }));
    expect(isNotifPromptSeen()).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows install guidance when not standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    render(<NotificationsPromptModal onClose={vi.fn()} />);
    expect(screen.getByText(/add to home screen first/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /enable match alerts/i })).toBeNull();
  });

  it('sets localStorage flag and calls onClose when enable clicked', async () => {
    const onClose = vi.fn();
    render(<NotificationsPromptModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /enable match alerts/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(isNotifPromptSeen()).toBe(true);
  });
});
