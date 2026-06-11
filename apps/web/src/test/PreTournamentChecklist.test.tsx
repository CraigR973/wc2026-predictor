import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreTournamentChecklist } from '@/components/PreTournamentChecklist';

// Control the push subscription state (and keep the modal's hook in sync).
const mockPush = {
  permission: 'default' as 'default' | 'granted' | 'denied',
  isSubscribed: false,
  isLoading: false,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};
vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => mockPush,
}));

// The checklist fetches the player's predictions; keep it empty.
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(() => Promise.resolve([])),
}));

/** Toggle installed-PWA (standalone) detection. */
function setStandalone(on: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: on && query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

type Props = {
  hasLeague?: boolean;
  specialsCount?: number;
  firstMatchPredicted?: boolean;
  tournamentStarted?: boolean;
  kickoffIso?: string | null;
};

function renderChecklist(props: Props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PreTournamentChecklist
          hasLeague={props.hasLeague ?? false}
          specialsCount={props.specialsCount ?? 0}
          firstMatchPredicted={props.firstMatchPredicted ?? false}
          tournamentStarted={props.tournamentStarted ?? false}
          kickoffIso={props.kickoffIso ?? null}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Matches the intro paragraph even though the count is an interpolated node. */
function introHas(re: RegExp): boolean {
  return (
    screen.queryAllByText((_, el) => el?.tagName === 'P' && re.test(el.textContent ?? '')).length > 0
  );
}

beforeEach(() => {
  localStorage.clear();
  mockPush.isSubscribed = false;
  setStandalone(false);
});

describe('PreTournamentChecklist', () => {
  it('renders the four base steps and hides match alerts in a browser', () => {
    renderChecklist();
    expect(screen.getByText('Join or create a league')).toBeInTheDocument();
    expect(screen.getByText('Read the rules')).toBeInTheDocument();
    expect(screen.getByText('Submit your Specials picks')).toBeInTheDocument();
    expect(screen.getByText('Predict your first match')).toBeInTheDocument();
    expect(screen.queryByText('Turn on match alerts')).toBeNull();
    expect(introHas(/55 pts/)).toBe(true);
  });

  it('adds the match-alerts step (five things) when installed', () => {
    setStandalone(true);
    renderChecklist();
    expect(screen.getByText('Turn on match alerts')).toBeInTheDocument();
    expect(introHas(/55 pts/)).toBe(true);
  });

  it('ticks match alerts when already subscribed', () => {
    setStandalone(true);
    mockPush.isSubscribed = true;
    renderChecklist();
    expect(screen.getByText('Turn on match alerts').className).toContain('line-through');
  });

  it('opens the enable prompt when match alerts is tapped', () => {
    setStandalone(true);
    renderChecklist();
    fireEvent.click(screen.getByRole('button', { name: /turn on match alerts/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ticks "Join or create a league" once the user is in a league', () => {
    renderChecklist({ hasLeague: true });
    expect(screen.getByText('Join or create a league').className).toContain('line-through');
  });

  it('shows a kickoff countdown for a future opening match', () => {
    const future = new Date(Date.now() + 2 * 86_400_000 + 5 * 3_600_000 + 60_000).toISOString();
    renderChecklist({ kickoffIso: future });
    expect(screen.getByText(/2d 5h to kickoff/)).toBeInTheDocument();
  });

  it('renders nothing once the tournament has started', () => {
    const { container } = renderChecklist({ tournamentStarted: true });
    expect(container).toBeEmptyDOMElement();
  });
});
