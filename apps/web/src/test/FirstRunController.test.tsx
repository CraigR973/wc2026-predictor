import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { FirstRunController } from '@/components/FirstRunController';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// IntroTour is no longer rendered by FirstRunController, but we keep the
// mock so the import of markTourSeen / isTourSeen still resolves.
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

/** Captures the current location so we can assert on navigation. */
function LocationDisplay() {
  const loc = useLocation();
  return <span data-testid="location">{loc.pathname}</span>;
}

function renderController(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationDisplay />
      <Routes>
        <Route path="*" element={<FirstRunController />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedUseAuth.mockReturnValue({
    player,
    isLoading: false,
    sessionUnlockRequired: false,
    sessionUnlockError: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    updatePlayer: vi.fn(),
    unlockStoredSession: vi.fn(),
  });
});

describe('FirstRunController', () => {
  it('navigates a brand-new user to /about instead of showing the tour', async () => {
    renderController('/');

    // After the useEffect fires, location should be /about
    await act(async () => {});

    expect(screen.getByTestId('location').textContent).toBe('/about');
    expect(screen.queryByRole('button', { name: 'close-tour' })).toBeNull();
  });

  it('marks tour as seen after the /about redirect so it never redirects again', async () => {
    renderController('/');
    await act(async () => {});

    // markTourSeen writes the per-user key (since U49)
    expect(localStorage.getItem('sss_tour_seen_p1')).toBe('1');
  });

  it('does not stack first-run popups over the /about redirect', async () => {
    renderController('/');
    await act(async () => {});

    expect(screen.getByTestId('location').textContent).toBe('/about');
    expect(screen.queryByRole('button', { name: 'close-notif' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'close-launchpad' })).toBeNull();
  });

  it('renders nothing for a returning user once the about redirect has happened', () => {
    localStorage.setItem('sss_tour_seen', '1');

    const { container } = renderController();

    expect(screen.queryByRole('button', { name: 'close-notif' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'close-launchpad' })).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders nothing when all steps are done', () => {
    localStorage.setItem('sss_tour_seen', '1');
    localStorage.setItem('sss_notif_prompt_seen', '1');
    localStorage.setItem('sss_firstrun_launchpad_seen', '1');

    const { container } = renderController();

    // Only the LocationDisplay span — no modals
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'close-tour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'close-notif' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'close-launchpad' })).toBeNull();
  });
});
