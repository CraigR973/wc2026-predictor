import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FirstRunController } from '@/components/FirstRunController';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/IntroTour', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/IntroTour')>();
  return {
    ...actual,
    IntroTour: ({ onClose }: { onClose: () => void }) => (
      <button type="button" onClick={onClose}>
        close-tour
      </button>
    ),
  };
});

vi.mock('@/components/NotificationsPromptModal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/NotificationsPromptModal')>();
  return {
    ...actual,
    NotificationsPromptModal: ({ onClose }: { onClose: () => void }) => (
      <button type="button" onClick={onClose}>
        close-notif
      </button>
    ),
  };
});

vi.mock('@/components/FirstRunLaunchpad', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/FirstRunLaunchpad')>();
  return {
    ...actual,
    FirstRunLaunchpad: ({ onClose }: { onClose: () => void }) => (
      <button
        type="button"
        onClick={() => {
          localStorage.setItem('sss_firstrun_launchpad_seen', '1');
          onClose();
        }}
      >
        close-launchpad
      </button>
    ),
  };
});

const mockedUseAuth = vi.mocked(useAuth);
const player = {
  id: 'p1',
  displayName: 'Alice',
  role: 'player' as const,
  timezone: 'UTC',
  avatarUrl: null,
};

function renderController() {
  return render(
    <MemoryRouter>
      <FirstRunController />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedUseAuth.mockReturnValue({
    player,
    isLoading: false,
    biometricUnlockRequired: false,
    biometricUnlockFailed: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    updatePlayer: vi.fn(),
    unlockStoredSession: vi.fn(),
  });
});

describe('FirstRunController', () => {
  it('runs tour → notif → checklist → done in order', () => {
    renderController();

    expect(screen.getByRole('button', { name: 'close-tour' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'close-tour' }));

    expect(screen.getByRole('button', { name: 'close-notif' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'close-notif' }));

    expect(screen.getByRole('button', { name: 'close-launchpad' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'close-launchpad' }));

    expect(screen.queryByRole('button', { name: 'close-tour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'close-notif' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'close-launchpad' })).toBeNull();
  });

  it('shows the launchpad only once after tour and notifications are already seen', () => {
    localStorage.setItem('sss_tour_seen', '1');
    localStorage.setItem('sss_notif_prompt_seen', '1');

    const { rerender } = renderController();
    fireEvent.click(screen.getByRole('button', { name: 'close-launchpad' }));

    rerender(
      <MemoryRouter>
        <FirstRunController />
      </MemoryRouter>,
    );

    expect(localStorage.getItem('sss_firstrun_launchpad_seen')).toBe('1');
    expect(screen.queryByRole('button', { name: 'close-launchpad' })).toBeNull();
  });
});
