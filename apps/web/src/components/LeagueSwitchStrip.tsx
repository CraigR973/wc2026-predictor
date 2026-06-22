import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLeague } from '@/contexts/LeagueContext';
import { cn } from '@/lib/utils';
import { setLastViewedLeague } from '@/lib/leagueRecency';

interface Props {
  currentSlug: string;
  className?: string;
}

export function LeagueSwitchStrip({ currentSlug, className }: Props) {
  const { leagues } = useLeague();
  const currentLeague = leagues.find((league) => league.slug === currentSlug) ?? null;

  useEffect(() => {
    if (!currentLeague) return;
    setLastViewedLeague({ slug: currentLeague.slug, name: currentLeague.name });
  }, [currentLeague]);

  if (leagues.length < 2) return null;

  return (
    <div className={cn('space-y-2', className)} data-testid="league-switch-strip">
      <p className="px-0.5 text-[10px] font-mono uppercase tracking-[0.22em] text-text-muted">
        Your leagues
      </p>
      <nav className="-mx-4 overflow-x-auto sm:mx-0" aria-label="Switch league">
        <div className="flex min-w-max gap-2 px-4 sm:px-0">
          {leagues.map((league) => {
            const isCurrent = league.slug === currentSlug;
            return isCurrent ? (
              <span
                key={league.slug}
                aria-current="page"
                className={cn(
                  'inline-flex max-w-[13rem] items-center rounded-full border px-3.5 py-1.5 text-xs font-medium font-sans whitespace-nowrap',
                  'border-primary/30 bg-primary/15 text-primary',
                )}
                title={league.name}
              >
                <span className="truncate">{league.name}</span>
              </span>
            ) : (
              <Link
                key={league.slug}
                to={`/leagues/${league.slug}/leaderboard`}
                className={cn(
                  'inline-flex max-w-[13rem] items-center rounded-full border px-3.5 py-1.5 text-xs font-medium font-sans whitespace-nowrap transition-colors press-down',
                  'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary hover:bg-surface-elevated',
                  'focus-visible:outline-none focus-visible:shadow-glow',
                )}
                title={`Open ${league.name}`}
              >
                <span className="truncate">{league.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
