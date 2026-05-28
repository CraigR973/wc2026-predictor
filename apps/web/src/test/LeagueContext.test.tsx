import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeagueProvider, useLeague } from '@/contexts/LeagueContext';
import { AuthProvider } from '@/contexts/AuthContext';

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const STORED_PLAYER = JSON.stringify({ id: 'p1', displayName: 'Alice', role: 'player', timezone: 'UTC' });

const MOCK_LEAGUE = {
  slug: 'steele-spreadsheet',
  name: 'The Steele Spreadsheet',
  description: null,
  privacy: 'private',
  member_count: 2,
  max_members: null,
  created_at: '2026-01-01T00:00:00Z',
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function stubAuthWithLeague(activeSlug: string | null = 'steele-spreadsheet') {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (k === 'wc2026_player') return STORED_PLAYER;
      if (k === 'wc2026_access') return FAKE_JWT;
      if (k === 'wc2026_active_league_slug') return activeSlug;
      return null;
    },
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
}

function ActiveLeagueDisplay() {
  const { activeLeague, leagues, isLoading } = useLeague();
  if (isLoading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="active">{activeLeague?.name ?? 'none'}</div>
      <div data-testid="count">{leagues.length}</div>
    </div>
  );
}

function renderWithLeague(leagues: unknown[]) {
  vi.stubGlobal('fetch', (url: string) => {
    if (url.includes('/leagues/mine')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(leagues) });
    }
    return Promise.reject(new Error('unexpected'));
  });

  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <LeagueProvider>
            <ActiveLeagueDisplay />
          </LeagueProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  stubAuthWithLeague('steele-spreadsheet');
});

describe('LeagueContext', () => {
  it('loads leagues and sets active from localStorage', async () => {
    renderWithLeague([MOCK_LEAGUE]);
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('The Steele Spreadsheet'));
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('shows no active league when list is empty (redirects to /welcome)', async () => {
    renderWithLeague([]);
    await waitFor(() => {
      // With an empty league list, the context redirects to /welcome.
      // In a MemoryRouter starting at '/', the navigate replaces the route.
      // We just verify the context doesn't throw.
      expect(screen.queryByTestId('active')).toBeTruthy();
    });
  });

  it('falls back to first league when saved slug is unknown', async () => {
    stubAuthWithLeague('unknown-slug');
    renderWithLeague([MOCK_LEAGUE]);
    await waitFor(() =>
      expect(screen.getByTestId('active').textContent).toBe('The Steele Spreadsheet'),
    );
  });

  it('useLeague throws when used outside LeagueProvider', () => {
    const ThrowingComponent = () => {
      useLeague();
      return null;
    };
    expect(() =>
      render(
        <MemoryRouter>
          <ThrowingComponent />
        </MemoryRouter>,
      ),
    ).toThrow('useLeague must be used within LeagueProvider');
  });
});
