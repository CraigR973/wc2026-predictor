import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AboutPage } from '@/pages/AboutPage';
import { markRulesRead } from '@/lib/checklist';

vi.mock('@/lib/checklist', () => ({
  markRulesRead: vi.fn(),
}));

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
  it('shows the scroll cue and end-of-rules CTA', () => {
    renderAboutPage();

    expect(screen.getByText(/scroll for the full rules/i)).toBeTruthy();
    expect(screen.getByText(/that's everything\./i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /set your specials/i })).toBeTruthy();
  });

  it('does not mark rules read on mount, only when the end sentinel is reached', () => {
    renderAboutPage();

    expect(markRulesRead).not.toHaveBeenCalled();

    MockIntersectionObserver.lastInstance?.trigger(true);

    expect(markRulesRead).toHaveBeenCalledOnce();
  });
});
