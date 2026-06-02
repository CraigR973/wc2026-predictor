import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { DashboardPage } from '@/pages/DashboardPage';

const MOCK_LEAGUE = [{ slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', description: null, privacy: 'private', member_count: 3, max_members: null, created_at: '2026-01-01T00:00:00Z' }];

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

function makeWrapper(fetchImpl: (url: string) => Promise<unknown>) {
  vi.stubGlobal('fetch', fetchImpl);
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
  return Wrapper;
}

function mockFetch(summary: object) {
  return (url: string) => {
    if (url.includes('/leagues/mine')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEAGUE) });
    }
    if (url.includes('/cross-league-summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(summary) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// U16.1 — Points hero
// ---------------------------------------------------------------------------

describe('DashboardPage — PointsHero', () => {
  it('shows total_points as the hero number', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 1.0,
      total_points: 87,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 1, member_count: 3, rank_delta: null, triggered_by_match_id: null },
      ],
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('87')).toBeTruthy());
    expect(screen.getByText('87')).toBeTruthy();
  });

  it('shows "Welcome back, Alice" subline when points > 0', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 1.0,
      total_points: 42,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 1, member_count: 3, rank_delta: null, triggered_by_match_id: null },
      ],
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Welcome back, Alice')).toBeTruthy());
  });

  it('shows no avg-rank number on the dashboard (removed per U16.1)', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 2.5,
      total_points: 10,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 2, member_count: 3, rank_delta: null, triggered_by_match_id: null },
      ],
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    // Give time for data to render
    await waitFor(() => expect(screen.queryByText('10')).toBeTruthy());
    // avg_rank should not appear as a standalone number
    expect(screen.queryByText('2.5')).toBeFalsy();
    expect(screen.queryByText('Average position 2.5')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U16.2 — Hero zero / pre-tournament state
// ---------------------------------------------------------------------------

describe('DashboardPage — hero zero state', () => {
  it('shows the gentle nudge subline when total_points === 0', async () => {
    stubAuth();
    const SUMMARY = { avg_rank: null, total_points: 0, leagues_count: 0, per_league: [] };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() =>
      expect(
        screen.queryByText(/Your tally starts when the first results land/),
      ).toBeTruthy(),
    );
  });

  it('does NOT show "Welcome back" subline when total_points === 0', async () => {
    stubAuth();
    const SUMMARY = { avg_rank: null, total_points: 0, leagues_count: 0, per_league: [] };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Your tally starts/)).toBeTruthy(),
    );
    expect(screen.queryByText('Welcome back, Alice')).toBeFalsy();
  });

  it('still renders the "0" digit in zero state', async () => {
    stubAuth();
    const SUMMARY = { avg_rank: null, total_points: 0, leagues_count: 0, per_league: [] };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Your tally starts/)).toBeTruthy(),
    );
    expect(screen.getByText('0')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// U16.4 — Delta badge rendering
// ---------------------------------------------------------------------------

describe('DashboardPage — delta badge', () => {
  it('renders ↑2 badge when rank_delta = 2', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 1.0,
      total_points: 50,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 1, member_count: 3, rank_delta: 2, triggered_by_match_id: null },
      ],
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('↑2')).toBeTruthy());
    expect(screen.getByText('↑2')).toBeTruthy();
  });

  it('renders ↓1 badge when rank_delta = -1', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 2.0,
      total_points: 30,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 2, member_count: 3, rank_delta: -1, triggered_by_match_id: null },
      ],
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('↓1')).toBeTruthy());
    expect(screen.getByText('↓1')).toBeTruthy();
  });

  it('renders ▬ when rank_delta = 0', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 2.0,
      total_points: 30,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 2, member_count: 3, rank_delta: 0, triggered_by_match_id: null },
      ],
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('▬')).toBeTruthy());
    expect(screen.getByText('▬')).toBeTruthy();
  });

  it('renders no delta badge when rank_delta is null', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 1.0,
      total_points: 20,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 1, member_count: 3, rank_delta: null, triggered_by_match_id: null },
      ],
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('The Steele Spreadsheet')).toBeTruthy());
    expect(screen.queryByText('↑')).toBeFalsy();
    expect(screen.queryByText('↓')).toBeFalsy();
    expect(screen.queryByText('▬')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U16.5 — Impact line on Latest Result
// ---------------------------------------------------------------------------

const RECENT_PRED = {
  match_id: 'match-abc',
  stage: 'GROUP',
  kickoff_utc: '2026-06-15T15:00:00Z',
  home_team_name: 'England',
  away_team_name: 'USA',
  home_team_flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  away_team_flag: '🇺🇸',
  actual_home: 2,
  actual_away: 1,
  predicted_home: 2,
  predicted_away: 1,
  points_awarded: 7,
  points_breakdown: { result: 3, goals: 2, exact: 2, total: 7 },
};

describe('DashboardPage — impact line', () => {
  it('shows the impact line when per_league entries trace to this match', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 1.0,
      total_points: 7,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 2, member_count: 3, rank_delta: 2, triggered_by_match_id: 'match-abc' },
      ],
    };
    const Wrapper = makeWrapper((url: string) => {
      if (url.includes('/leagues/mine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEAGUE) });
      }
      if (url.includes('/cross-league-summary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(SUMMARY) });
      }
      if (url.includes('/predictions/recent')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([RECENT_PRED]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/↑2 in The Steele Spreadsheet/)).toBeTruthy(),
    );
  });

  it('omits the impact line when no per_league entry traces to this match', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 1.0,
      total_points: 7,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 2, member_count: 3, rank_delta: 2, triggered_by_match_id: 'match-other' },
      ],
    };
    const Wrapper = makeWrapper((url: string) => {
      if (url.includes('/leagues/mine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEAGUE) });
      }
      if (url.includes('/cross-league-summary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(SUMMARY) });
      }
      if (url.includes('/predictions/recent')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([RECENT_PRED]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    render(<Wrapper />);
    // Wait for latest result card to render (England is part of a larger text node — use regex)
    await waitFor(() => expect(screen.queryByText(/England/)).toBeTruthy());
    expect(screen.queryByText(/↑2 in The Steele Spreadsheet/)).toBeFalsy();
  });

  it('omits the impact line when rank_delta is 0 for all matching entries', async () => {
    stubAuth();
    const SUMMARY = {
      avg_rank: 1.0,
      total_points: 7,
      leagues_count: 1,
      per_league: [
        { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 2, member_count: 3, rank_delta: 0, triggered_by_match_id: 'match-abc' },
      ],
    };
    const Wrapper = makeWrapper((url: string) => {
      if (url.includes('/leagues/mine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEAGUE) });
      }
      if (url.includes('/cross-league-summary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(SUMMARY) });
      }
      if (url.includes('/predictions/recent')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([RECENT_PRED]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/England/)).toBeTruthy());
    expect(screen.queryByText(/in The Steele Spreadsheet/)).toBeFalsy();
  });
});
