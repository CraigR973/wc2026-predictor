import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AboutPage } from '@/pages/AboutPage';
import { markRulesRead } from '@/lib/checklist';

vi.mock('@/lib/checklist', () => ({
  markRulesRead: vi.fn(),
}));

// SpecialsForm makes live API calls — stub it out so About tests stay unit tests.
vi.mock('@/components/SpecialsForm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/SpecialsForm')>();
  return {
    ...actual,
    SpecialsForm: () => <div data-testid="specials-form-embed">specials-form-stub</div>,
  };
});

class MockIntersectionObserver {
  static lastInstance: MockIntersectionObserver | null = null;

  callback: IntersectionObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds = [0.6];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.lastInstance = this;
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          target: document.createElement('div'),
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

function renderAboutPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  MockIntersectionObserver.lastInstance = null;
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

describe('AboutPage rules completion', () => {
  it('shows the scroll cue and end-of-rules sentinel', () => {
    renderAboutPage();

    expect(screen.getByText(/scroll for the full rules/i)).toBeTruthy();
    expect(screen.getByText(/that's everything\./i)).toBeTruthy();
  });

  it('does not mark rules read on mount, only when the end sentinel is reached', () => {
    renderAboutPage();

    expect(markRulesRead).not.toHaveBeenCalled();

    MockIntersectionObserver.lastInstance?.trigger(true);

    expect(markRulesRead).toHaveBeenCalledOnce();
  });

  it('renders the tiebreak order in the rules', () => {
    renderAboutPage();

    expect(screen.getByText('How ties are broken')).toBeInTheDocument();
    expect(screen.getByText(/exact scores/i)).toBeInTheDocument();
    expect(screen.getByText(/correct results/i)).toBeInTheDocument();
    expect(screen.getByText(/correct goal totals/i)).toBeInTheDocument();
    expect(screen.getByText(/special predictions correct/i)).toBeInTheDocument();
    expect(screen.getByText(/knockout-winner picks correct/i)).toBeInTheDocument();
    expect(screen.getByText(/admin settles it manually/i)).toBeInTheDocument();
  });
});

describe('AboutPage U45 — multi-league hero', () => {
  it('renders the multi-league hero callout prominently at the top', () => {
    renderAboutPage();

    const hero = screen.getByTestId('about-multi-league-hero');
    expect(hero).toBeTruthy();
    expect(hero.textContent).toMatch(/predict once/i);
    expect(hero.textContent).toMatch(/compete in as many leagues/i);
  });

  it('does not use mates copy in the league explanation', () => {
    renderAboutPage();

    expect(screen.queryByText(/for your mates/i)).toBeNull();
  });
});

describe('AboutPage U45 — embedded Specials form', () => {
  it('renders the Specials section with correct heading and editable-until-kickoff copy', () => {
    renderAboutPage();

    const section = screen.getByTestId('about-specials-section');
    expect(section).toBeTruthy();
    expect(screen.getByRole('heading', { name: /your specials/i })).toBeTruthy();
    expect(section.textContent).toMatch(/worth up to 80 points/i);
  });

  it('embeds the SpecialsForm component', () => {
    renderAboutPage();

    expect(screen.getByTestId('specials-form-embed')).toBeTruthy();
  });
});
