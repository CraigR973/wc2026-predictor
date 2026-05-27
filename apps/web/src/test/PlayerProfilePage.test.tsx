import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlayerProfilePage } from '@/pages/PlayerProfilePage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYER_ID = 'bb000000-0000-0000-0000-000000000001';
const MY_ID = 'aa000000-0000-0000-0000-000000000001';

const STATS: Record<string, unknown> = {
  player_id: PLAYER_ID,
  player_name: 'Bob',
  total_predictions_settled: 12,
  accuracy_pct: 66.7,
  exact_rate_pct: 25.0,
  avg_pts_per_prediction: 4.5,
  total_points: 54,
  best_round: 'group',
  best_round_points: 40,
  worst_round: 'r16',
  worst_round_points: 14,
  current_streak: 3,
  avg_prediction_timing_mins: 180,
};

const MY_STATS: Record<string, unknown> = {
  player_id: MY_ID,
  player_name: 'Alice',
  total_predictions_settled: 10,
  accuracy_pct: 70.0,
  exact_rate_pct: 20.0,
  avg_pts_per_prediction: 5.0,
  total_points: 50,
  best_round: 'group',
  best_round_points: 38,
  worst_round: 'r16',
  worst_round_points: 12,
  current_streak: 2,
  avg_prediction_timing_mins: 240,
};

const RECENT_PREDS = [
  {
    match_id: 'm1',
    stage: 'group',
    kickoff_utc: '2026-06-14T18:00:00Z',
    home_team_name: 'Brazil',
    away_team_name: 'Germany',
    home_team_flag: '🇧🇷',
    away_team_flag: '🇩🇪',
    actual_home: 2,
    actual_away: 1,
    predicted_home: 2,
    predicted_away: 1,
    points_awarded: 10,
    points_breakdown: { goals: 2, result: 3, exact: 5, total: 10, no_prediction: false },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(targetId: string = PLAYER_ID) {
  return vi.fn((url: string) => {
    if (url.includes(`/api/v1/stats/${targetId}`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(STATS) });
    }
    if (url.includes('/api/v1/stats/me')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MY_STATS) });
    }
    if (url.includes('/predictions/recent')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(RECENT_PREDS) });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake';

function renderPage(playerId: string = PLAYER_ID, currentUserId: string = MY_ID) {
  const storedPlayer = JSON.stringify({
    id: currentUserId,
    displayName: 'Alice',
    role: 'player',
    timezone: 'UTC',
  });

  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (k === 'wc2026_player') return storedPlayer;
      if (k === 'wc2026_access') return FAKE_JWT;
      return null;
    },
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });

  vi.stubGlobal('fetch', makeFetch(playerId));

  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/players/${playerId}`]}>
        <AuthProvider>
          <Routes>
            <Route path="/players/:id" element={<PlayerProfilePage />} />
          </Routes>
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

describe('PlayerProfilePage', () => {
  it('renders the player name as heading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bob');
    });
  });

  it('shows total points stat card', async () => {
    renderPage();
    await waitFor(() => {
      // "Total Points" and "54" appear in both stat card and H2H column
      expect(screen.getAllByText('Total Points').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('54').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows accuracy and exact rate', async () => {
    renderPage();
    await waitFor(() => {
      // 66.7% appears in stat card and H2H column
      expect(screen.getAllByText('66.7%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Exact Score')).toBeInTheDocument();
      expect(screen.getAllByText('25%').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows best and worst round', async () => {
    renderPage();
    await waitFor(() => {
      // 'Group Stage' appears in best-round section and recent-preds stage column
      expect(screen.getAllByText('Group Stage').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Round of 16')).toBeInTheDocument();
      expect(screen.getByText('40 pts')).toBeInTheDocument();
    });
  });

  it('shows H2H mini table when viewing another player', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('You vs Bob')).toBeInTheDocument();
      // H2H section has a dedicated heading — check for the section header text
      expect(screen.getAllByText('Total Points').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('does not show H2H table when viewing own profile', async () => {
    renderPage(MY_ID, MY_ID);
    await waitFor(() => {
      expect(screen.queryByText(/You vs/)).not.toBeInTheDocument();
    });
  });

  it('shows recent predictions table with match info', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Recent Predictions')).toBeInTheDocument();
      expect(screen.getByText(/Brazil/)).toBeInTheDocument();
      expect(screen.getByText(/Germany/)).toBeInTheDocument();
    });
  });

  it('shows streak stat card', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Current Streak')).toBeInTheDocument();
    });
  });

  it('includes link back to leaderboard', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    });
  });
});
