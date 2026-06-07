import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
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
        kickoff_utc: '2026-06-11T18:00:00Z',
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
        kickoff_utc: '2026-06-11T21:00:00Z',
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

// localStorage stub. By default the pre-tournament checklist (U20.4) is marked
// dismissed so it stays out of the way of the dashboard-zone assertions — and so
// the urgent-zone Specials fallback, gated behind checklist resolution (U20.5),
// can surface. Checklist-specific tests pass { checklistDismissed: false }.
function stubAuth({ checklistDismissed = true }: { checklistDismissed?: boolean } = {}) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (k === 'wc2026_player') return STORED_PLAYER;
      if (k === 'wc2026_access') return FAKE_JWT;
      if (k === 'sss_checklist_v1') {
        return checklistDismissed ? '{"rulesRead":true,"dismissed":true}' : null;
      }
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

function mockFetch(
  summary: object,
  home: object = HOME_EMPTY,
  predictions: unknown[] = [],
  matches: unknown[] = [],
) {
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
    if (url.includes('/api/v1/matches')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(matches) });
    }
    if (url.includes('/predictions/me')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(predictions) });
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
    await waitFor(() => expect(screen.queryByText('Welcome back, Alice')).toBeTruthy());
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

  it('shows the next-match chip instead of a rank label', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('87')).toBeTruthy());
    // The old "next lock in" hero line was replaced by the match chip (U20 v2).
    expect(screen.queryByText(/next lock in/)).toBeFalsy();
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
// U20 v2 — Hero match chip (live → next → last) + To-do zone removed
// ---------------------------------------------------------------------------

function buildMatch(
  id: string,
  status: string,
  kickoffOffsetMs: number,
  scores?: { hs: number; as: number },
) {
  return {
    id,
    match_number: 1,
    stage: 'group',
    group_id: 'g',
    home_team: { id: 'h', name: 'Spain', code: 'ESP', flag_emoji: '🇪🇸' },
    away_team: { id: 'a', name: 'Italy', code: 'ITA', flag_emoji: '🇮🇹' },
    home_team_placeholder: null,
    away_team_placeholder: null,
    kickoff_utc: new Date(Date.now() + kickoffOffsetMs).toISOString(),
    venue: null,
    status,
    actual_home_score: scores?.hs ?? null,
    actual_away_score: scores?.as ?? null,
    extra_time: false,
    penalties: false,
    postponed_reason: null,
    elapsed_minutes: null,
  };
}

function buildPrediction(matchId: string, ph: number, pa: number) {
  return {
    id: `pred-${matchId}`,
    player_id: 'p1',
    match_id: matchId,
    predicted_home: ph,
    predicted_away: pa,
    submitted_at: '2026-06-11T00:00:00Z',
    update_count: 1,
    points_awarded: null,
    points_breakdown: null,
    updated_at: '2026-06-11T00:00:00Z',
  };
}

describe('DashboardPage — hero inline slot + live hub (U27)', () => {
  it('shows the live hub (not a corner chip) when a match is in play', async () => {
    stubAuth();
    const matches = [buildMatch('m1', 'live', -600_000, { hs: 1, as: 0 })];
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, [], matches));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByTestId('live-hub')).toBeTruthy());
    expect(screen.getByText('Live now')).toBeTruthy();
    expect(screen.getByTestId('live-match-card').textContent).toMatch(/1.0/); // "1–0"
    // The old live corner chip is gone (U27.1).
    expect(screen.queryByTestId('hero-chip-live')).toBeFalsy();
  });

  it('computes provisional "points if this stands" via the shared scoring logic', async () => {
    stubAuth();
    const matches = [buildMatch('m1', 'live', -600_000, { hs: 1, as: 0 })];
    const predictions = [buildPrediction('m1', 1, 0)]; // exact match → 2+3+5 = 10
    const Wrapper = makeWrapper(
      mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, predictions, matches),
    );
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByTestId('live-match-card')).toBeTruthy());
    const card = screen.getByTestId('live-match-card');
    expect(card.textContent).toMatch(/You:/);
    expect(card.textContent).toMatch(/Points if this stands:/);
    expect(card.textContent).toMatch(/10/);
  });

  it('shows "not predicted" and no points row for a live match without a prediction', async () => {
    stubAuth();
    const matches = [buildMatch('m1', 'live', -600_000, { hs: 2, as: 2 })];
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, [], matches));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByTestId('live-match-card')).toBeTruthy());
    const card = screen.getByTestId('live-match-card');
    expect(card.textContent).toMatch(/not predicted/);
    expect(card.textContent).not.toMatch(/Points if this stands/);
  });

  it('renders one card per live match (responsive multi-card hub)', async () => {
    stubAuth();
    const matches = [
      buildMatch('m1', 'live', -600_000, { hs: 1, as: 0 }),
      buildMatch('m2', 'live', -300_000, { hs: 0, as: 0 }),
    ];
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, [], matches));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryAllByTestId('live-match-card').length).toBe(2));
  });

  it('shows the inline next slot with a countdown when nothing is live', async () => {
    stubAuth();
    const matches = [buildMatch('m1', 'scheduled', 1_800_000)];
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, [], matches));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByTestId('hero-chip-next')).toBeTruthy());
    const slot = screen.getByTestId('hero-chip-next');
    expect(slot.textContent).toMatch(/ESP/);
    expect(slot.textContent).toMatch(/in /);
    expect(screen.queryByTestId('live-hub')).toBeFalsy();
  });

  it('falls back to the last result inline when nothing is live or upcoming', async () => {
    stubAuth();
    const matches = [buildMatch('m1', 'completed', -3_600_000, { hs: 2, as: 1 })];
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, [], matches));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByTestId('hero-chip-last')).toBeTruthy());
    expect(screen.getByTestId('hero-chip-last').textContent).toMatch(/2.1/); // "2–1"
  });

  it('shows the live hub AND the inline next slot together (live no longer suppresses next)', async () => {
    stubAuth();
    const matches = [
      buildMatch('m1', 'completed', -3_600_000, { hs: 2, as: 1 }),
      buildMatch('m2', 'scheduled', 1_800_000),
      buildMatch('m3', 'live', -600_000, { hs: 0, as: 0 }),
    ];
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, [], matches));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByTestId('live-hub')).toBeTruthy());
    // Inline slot prefers the upcoming match; the completed one is suppressed.
    expect(screen.queryByTestId('hero-chip-next')).toBeTruthy();
    expect(screen.queryByTestId('hero-chip-last')).toBeFalsy();
  });

  it('shows no inline slot and no live hub when there are no group matches', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP, [], []));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10 pts/)).toBeTruthy());
    expect(screen.queryByTestId('live-hub')).toBeFalsy();
    expect(screen.queryByTestId('hero-chip-next')).toBeFalsy();
    expect(screen.queryByTestId('hero-chip-last')).toBeFalsy();
  });

  it('renders no To-do section (removed in U20 v2)', async () => {
    stubAuth();
    const home = {
      todo: {
        specials_submitted: false,
        specials_lock_at: '2026-06-15T15:00:00Z',
        upcoming_unpredicted: 5,
        next_match: {
          id: 'm1',
          kickoff_utc: new Date(Date.now() + 1_800_000).toISOString(),
          home_label: 'Brazil',
          away_label: 'Mexico',
          predicted: false,
        },
      },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
    expect(screen.queryByText('To-do')).toBeFalsy();
    expect(screen.queryByText('Make your Specials picks')).toBeFalsy();
    expect(screen.queryByText('Predict now')).toBeFalsy();
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
// U20.1 — Results roll-up, folded into the hero
// ---------------------------------------------------------------------------

describe('DashboardPage — results roll-up (in hero)', () => {
  it('shows the pre-tournament nudge and no results delta when rollup is null', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Your tally starts when the first results land/)).toBeTruthy(),
    );
    // No tappable results delta exists until the first results land.
    expect(screen.queryByRole('button', { name: /Latest results/i })).toBeFalsy();
    expect(screen.queryByText(/\+10 pts/)).toBeFalsy();
  });

  it('shows the collapsed delta line (+pts · matchday, no match count) when rollup present', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10 pts/)).toBeTruthy());
    expect(screen.queryByText(/11 Jun/)).toBeTruthy();
    // Match count lives only in the aria-label / expanded rows now, not the line.
    expect(screen.queryByText(/2 matches/)).toBeFalsy();
    // The expand control keeps its "Latest results" accessible name.
    expect(screen.queryByRole('button', { name: /Latest results/i })).toBeTruthy();
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

  it('shows daily-summary league movement always-visible, without tapping (U27.3)', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_TWO_LEAGUES, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10 pts/)).toBeTruthy());

    // Movement is rendered without expanding the rollup.
    const movement = screen.getByTestId('daily-movement');
    expect(movement.textContent).toMatch(/↑2 The Steele Spreadsheet/);
    expect(movement.textContent).toMatch(/↓1 Office Pool/);
  });

  it('expanded rows show prominent score, a prediction pill, and kickoff date/time (U27.4)', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10 pts/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Latest Results/i }));

    await waitFor(() => expect(screen.queryByText(/Brazil/)).toBeTruthy());
    // Prediction rendered as a distinct "you 2–1" pill (match-1).
    expect(screen.queryByText(/you 2.1/)).toBeTruthy();
    // Kickoff date/time from kickoff_utc (U27.B2) — matches kick off 11 Jun.
    expect(screen.queryAllByText(/11 Jun/).length).toBeGreaterThan(0);
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
// U20 — Section ordering and self-hiding
// ---------------------------------------------------------------------------

describe('DashboardPage — ordering and self-hiding', () => {
  it('pre-tournament: greeting + results nudge present, no To-do section', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() =>
      expect(screen.queryByText(/Your tally starts when the first results land/)).toBeTruthy(),
    );
    expect(screen.queryByText('Welcome back, Alice')).toBeTruthy();
    expect(screen.queryByText('To-do')).toBeFalsy();
  });

  it('post-result: results delta shows, no To-do section', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/\+10 pts/)).toBeTruthy());
    expect(screen.queryByText('To-do')).toBeFalsy();
  });

  it('orders the zones: hero greeting, folded results delta, leagues — no how-it-works card', async () => {
    stubAuth();
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ONE_LEAGUE, HOME_WITH_ROLLUP));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('The Steele Spreadsheet')).toBeTruthy());
    expect(screen.queryByText(/Welcome back,/)).toBeTruthy();
    expect(screen.queryByText(/\+10 pts/)).toBeTruthy();
    expect(screen.queryByText('My Leagues')).toBeTruthy();
    // How-it-works card was removed in U20.3.
    expect(screen.queryByRole('button', { name: /How it works/i })).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U20.4 — Pre-tournament checklist
// ---------------------------------------------------------------------------

describe('DashboardPage — Pre-tournament checklist', () => {
  it('renders the three setup items', async () => {
    stubAuth({ checklistDismissed: false });
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Pre-Tournament Checklist')).toBeTruthy());
    expect(screen.queryByText('Read the rules')).toBeTruthy();
    expect(screen.queryByText('Submit your Specials picks')).toBeTruthy();
    expect(screen.queryByText('Predict your first match')).toBeTruthy();
  });

  it('reflects specials_submitted by striking the Specials item', async () => {
    stubAuth({ checklistDismissed: false });
    const home = {
      todo: { specials_submitted: true, specials_lock_at: null, upcoming_unpredicted: 0, next_match: null },
      rollup: null,
    };
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, home));
    render(<Wrapper />);
    // Submitted → the item label is struck through (done) once home loads.
    await waitFor(() =>
      expect(screen.getByText('Submit your Specials picks').className).toMatch(/line-through/),
    );
    // No first prediction yet → that item is not struck through.
    expect(screen.getByText('Predict your first match').className).not.toMatch(/line-through/);
  });

  it('does not auto-tick "Read the rules" when the row link is clicked', async () => {
    stubAuth({ checklistDismissed: false });
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Pre-Tournament Checklist')).toBeTruthy());

    // Clicking the row should navigate, but completion now comes from reading
    // the About page to the sentinel rather than this click.
    fireEvent.click(screen.getByText('Read the rules'));

    expect(screen.getByText('Read the rules').className).not.toMatch(/line-through/);
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'sss_checklist_v1',
      expect.stringContaining('"rulesRead":true'),
    );
  });

  it('disappears when dismissed, persisting the latch', async () => {
    stubAuth({ checklistDismissed: false });
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText('Pre-Tournament Checklist')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.queryByText('Pre-Tournament Checklist')).toBeFalsy());
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'sss_checklist_v1',
      expect.stringContaining('"dismissed":true'),
    );
  });

  it('is absent when previously dismissed (sss_checklist_v1 dismissed=true)', async () => {
    stubAuth({ checklistDismissed: true });
    const Wrapper = makeWrapper(mockFetch(SUMMARY_ZERO, HOME_EMPTY));
    render(<Wrapper />);
    await waitFor(() => expect(screen.queryByText(/Your tally starts/)).toBeTruthy());
    expect(screen.queryByText('Pre-Tournament Checklist')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// U27.7 — Accessibility (live hub + hero)
// ---------------------------------------------------------------------------

describe('DashboardPage — accessibility (U27)', () => {
  it('has no axe violations with the live hub, inline slot and daily summary rendered', async () => {
    stubAuth();
    const matches = [
      buildMatch('m1', 'live', -600_000, { hs: 1, as: 0 }),
      buildMatch('m2', 'scheduled', 1_800_000),
    ];
    const predictions = [buildPrediction('m1', 1, 0)];
    const Wrapper = makeWrapper(
      mockFetch(SUMMARY_TWO_LEAGUES, HOME_WITH_ROLLUP, predictions, matches),
    );
    const { container } = render(<Wrapper />);
    await waitFor(() => expect(screen.queryByTestId('live-hub')).toBeTruthy());
    // jsdom cannot evaluate CSS custom properties, so colour-contrast is off;
    // every other axe rule runs at full severity.
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results).toHaveNoViolations();
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
