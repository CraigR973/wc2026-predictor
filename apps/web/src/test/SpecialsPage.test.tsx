import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { SpecialsPage } from '@/pages/SpecialsPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FUTURE_LOCK = '2026-06-11T20:00:00Z';
const PAST_LOCK = '2024-01-01T00:00:00Z';

const TEAM_A = { id: 'ta', name: 'Brazil', code: 'BRA', flag_emoji: '🇧🇷' };
const TEAM_B = { id: 'tb', name: 'Germany', code: 'GER', flag_emoji: '🇩🇪' };

const GROUP_RESPONSE = [
  {
    id: 'ga',
    name: 'Group A',
    standings: [
      { team_id: TEAM_A.id, team_name: TEAM_A.name, team_code: TEAM_A.code, flag_emoji: TEAM_A.flag_emoji, position: 1, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
      { team_id: TEAM_B.id, team_name: TEAM_B.name, team_code: TEAM_B.code, flag_emoji: TEAM_B.flag_emoji, position: 2, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
    ],
  },
];

const EMPTY_SPECIALS = {
  is_locked: false,
  lock_at: FUTURE_LOCK,
  predictions: [
    { id: '', prediction_type: 'tournament_winner', predicted_team_id: null, predicted_player_name: null, submitted_at: null, points_awarded: null },
    { id: '', prediction_type: 'golden_boot', predicted_team_id: null, predicted_player_name: null, submitted_at: null, points_awarded: null },
    { id: '', prediction_type: 'top_scoring_team', predicted_team_id: null, predicted_player_name: null, submitted_at: null, points_awarded: null },
  ],
};

const SUBMITTED_SPECIALS = {
  is_locked: false,
  lock_at: FUTURE_LOCK,
  predictions: [
    { id: 'sp1', prediction_type: 'tournament_winner', predicted_team_id: TEAM_A.id, predicted_player_name: null, submitted_at: '2026-06-01T10:00:00Z', points_awarded: null },
    { id: 'sp2', prediction_type: 'golden_boot', predicted_team_id: null, predicted_player_name: 'Kylian Mbappé', submitted_at: '2026-06-01T10:00:00Z', points_awarded: null },
    { id: 'sp3', prediction_type: 'top_scoring_team', predicted_team_id: TEAM_B.id, predicted_player_name: null, submitted_at: '2026-06-01T10:00:00Z', points_awarded: null },
  ],
};

const LOCKED_SPECIALS = {
  is_locked: true,
  lock_at: PAST_LOCK,
  predictions: SUBMITTED_SPECIALS.predictions,
};

const ALL_PICKS = [
  {
    player_id: 'p2',
    player_name: 'Bob',
    predictions: [
      { id: 'sp4', prediction_type: 'tournament_winner', predicted_team_id: TEAM_B.id, predicted_player_name: null, submitted_at: '2026-06-01T10:00:00Z', points_awarded: 20 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FetchOverrides {
  specials?: unknown;
  groups?: unknown;
  allPicks?: unknown;
  putResult?: unknown;
}

function makeFetch(overrides: FetchOverrides = {}) {
  const specials = overrides.specials ?? EMPTY_SPECIALS;
  const groups = overrides.groups ?? GROUP_RESPONSE;
  const allPicks = overrides.allPicks ?? ALL_PICKS;
  const putResult = overrides.putResult ?? SUBMITTED_SPECIALS.predictions[0];

  return vi.fn((url: string, opts?: RequestInit) => {
    if (url.includes('/api/v1/specials/all')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(allPicks) });
    }
    if (url.includes('/api/v1/specials') && opts?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(putResult) });
    }
    if (url.includes('/api/v1/specials')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(specials) });
    }
    if (url.includes('/api/v1/groups')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(groups) });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const STORED_PLAYER = JSON.stringify({
  id: 'p1',
  displayName: 'Alice',
  role: 'player',
  timezone: 'UTC',
});

function renderPage(fetchMock?: ReturnType<typeof makeFetch>) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (k === 'wc2026_player') return STORED_PLAYER;
      if (k === 'wc2026_access') return FAKE_JWT;
      return null;
    },
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });

  vi.stubGlobal('fetch', fetchMock ?? makeFetch());

  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <SpecialsPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpecialsPage — pre-lock', () => {
  it('renders page heading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Tournament Specials')).toBeInTheDocument();
    });
  });

  it('shows 3 special prediction cards', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Tournament Winner')).toBeInTheDocument();
      expect(screen.getByText('Golden Boot')).toBeInTheDocument();
      expect(screen.getByText('Top Scoring Team')).toBeInTheDocument();
    });
  });

  it('shows submitted count', async () => {
    renderPage(makeFetch({ specials: SUBMITTED_SPECIALS }));
    await waitFor(() => {
      expect(screen.getByText('3/3 submitted')).toBeInTheDocument();
    });
  });

  it('shows lock countdown banner with future lock', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Locks in/)).toBeInTheDocument();
    });
  });

  it('renders team select for tournament winner', async () => {
    renderPage();
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('renders text input for golden boot', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Mbappé/i)).toBeInTheDocument();
    });
  });

  it('pre-fills golden boot input with existing value', async () => {
    renderPage(makeFetch({ specials: SUBMITTED_SPECIALS }));
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Mbappé/i) as HTMLInputElement;
      expect(input.value).toBe('Kylian Mbappé');
    });
  });

  it('saves golden boot prediction on button click', async () => {
    const user = userEvent.setup();
    const fetch = makeFetch({ specials: EMPTY_SPECIALS });
    renderPage(fetch);

    await waitFor(() => screen.getByPlaceholderText(/Mbappé/i));

    const input = screen.getByPlaceholderText(/Mbappé/i);
    await user.type(input, 'Erling Haaland');

    const saveButtons = screen.getAllByRole('button', { name: /Save/i });
    // golden_boot Save button (second card = index 1)
    const goldenBootSave = saveButtons.find((b) => !b.hasAttribute('disabled'));
    expect(goldenBootSave).toBeTruthy();
    await user.click(goldenBootSave!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/specials/golden_boot'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });
});

describe('SpecialsPage — post-lock', () => {
  it('shows locked banner when tournament started', async () => {
    renderPage(makeFetch({ specials: LOCKED_SPECIALS }));
    await waitFor(() => {
      expect(screen.getByText(/Tournament has started/)).toBeInTheDocument();
    });
  });

  it('shows comparison table with all picks after lock', async () => {
    renderPage(makeFetch({ specials: LOCKED_SPECIALS }));
    await waitFor(() => {
      expect(screen.getByText('All Picks')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows points awarded in comparison view', async () => {
    renderPage(makeFetch({ specials: LOCKED_SPECIALS }));
    await waitFor(() => {
      expect(screen.getByText('20 pts')).toBeInTheDocument();
    });
  });

  it('does not show form inputs after lock', async () => {
    renderPage(makeFetch({ specials: LOCKED_SPECIALS }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Mbappé/i)).not.toBeInTheDocument();
    });
  });
});
