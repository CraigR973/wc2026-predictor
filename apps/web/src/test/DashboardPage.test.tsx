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
// U18.1 — GreetingHero (replaces StatStrip)
// ---------------------------------------------------------------------------

describe('DashboardPage — GreetingHero', () => {
  it('shows total_points in the hero', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('87')).toBeTruthy());
  });

  it('shows "Welcome back" greeting with player display name', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/Welcome back,/)).toBeTruthy());
    expect(screen.queryByText('Alice')).toBeTruthy();
  });

  it('does not show a Rank label in the hero', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('87')).toBeTruthy());
    expect(screen.queryByText('Rank')).toBeFalsy();
  });

  it('shows "0" in zero state (not hidden)', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows the zero-state nudge subline when total_points === 0', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Your tally starts when the first results land/)).toBeTruthy(),
    );
  });

  it('shows next-lock countdown when next_match is in the future', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: true,
        specials_lock_at: null,
        upcoming_unpredicted: 0,
        next_match: {
          id: 'm1',
          kickoff_utc: new Date(Date.now() + 7_200_000).toISOString(), // 2 h from now
          home_label: 'Brazil',
          away_label: 'Mexico',
          predicted: true,
        },
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, home));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/next lock in/)).toBeTruthy());
  });

  it('shows next-lock countdown from specials_lock_at when unsubmitted', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    // HOME_EMPTY has specials_lock_at set and !specials_submitted
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/next lock in/)).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// U16.2 — Zero / pre-tournament state (preserved)
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
    expect(screen.getByText('0')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// U18.2 — How it works collapsible
// ---------------------------------------------------------------------------

describe('DashboardPage — How it works collapsible', () => {
  it('is expanded by default and content is visible', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /How it works/i })).toBeTruthy(),
    );
    // Content region visible
    expect(screen.queryByRole('region', { name: /How it works/i })).toBeTruthy();
    expect(screen.queryByText(/Full rules/)).toBeTruthy();
  });

  it('toggle button has aria-expanded=true when expanded', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /How it works/i })).toBeTruthy(),
    );
    const btn = screen.getByRole('button', { name: /How it works/i });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('click collapses — content hidden, aria-expanded=false', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /How it works/i })).toBeTruthy(),
    );
    const btn = screen.getByRole('button', { name: /How it works/i });
    fireEvent.click(btn);
    expect(screen.queryByRole('region', { name: /How it works/i })).toBeFalsy();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('persists collapsed state to localStorage on collapse', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /How it works/i })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: /How it works/i }));
    expect(localStorage.setItem).toHaveBeenCalledWith('sss_howitworks_collapsed', '1');
  });

  it('persists expanded state to localStorage on expand', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /How it works/i })).toBeTruthy(),
    );
    const btn = screen.getByRole('button', { name: /How it works/i });
    fireEvent.click(btn); // collapse
    fireEvent.click(btn); // expand
    expect(localStorage.setItem).toHaveBeenCalledWith('sss_howitworks_collapsed', '0');
  });

  it('starts collapsed when localStorage has stored collapsed=true', async () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => {
        if (k === 'wc2026_player') return STORED_PLAYER;
        if (k === 'wc2026_access') return FAKE_JWT;
        if (k === 'sss_howitworks_collapsed') return '1';
        return null;
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /How it works/i })).toBeTruthy(),
    );
    expect(screen.queryByRole('region', { name: /How it works/i })).toBeFalsy();
    expect(
      screen.getByRole('button', { name: /How it works/i }).getAttribute('aria-expanded'),
    ).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// U18.3 — UrgentZone (replaces NextUpCard, minus the always-on P4 "all set")
// ---------------------------------------------------------------------------

describe('DashboardPage — UrgentZone priority ladder', () => {
  it('shows Specials CTA when specials open + not submitted (priority 1)', async () => {
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

  it('does not show Specials CTA when already submitted', async () => {
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
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
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

  it('renders nothing and hides the To-do section when nothing is urgent', async () => {
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
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
    expect(screen.queryByText('To-do')).toBeFalsy();
    expect(screen.queryByText(/You.re all set/)).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U18.4 — SpecialsStrip
// ---------------------------------------------------------------------------

describe('DashboardPage — SpecialsStrip', () => {
  it('shows "Specials picks submitted" when specials_submitted=true', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText('Specials picks submitted')).toBeTruthy(),
    );
  });

  it('shows Specials section header when strip is visible', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Specials picks submitted')).toBeTruthy());
    expect(screen.queryByText('Specials')).toBeTruthy();
  });

  it('hides strip when not submitted + lock open (UrgentZone handles the CTA instead)', async () => {
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
    await waitFor(() => expect(screen.queryByText('Make your Specials picks')).toBeTruthy());
    expect(screen.queryByText('Specials picks submitted')).toBeFalsy();
  });

  it('hides strip when no specials data at all', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: false,
        specials_lock_at: null,
        upcoming_unpredicted: 0,
        next_match: null,
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
    expect(screen.queryByText('Specials picks submitted')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U16.4 — Delta badge on CompactLeagueRow
// ---------------------------------------------------------------------------

describe('DashboardPage — delta badge', () => {
  it('renders ↑2 badge in league row when rank_delta = 2', async () => {
    stubAuth();
    const summary = {
      ...SUMMARY_ONE_LEAGUE,
      per_league: [{ ...SUMMARY_ONE_LEAGUE.per_league[0], rank_delta: 2 }],
    };
    const Wrapper = makeWrapper(mockFetch(summary));
    render(<Wrapper />);
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
    expect(screen.queryByText('Results')).toBeTruthy();
  });

  it('shows collapsed rollup header when rollup present', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10/)).toBeTruthy());
    expect(screen.queryByText(/2 matches/)).toBeTruthy();
  });

  it('expands per-match rows on click', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
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
// U18.6 — Section ordering and self-hiding
// ---------------------------------------------------------------------------

describe('DashboardPage — ordering and self-hiding', () => {
  it('pre-tournament: UrgentZone (specials CTA) and Results placeholder both present', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Make your Specials picks')).toBeTruthy());
    expect(screen.queryByText('Results')).toBeTruthy();
    expect(screen.queryByText(/Your points and match results will appear here/)).toBeTruthy();
  });

  it('post-result: rollup shows real data, UrgentZone self-hides when nothing urgent', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10/)).toBeTruthy());
    // UrgentZone: specials submitted, no upcoming → self-hides
    expect(screen.queryByText('To-do')).toBeFalsy();
    // SpecialsStrip: submitted → visible
    expect(screen.queryByText('Specials picks submitted')).toBeTruthy();
  });

  it('all zones ordered: how-it-works present, results present, leagues present', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('The Steele Spreadsheet')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /How it works/i })).toBeTruthy();
    expect(screen.queryByText('Results')).toBeTruthy();
    expect(screen.queryByText('Leagues')).toBeTruthy();
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
