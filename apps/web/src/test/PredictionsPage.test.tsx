import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { PredictionsPage } from '@/pages/PredictionsPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_A = { id: 'ga', name: 'A', standings: [] };
const GROUP_B = { id: 'gb', name: 'B', standings: [] };

const MATCH_SCHEDULED = {
  id: 'm1',
  match_number: 1,
  stage: 'group',
  group_id: 'ga',
  home_team: { id: 't1', name: 'Brazil', code: 'BRA', flag_emoji: '🇧🇷' },
  away_team: { id: 't2', name: 'Germany', code: 'GER', flag_emoji: '🇩🇪' },
  home_team_placeholder: null,
  away_team_placeholder: null,
  kickoff_utc: '2026-06-11T20:00:00Z',
  venue: 'MetLife Stadium',
  status: 'scheduled',
  actual_home_score: null,
  actual_away_score: null,
  extra_time: false,
  penalties: false,
  postponed_reason: null,
};

const MATCH_LOCKED = {
  ...MATCH_SCHEDULED,
  id: 'm2',
  match_number: 2,
  status: 'locked',
  home_team: { id: 't3', name: 'France', code: 'FRA', flag_emoji: '🇫🇷' },
  away_team: { id: 't4', name: 'Spain', code: 'ESP', flag_emoji: '🇪🇸' },
};

const MATCH_CANCELLED = {
  ...MATCH_SCHEDULED,
  id: 'm3',
  match_number: 3,
  status: 'cancelled',
  home_team: { id: 't5', name: 'Italy', code: 'ITA', flag_emoji: '🇮🇹' },
  away_team: { id: 't6', name: 'England', code: 'ENG', flag_emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
};

const MATCH_COMPLETED = {
  ...MATCH_SCHEDULED,
  id: 'm4',
  match_number: 4,
  status: 'completed',
  actual_home_score: 2,
  actual_away_score: 1,
  home_team: { id: 't7', name: 'Argentina', code: 'ARG', flag_emoji: '🇦🇷' },
  away_team: { id: 't8', name: 'Portugal', code: 'POR', flag_emoji: '🇵🇹' },
};

const PRED_SCHEDULED = {
  match_id: 'm1',
  predicted_home: 1,
  predicted_away: 0,
  points_awarded: null,
};

const PRED_COMPLETED = {
  match_id: 'm4',
  predicted_home: 2,
  predicted_away: 1,
  points_awarded: 5,
};

const NO_PRED_CANCELLED = {
  match_id: 'm3',
  predicted_home: null,
  predicted_away: null,
  points_awarded: 0,
};

// Match scheduled with NO prediction yet — triggers "Not predicted yet" warning
const MATCH_SCHEDULED_NOPRED = {
  ...MATCH_SCHEDULED,
  id: 'm5',
  match_number: 5,
  status: 'scheduled',
  home_team: { id: 't9', name: 'Mexico', code: 'MEX', flag_emoji: '🇲🇽' },
  away_team: { id: 't10', name: 'USA', code: 'USA', flag_emoji: '🇺🇸' },
  kickoff_utc: '2026-06-15T18:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    groups: [GROUP_A, GROUP_B],
    matches: [MATCH_SCHEDULED, MATCH_LOCKED, MATCH_CANCELLED, MATCH_COMPLETED],
    predictions: [PRED_SCHEDULED, PRED_COMPLETED, NO_PRED_CANCELLED],
  };
  const data = { ...defaults, ...overrides };

  return vi.fn((url: string) => {
    if (url.includes('/api/v1/groups')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data.groups) });
    }
    if (url.includes('/api/v1/matches')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data.matches) });
    }
    if (url.includes('/api/v1/predictions/me')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data.predictions) });
    }
    if (url.includes('/api/v1/predictions/')) {
      // PUT — echo back success
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// A fake JWT with exp far in the future (year 2286) — keeps isAccessTokenExpiringSoon false.
// Payload: {"sub":"p1","exp":9999999999}
const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake';

const STORED_PLAYER = JSON.stringify({
  id: 'p1',
  displayName: 'Alice',
  role: 'player',
  timezone: 'UTC',
});

function renderPage() {
  // Stub localStorage with correct wc2026_* keys so tokens.ts reads them.
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

  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <PredictionsPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PredictionsPage', () => {
  it('renders group tabs A and B after loading', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Group A/i })).toBeTruthy());
    expect(screen.getByRole('tab', { name: /Group B/i })).toBeTruthy();
  });

  it('shows scheduled match inputs as editable', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByRole('tab', { name: /Group A/i }));

    // Group A tab is active by default — find home score input for match 1
    const homeInput = screen.getByLabelText('Home score for match 1') as HTMLInputElement;
    expect(homeInput.disabled).toBe(false);
  });

  it('shows locked match inputs as read-only', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByRole('tab', { name: /Group A/i }));

    const lockedInput = screen.getByLabelText('Home score for match 2') as HTMLInputElement;
    expect(lockedInput.disabled).toBe(true);
  });

  it('shows cancelled match with voided badge and opacity', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByText('Voided'));
    const card = screen.getByTestId('prediction-card-m3');
    expect(card.className).toContain('opacity-50');
  });

  it('shows points badge for completed match', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByText('5 pts'));
  });

  it('populates inputs from existing predictions', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByRole('tab', { name: /Group A/i }));

    const homeInput = screen.getByLabelText('Home score for match 1') as HTMLInputElement;
    expect(homeInput.value).toBe('1');
  });

  it('save button is disabled when no changes are pending', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /Save Group A/i }));

    const saveBtn = screen.getByRole('button', { name: /Save Group A/i });
    expect(saveBtn).toHaveProperty('disabled', true);
  });

  it('enables save button after user edits a score', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByLabelText('Home score for match 1'));

    const homeInput = screen.getByLabelText('Home score for match 1');
    fireEvent.change(homeInput, { target: { value: '2' } });

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /Save Group A/i });
      expect(saveBtn).toHaveProperty('disabled', false);
    });
  });

  it('calls PUT /api/v1/predictions/{match_id} when save all is clicked', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    await waitFor(() => screen.getByLabelText('Home score for match 1'));

    const homeInput = screen.getByLabelText('Home score for match 1');
    fireEvent.change(homeInput, { target: { value: '3' } });

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /Save Group A/i });
      expect(saveBtn).toHaveProperty('disabled', false);
    });

    const saveBtn = screen.getByRole('button', { name: /Save Group A/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      const putCalls = (fetchMock.mock.calls as unknown as [string, RequestInit][]).filter(
        ([url, opts]) => url.includes('/api/v1/predictions/m1') && opts?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });
  });

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows lock indicator on locked match', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByTestId('prediction-card-m2'));
    expect(screen.getByTestId('lock-indicator')).toBeTruthy();
  });

  it('shows not-predicted warning for scheduled match with no prediction', async () => {
    vi.stubGlobal('fetch', makeFetch({
      matches: [MATCH_SCHEDULED, MATCH_LOCKED, MATCH_CANCELLED, MATCH_COMPLETED, MATCH_SCHEDULED_NOPRED],
      predictions: [PRED_SCHEDULED, PRED_COMPLETED, NO_PRED_CANCELLED],
    }));
    renderPage();
    await waitFor(() => screen.getByTestId('prediction-card-m5'));
    expect(screen.getByTestId('not-predicted-warning')).toBeTruthy();
  });

  it('does not show not-predicted warning when prediction is already filled', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByTestId('prediction-card-m1'));
    expect(screen.queryByTestId('not-predicted-warning')).toBeNull();
  });

  it('shows deadline warning when scheduled match kicks off within 1 hour', async () => {
    // Mock Date.now only (no fake timers — preserves waitFor's setTimeout)
    const kickoff = new Date('2026-06-11T20:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(kickoff - 30 * 60 * 1000);

    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByTestId('prediction-card-m1'));
    expect(screen.getByTestId('deadline-warning')).toBeTruthy();
  });

  it('score spinner increments value on ▲ click', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByLabelText('Home score for match 1'));

    const homeInput = screen.getByLabelText('Home score for match 1') as HTMLInputElement;
    expect(homeInput.value).toBe('1');

    const incrementBtn = screen.getByLabelText('Increment Home score for match 1');
    fireEvent.click(incrementBtn);

    await waitFor(() => {
      expect((screen.getByLabelText('Home score for match 1') as HTMLInputElement).value).toBe('2');
    });
  });

  it('score spinner decrements value on ▼ click', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    await waitFor(() => screen.getByLabelText('Home score for match 1'));

    const decrementBtn = screen.getByLabelText('Decrement Home score for match 1');
    fireEvent.click(decrementBtn);

    await waitFor(() => {
      expect((screen.getByLabelText('Home score for match 1') as HTMLInputElement).value).toBe('0');
    });
  });

  it('shows points badge for completed match (count-up resolves to final value)', async () => {
    vi.stubGlobal('fetch', makeFetch());
    renderPage();
    // waitFor retries until animation finishes (600ms max) or times out
    await waitFor(() => {
      expect(screen.getByTestId('points-badge').textContent).toBe('5 pts');
    }, { timeout: 3000 });
  });
});
