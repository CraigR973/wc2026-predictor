import { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLeagueOptional } from '@/contexts/LeagueContext';
import { Brand } from '@/components/Brand';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const DESKTOP_NAV = [
  { to: '/', label: 'Home', exact: true },
  { to: '/schedule', label: 'Schedule', exact: false },
  { to: '/predictions', label: 'Predict', exact: false },
  { to: '/bracket', label: 'Bracket', exact: false },
  { to: '/groups', label: 'Groups', exact: false },
  { to: '/leaderboard', label: 'Standings', exact: false },
  { to: '/compare', label: 'Compare', exact: false },
  { to: '/settings', label: 'Settings', exact: false },
  { to: '/about', label: 'About', exact: false },
];

function LeagueSwitcher() {
  const leagueCtx = useLeagueOptional();
  if (!leagueCtx) return null;
  const { leagues, activeLeague, setActiveLeague } = leagueCtx;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (leagues.length === 0) return null;

  function handleSelect(slug: string) {
    setActiveLeague(slug);
    setOpen(false);
    navigate(`/leagues/${slug}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium font-sans tracking-tight transition-colors press-down',
          'focus-visible:outline-none focus-visible:shadow-glow',
          'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
          'max-w-[160px]',
        )}
        aria-label="Switch league"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{activeLeague?.name ?? 'Leagues'}</span>
        <svg
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div className="fixed inset-0 z-dropdown" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className={cn(
              'absolute left-0 top-full mt-1 z-dropdown',
              'min-w-[180px] rounded-md border border-border bg-surface shadow-lg',
              'py-1',
            )}
          >
            {leagues.map((l) => (
              <button
                key={l.slug}
                role="option"
                aria-selected={l.slug === activeLeague?.slug}
                onClick={() => handleSelect(l.slug)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm font-sans transition-colors',
                  'hover:bg-surface-elevated focus-visible:bg-surface-elevated',
                  l.slug === activeLeague?.slug
                    ? 'text-primary font-medium'
                    : 'text-text-primary',
                )}
              >
                <span className="flex items-center gap-2">
                  {l.slug === activeLeague?.slug && (
                    <svg className="h-3 w-3 text-primary shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                  {l.slug !== activeLeague?.slug && <span className="w-3" />}
                  <span className="truncate">{l.name}</span>
                </span>
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            <button
              onClick={() => { setOpen(false); navigate('/leagues/new'); }}
              className="w-full text-left px-3 py-2 text-sm font-sans text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              + Create league
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/leagues/discover'); }}
              className="w-full text-left px-3 py-2 text-sm font-sans text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              Browse leagues
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar() {
  const { player } = useAuth();

  return (
    <header
      className={cn(
        'sticky top-0 z-header',
        'bg-surface/90 backdrop-blur-md border-b border-border',
        'pt-safe',
      )}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <NavLink to="/" aria-label="Home" className="press-down">
            <Brand variant="compact" />
          </NavLink>
          <LeagueSwitcher />
        </div>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {DESKTOP_NAV.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-sm text-sm font-medium font-sans tracking-tight transition-colors press-down',
                  'focus-visible:outline-none focus-visible:shadow-glow',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
                )
              }
            >
              {label}
            </NavLink>
          ))}
          {player?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'ml-2 px-3 py-1.5 rounded-sm text-sm font-medium font-sans tracking-tight transition-colors press-down',
                  'focus-visible:outline-none focus-visible:shadow-glow',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-accent/80 hover:text-accent hover:bg-surface-elevated',
                )
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {player?.role === 'admin' && (
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-mono uppercase tracking-[0.2em]">
              Admin
            </span>
          )}
          {player && (
            <NavLink
              to="/settings"
              aria-label={`Your profile (${player.displayName})`}
              className="inline-flex items-center gap-2 press-down rounded-full focus-visible:outline-none focus-visible:shadow-glow"
            >
              <span className="hidden sm:inline text-sm text-text-secondary font-sans">
                {player.displayName}
              </span>
              <Avatar name={player.displayName} size="sm" />
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
