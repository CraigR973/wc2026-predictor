/**
 * U14.6 — PlayerCombobox unit tests
 *
 * @radix-ui/react-popover uses portal + animation APIs that don't exist in
 * jsdom, so we mock it to render children inline. The cmdk Command/Input/List
 * components work fine in jsdom.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerCombobox } from '@/components/PlayerCombobox';
import * as api from '@/lib/api';

// ---------------------------------------------------------------------------
// Mock @radix-ui/react-popover — render children inline in jsdom
// ---------------------------------------------------------------------------
vi.mock('@radix-ui/react-popover', () => {
  const { useState, forwardRef } = require('react');
  const Root = ({ children, open: controlledOpen, onOpenChange }: any) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const handleOpenChange = (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    };
    return children({ open, onOpenChange: handleOpenChange });
  };
  // Trigger: passes open/onOpenChange down via render prop approach won't work
  // with the actual JSX. Use Context instead.
  const PopoverContext = require('react').createContext<any>({});
  const ActualRoot = ({ children, open: controlledOpen, onOpenChange }: any) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    };
    return (
      <PopoverContext.Provider value={{ open, setOpen }}>
        {children}
      </PopoverContext.Provider>
    );
  };
  const Trigger = forwardRef(({ children, asChild, ...rest }: any, ref: any) => {
    const { setOpen, open } = require('react').useContext(PopoverContext);
    const child = asChild ? children : <button {...rest} ref={ref}>{children}</button>;
    if (asChild) {
      return require('react').cloneElement(children, {
        onClick: (e: any) => {
          children.props.onClick?.(e);
          setOpen(!open);
        },
        ref,
      });
    }
    return <button {...rest} ref={ref} onClick={() => setOpen(!open)}>{children}</button>;
  });
  const Portal = ({ children }: any) => children;
  const Content = ({ children, ...rest }: any) => {
    const { open } = require('react').useContext(PopoverContext);
    if (!open) return null;
    return <div role="dialog" {...rest}>{children}</div>;
  };
  return { Root: ActualRoot, Trigger, Portal, Content };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HAALAND = {
  id: 'uuid-haaland',
  full_name: 'Erling Haaland',
  known_as: 'Haaland',
  position: 'FWD' as const,
  shirt_number: 9,
  team_code: 'NOR',
  team_name: 'Norway',
  flag_emoji: '🇳🇴',
};

const MBAPPE = {
  id: 'uuid-mbappe',
  full_name: 'Kylian Mbappé',
  known_as: 'Mbappé',
  position: 'FWD' as const,
  shirt_number: 10,
  team_code: 'FRA',
  team_name: 'France',
  flag_emoji: '🇫🇷',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCombobox(overrides: Partial<Parameters<typeof PlayerCombobox>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <PlayerCombobox
      value=""
      onChange={onChange}
      displayName=""
      aria-label="Golden Boot player"
      {...overrides}
    />,
  );
  return { onChange, ...utils };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlayerCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders trigger button with placeholder when no value', () => {
    renderCombobox();
    const btn = screen.getByRole('combobox', { name: /golden boot/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/Search for a player/);
  });

  it('shows displayName in trigger when value is set', () => {
    renderCombobox({ value: HAALAND.id, displayName: 'Erling Haaland' });
    expect(screen.getByRole('combobox')).toHaveTextContent('Erling Haaland');
  });

  it('is disabled when disabled prop is true', () => {
    renderCombobox({ disabled: true });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('opens search input when trigger is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    vi.useRealTimers();
    renderCombobox();

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByPlaceholderText(/Search for a player/)).toBeInTheDocument();
  });

  it('calls apiFetch after debounce and shows results', async () => {
    const fetchSpy = vi.spyOn(api, 'apiFetch').mockResolvedValue([HAALAND, MBAPPE]);
    const user = userEvent.setup({ delay: null });
    vi.useRealTimers();
    renderCombobox();

    await user.click(screen.getByRole('combobox'));
    const input = screen.getByPlaceholderText(/Search for a player/);
    await user.type(input, 'haa');

    // Wait for debounce + fetch
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce(), { timeout: 1000 });

    await waitFor(() => {
      expect(screen.getByText('Haaland')).toBeInTheDocument();
      expect(screen.getByText('Mbappé')).toBeInTheDocument();
    });
  });

  it('shows "No players found" when API returns empty array', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue([]);
    const user = userEvent.setup({ delay: null });
    vi.useRealTimers();
    renderCombobox();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText(/Search for a player/), 'zzz');

    await waitFor(() => {
      expect(screen.getByText(/no players found/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows error message when apiFetch rejects', async () => {
    vi.spyOn(api, 'apiFetch').mockRejectedValue(new Error('network error'));
    const user = userEvent.setup({ delay: null });
    vi.useRealTimers();
    renderCombobox();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText(/Search for a player/), 'err');

    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('calls onChange with id and full_name when a player is selected', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue([HAALAND]);
    const user = userEvent.setup({ delay: null });
    vi.useRealTimers();
    const { onChange } = renderCombobox();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText(/Search for a player/), 'haa');

    await waitFor(() => screen.getByText('Haaland'), { timeout: 1000 });

    await user.click(screen.getByText('Haaland'));

    expect(onChange).toHaveBeenCalledWith(HAALAND.id, HAALAND.full_name);
  });

  it('shows flag emoji and team code in results', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue([HAALAND]);
    const user = userEvent.setup({ delay: null });
    vi.useRealTimers();
    renderCombobox();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText(/Search for a player/), 'haa');

    await waitFor(() => {
      expect(screen.getByText('🇳🇴')).toBeInTheDocument();
      expect(screen.getByText('NOR')).toBeInTheDocument();
      expect(screen.getByText('FWD')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('does not call API when query is empty', async () => {
    const fetchSpy = vi.spyOn(api, 'apiFetch');
    const user = userEvent.setup({ delay: null });
    vi.useRealTimers();
    renderCombobox();

    // Open popover but don't type anything
    await user.click(screen.getByRole('combobox'));
    // Wait a moment to ensure no fetch fired
    await new Promise((r) => setTimeout(r, 400));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
