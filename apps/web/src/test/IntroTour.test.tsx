import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { IntroTour, isTourSeen } from '@/components/IntroTour';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('IntroTour', () => {
  it('renders the first slide title', () => {
    render(<IntroTour onClose={vi.fn()} />);
    expect(screen.getByText(/how scoring stacks/i)).toBeTruthy();
  });

  it('advances to next slide on Next click', () => {
    render(<IntroTour onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/predict before kickoff/i)).toBeTruthy();
  });

  it('sets localStorage flag and calls onClose when Get started clicked', () => {
    const onClose = vi.fn();
    render(<IntroTour onClose={onClose} />);
    // Advance to last slide
    const next = screen.getByRole('button', { name: /next/i });
    fireEvent.click(next);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Now on last slide
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(isTourSeen()).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sets localStorage flag and calls onClose when Skip clicked', () => {
    const onClose = vi.fn();
    render(<IntroTour onClose={onClose} />);
    // 'Skip' (footer button) vs 'Skip tour' (X icon button) — use exact string
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(isTourSeen()).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows skip button only on non-final slides', () => {
    render(<IntroTour onClose={vi.fn()} />);
    // On slide 1, Skip button should be visible (footer 'Skip', distinct from 'Skip tour' X button)
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeTruthy();
    // Advance to last slide (slide 4)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.getByRole('button', { name: /get started/i })).toBeTruthy();
  });
});
