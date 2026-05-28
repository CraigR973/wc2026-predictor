import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { DashboardPage } from '@/pages/DashboardPage';

const MOCK_LEAGUE = [{ slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', description: null, privacy: 'private', member_count: 2, max_members: null, created_at: '2026-01-01T00:00:00Z' }];

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const STORED_PLAYER = JSON.stringify({
  id: 'p1',
  displayName: 'Alice',
  role: 'player',
  timezone: 'UTC',
});

function stubAuth() {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (k === 'wc2026_player') return STORED_PLAYER;
      if (k === 'wc2026_access') return FAKE_JWT;
      if (k === 'wc2026_active_league_slug') return 'steele-spreadsheet';
      if (k === 'sss_leaderboard_hint_dismissed') return null;
      return null;
    },
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const LEADERBOARD = [
  {
    rank: 1,
    player_id: 'p1',
    player_name: 'Alice',
    total_points: 42,
    match_points: 40,
    knockout_winner_points: 2,
    special_points: 0,
    is_active: true,
  },
  {
    rank: 2,
    player_id: 'p2',
    player_name: 'Zara',
    total_points: 30,
    match_points: 30,
    knockout_winner_points: 0,
    special_points: 0,
    is_active: true,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('DashboardPage — keepPreviousData', () => {
  it('shows previous leaderboard value during an in-flight refetch', async () => {
    stubAuth();

    // Track whether the second leaderboard fetch has been triggered
    let leaderboardCallCount = 0;
    let resolveSecondLeaderboard: (v: unknown) => void;
    const secondLeaderboardFetch = new Promise((res) => {
      resolveSecondLeaderboard = res;
    });

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/leagues/mine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEAGUE) });
      }
      if (url.includes('/leaderboard')) {
        leaderboardCallCount++;
        if (leaderboardCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(LEADERBOARD),
          });
        }
        // Stall second fetch to verify keepPreviousData keeps old values visible
        return secondLeaderboardFetch.then(() => ({
          ok: true,
          json: () => Promise.resolve(LEADERBOARD),
        }));
      }
      // All other API calls return empty/null immediately
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    const qc = makeQueryClient();
    const Wrapper = () => (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AuthProvider>
            <LeagueProvider>
              <DashboardPage />
            </LeagueProvider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    render(<Wrapper />);

    // Wait for leaderboard data: "Zara" only comes from the leaderboard row
    // (not the welcome heading), so seeing it confirms the table rendered.
    await waitFor(() => expect(screen.queryByText('Zara')).toBeTruthy());
    expect(screen.getByText('Zara')).toBeTruthy();

    // Trigger a refetch that stalls
    qc.invalidateQueries({ queryKey: ['leaderboard'] });

    // keepPreviousData must keep "Zara" visible during the in-flight refetch
    expect(screen.getByText('Zara')).toBeTruthy();

    // Unblock
    resolveSecondLeaderboard!(undefined);
  });
});
