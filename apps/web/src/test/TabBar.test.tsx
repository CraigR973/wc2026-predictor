import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HTMLAttributes, ReactNode } from 'react';
import { TabBar } from '@/components/TabBar';

vi.mock('framer-motion', () => ({
  motion: {
    span: ({
      children,
      layoutId: _layoutId,
      transition: _transition,
      ...props
    }: HTMLAttributes<HTMLSpanElement> & { layoutId?: string; transition?: unknown }) => (
      <span {...props}>{children}</span>
    ),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    player: { id: 'p1', displayName: 'Alice', role: 'player', timezone: 'UTC' },
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

describe('TabBar mobile positioning', () => {
  it('scrolls with the page instead of sticking to the viewport', () => {
    const { container } = render(
      <MemoryRouter>
        <TabBar />
      </MemoryRouter>,
    );

    const nav = container.querySelector('nav[aria-label="Primary"]');

    expect(nav?.className).toContain('w-full');
    expect(nav?.className).toContain('shrink-0');
    expect(nav?.className).not.toContain('fixed');
    expect(nav?.className).not.toContain('bottom-0');
    expect(nav?.className).not.toContain('inset-x-0');
  });
});
