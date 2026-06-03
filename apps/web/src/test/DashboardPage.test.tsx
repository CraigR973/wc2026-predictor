import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { DashboardPage } from '@/pages/DashboardPage';
import { PointsBreakdownRow } from '@/components/PointsBreakdownRow';

const MOCK_LEAGUE = [{ slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', description: null, privacy: 'private', member_count: 3, max_members: null, created_at: '2026-01-01T00:00:00Z' }];

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const STORED_PLAYER = JSON.stringify({
  id: 'p1',
  displayName: 'Alice',
  role: 'player',
  timezone: 'UTC',
});

const HOME_EMPTY: object = {
  todo: {
    specials_submitted: false,
    specials_lock_at: '2026-06-11T15:00:00Z',
    upcoming_unpredicted: 0,
    next_match: null,
  },
  rollup: null,
};

const HOME_WITH_ROLLUP: object = {
  todo: {
    specials_submitted: true,
    specials_lock_at: null,
    upcoming_unpredicted: 0,
    next_match: null,
  },
  rollup: {
    matchday: '2026-06-11',
    points_gained: 10,
    match_count: 2,
    matches: [
      {
        match_id: 'match-1',
        home_label: '🇧🇷 Brazil',
        away_label: '🇲🇽 Mexico',
        home_flag: '🇧🇷',
        away_flag: '🇲🇽',
        actual_home: 2,
        actual_away: 1,
        predicted_home: 2,
        predicted_away: 1,
        points_breakdown: { result: 3, goals: 1, exact: 2, total: 6 },
      },
      {
        match_id: 'match-2',
        home_label: '🇦🇷 Argentina',
        away_label: '🇨🇦 Canada',
        home_flag: '🇦🇷',
        away_flag: '🇨🇦',
        actual_home: 1,
        actual_away: 0,
        predicted_home: 2,
        predicted_away: 0,
        points_breakdown: { result: 3, goals: 1, exact: 0, total: 4 },
      },
    ],
  },
};

const SUMMARY_ZERO = { avg_rank: null, total_points: 0, leagues_count: 0, per_league: [] };

const SUMMARY_ONE_LEAGUE = {
  avg_rank: 1.0,
  total_points: 87,
  leagues_count: 1,
  per_league: [
    { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 1, member_count: 3, rank_delta: null, triggered_by_match_id: null },
  ],
};

const SUMMARY_TWO_LEAGUES = {
  avg_rank: 1.5,
  total_points: 50,
  leagues_count: 2,
  per_league: [
    { slug: 'steele-spreadsheet', name: 'The Steele Spreadsheet', rank: 1, member_count: 3, rank_delta: 2, triggered_by_match_id: 'match-1' },
    { slug: 'office-pool', name: 'Office Pool', rank: 3, member_count: 5, rank_delta: -1, triggered_by_match_id: 'match-1' },
  ],
};

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

function mockFetch(summary: object, home: object = HOME_EMPTY) {
  return (url: string) => {
    if (url.includes('/leagues/mine')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEAGUE) });
    }
    if (url.includes('/cross-league-summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(summary) });
    }
    if (url.includes('/me/home')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(home) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// U17.2 — Stat strip tiles
// ---------------------------------------------------------------------------

describe('DashboardPage — StatStrip tiles', () => {
  it('shows total_points in the Points tile', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('87')).toBeTruthy());
    expect(screen.getByText('87')).toBeTruthy();
  });

  it('shows best league rank in the Rank tile', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('#1')).toBeTruthy());
    expect(screen.getByText('#1')).toBeTruthy();
  });

  it('rank tile shows — when no snapshots yet', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows ↑/↓ delta on the best-rank tile', async () => {
    stubAuth();
    const summary = {
      ...SUMMARY_ONE_LEAGUE,
      per_league: [{ ...SUMMARY_ONE_LEAGUE.per_league[0], rank_delta: 2 }],
    };
    const Wrapper = makeWrapper(mockFetch(summary));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryAllByText('↑2').length).toBeGreaterThan(0));
  });

  it('appends "best of N" when in multiple leagues', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_TWO_LEAGUES));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/best of 2/)).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// U16.2 — Stat strip zero / pre-tournament state
// ---------------------------------------------------------------------------

describe('DashboardPage — zero state', () => {
  it('shows the gentle nudge subline when total_points === 0', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Your tally starts when the first results land/)).toBeTruthy(),
    );
  });

  it('still renders "0" in zero state (not hidden)', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
    // Points tile shows 0
    expect(screen.getByText('0')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// U16.4 — Delta badge on CompactLeagueRow
// ---------------------------------------------------------------------------

describe('DashboardPage — delta badge', () => {
  it('renders ↑2 badge when rank_delta = 2', async () => {
    stubAuth();
    const summary = {
      ...SUMMARY_ONE_LEAGUE,
      per_league: [{ ...SUMMARY_ONE_LEAGUE.per_league[0], rank_delta: 2 }],
    };
    const Wrapper = makeWrapper(mockFetch(summary));
    render(<Wrapper />);
    // The league row DeltaBadge renders ↑2
    await waitFor(() => {
      const nodes = screen.getAllByText('↑2');
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  it('renders ↓1 badge when rank_delta = -1', async () => {
    stubAuth();
    const summary = {
      ...SUMMARY_ONE_LEAGUE,
      per_league: [{ ...SUMMARY_ONE_LEAGUE.per_league[0], rank: 2, rank_delta: -1 }],
    };
    const Wrapper = makeWrapper(mockFetch(summary));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryAllByText('↓1').length).toBeGreaterThan(0));
  });

  it('renders ▬ when rank_delta = 0', async () => {
    stubAuth();
    const summary = {
      ...SUMMARY_ONE_LEAGUE,
      per_league: [{ ...SUMMARY_ONE_LEAGUE.per_league[0], rank: 2, rank_delta: 0 }],
    };
    const Wrapper = makeWrapper(mockFetch(summary));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('▬')).toBeTruthy());
    expect(screen.getByText('▬')).toBeTruthy();
  });

  it('renders no delta badge when rank_delta is null', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('The Steele Spreadsheet')).toBeTruthy());
    expect(screen.queryByText('↑')).toBeFalsy();
    expect(screen.queryByText('↓')).toBeFalsy();
    expect(screen.queryByText('▬')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U17.3 — NextUpCard priority ladder
// ---------------------------------------------------------------------------

describe('DashboardPage — NextUpCard priority ladder', () => {
  it('shows Specials card when specials open + not submitted (priority 1)', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: false,
        specials_lock_at: '2026-06-15T15:00:00Z',
        upcoming_unpredicted: 0,
        next_match: null,
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText('Make your Specials picks')).toBeTruthy(),
    );
  });

  it('does not show Specials card when already submitted', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: true,
        specials_lock_at: '2026-06-15T15:00:00Z',
        upcoming_unpredicted: 0,
        next_match: null,
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/You.re all set/)).toBeTruthy());
    expect(screen.queryByText('Make your Specials picks')).toBeFalsy();
  });

  it('shows match predict CTA when next_match unpredicted (priority 2)', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: true,
        specials_lock_at: null,
        upcoming_unpredicted: 1,
        next_match: {
          id: 'm1',
          kickoff_utc: new Date(Date.now() + 3_600_000).toISOString(),
          home_label: 'Brazil',
          away_label: 'Mexico',
          predicted: false,
        },
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Predict now')).toBeTruthy());
    expect(screen.queryByText(/Brazil/)).toBeTruthy();
  });

  it('shows "N matches open" when upcoming_unpredicted > 1 (priority 3)', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: true,
        specials_lock_at: null,
        upcoming_unpredicted: 5,
        next_match: null,
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('5 matches open to predict')).toBeTruthy());
  });

  it('shows calm all-done state when nothing to action (priority 4)', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: true,
        specials_lock_at: null,
        upcoming_unpredicted: 0,
        next_match: null,
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/You.re all set/)).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// U17.4 — ResultsRollupCard
// ---------------------------------------------------------------------------

describe('DashboardPage — ResultsRollupCard', () => {
  it('shows placeholder text pre-tournament (rollup=null)', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Your points and match results will appear here/)).toBeTruthy(),
    );
    // Zone is announced by the consistent "Results" section header
    expect(screen.queryByText('Results')).toBeTruthy();
  });

  it('shows collapsed rollup header when rollup present', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    // Wait for the points total to appear (data-specific, not the always-present header)
    await waitFor(() => expect(screen.queryByText(/\+10/)).toBeTruthy());
    expect(screen.queryByText(/2 matches/)).toBeTruthy();
  });

  it('expands per-match rows on click', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    // Wait for the points total — confirms real data loaded, not just the placeholder
    await waitFor(() => expect(screen.queryByText(/\+10/)).toBeTruthy());

    const expandBtn = screen.getByRole('button', { name: /Latest Results/i });
    fireEvent.click(expandBtn);

    await waitFor(() => expect(screen.queryByText(/Brazil/)).toBeTruthy());
    expect(screen.queryByText(/Argentina/)).toBeTruthy();
  });

  it('shows the league movement impact line when rollup is expanded', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_TWO_LEAGUES, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10/)).toBeTruthy());

    const expandBtn = screen.getByRole('button', { name: /Latest Results/i });
    fireEvent.click(expandBtn);

    // Both leagues had movement triggered by match-1 which is in the rollup;
    // at least one element (rollup impact or summary line) contains the text
    await waitFor(() =>
      expect(screen.queryAllByText(/↑2 The Steele Spreadsheet/).length).toBeGreaterThan(0),
    );
  });
});

// ---------------------------------------------------------------------------
// U17.5 — Cross-league movement summary
// ---------------------------------------------------------------------------

describe('DashboardPage — cross-league movement summary', () => {
  it('shows movement summary when ≥2 leagues with real movement', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_TWO_LEAGUES));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Across your leagues:/)).toBeTruthy(),
    );
    expect(screen.queryByText(/↑2 The Steele Spreadsheet/)).toBeTruthy();
  });

  it('omits movement summary for single league', async () => {
    stubAuth();
    const summary = {
      ...SUMMARY_ONE_LEAGUE,
      per_league: [{ ...SUMMARY_ONE_LEAGUE.per_league[0], rank_delta: 3 }],
    };
    const Wrapper = makeWrapper(mockFetch(summary));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('The Steele Spreadsheet')).toBeTruthy());
    expect(screen.queryByText(/Across your leagues:/)).toBeFalsy();
  });

  it('omits movement summary when no movement in any league', async () => {
    stubAuth();
    const summary = {
      ...SUMMARY_TWO_LEAGUES,
      per_league: SUMMARY_TWO_LEAGUES.per_league.map((e) => ({ ...e, rank_delta: 0 })),
    };
    const Wrapper = makeWrapper(mockFetch(summary));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('The Steele Spreadsheet')).toBeTruthy());
    expect(screen.queryByText(/Across your leagues:/)).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U17.6 — Adaptive ordering
// ---------------------------------------------------------------------------

describe('DashboardPage — ordering', () => {
  it('pre-tournament: rollup placeholder and NextUpCard both present', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Make your Specials picks')).toBeTruthy());
    expect(screen.queryByText('Results')).toBeTruthy();
    expect(screen.queryByText(/Your points and match results will appear here/)).toBeTruthy();
  });

  it('post-result: rollup shows real data, NextUpCard present below', async () => {
    stubAuth();
    const home = { ...HOME_WITH_ROLLUP };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, home));
    render(<Wrapper />);
    // Wait for rollup data to load (points total confirms real data, not placeholder)
    await waitFor(() => expect(screen.queryByText(/\+10/)).toBeTruthy());
    // NextUpCard also shows (all-done state since no upcoming)
    expect(screen.queryByText(/You.re all set/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// U17 — PointsBreakdownRow unit (shared component)
// ---------------------------------------------------------------------------

describe('PointsBreakdownRow', () => {
  it('shows checkmarks and values for positive breakdown fields', () => {
    render(
      <PointsBreakdownRow breakdown={{ result: 3, goals: 2, exact: 0, total: 5 }} />,
    );
    expect(screen.getByText('Result')).toBeTruthy();
    expect(screen.getByText('+3')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
    // Exact is 0 — shows —
    expect(screen.getByText('Exact')).toBeTruthy();
    expect(screen.getByText('5 pts')).toBeTruthy();
  });

  it('shows — for zero breakdown fields', () => {
    render(
      <PointsBreakdownRow breakdown={{ result: 0, goals: 0, exact: 0, total: 0 }} />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(3);
  });
});
