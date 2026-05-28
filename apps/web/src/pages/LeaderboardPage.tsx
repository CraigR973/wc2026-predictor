import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ChevronDown, X } from 'lucide-react';
import { apiFetch, DEFAULT_LEAGUE_SLUG } from '../lib/api';
import type { LeaderboardEntry } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLeagueSlugSync } from '../contexts/LeagueContext';
import { useLongPress } from '../hooks/useLongPress';
import { dedupedLeaderboard } from '../lib/leaderboard';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { cn } from '../lib/utils';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const HINT_DISMISSED_KEY = 'sss_leaderboard_hint_dismissed';

interface RankDelta {
  direction: 'up' | 'down' | 'flat';
  delta: number;
}

function rankDelta(prev: number | undefined, curr: number): RankDelta {
  if (prev === undefined || prev === curr) return { direction: 'flat', delta: 0 };
  return prev > curr
    ? { direction: 'up', delta: prev - curr }
    : { direction: 'down', delta: curr - prev };
}

function ArrowGlyph({
  rank,
  shouldPulse,
  reduceMotion,
}: {
  rank: RankDelta;
  shouldPulse: boolean;
  reduceMotion: boolean;
}) {
  const cls =
    rank.direction === 'up'
      ? 'text-success'
      : rank.direction === 'down'
        ? 'text-error'
        : 'text-text-muted';
  const Icon =
    rank.direction === 'up' ? TrendingUp : rank.direction === 'down' ? TrendingDown : Minus;
  const label =
    rank.direction === 'flat'
      ? 'No change'
      : rank.direction === 'up'
        ? `Up ${rank.delta}`
        : `Down ${rank.delta}`;

  // U5.3: pulse on rank change. `shouldPulse` is true only when prevRank
  // existed AND differs from current rank — never on initial mount. Pulse
  // is suppressed entirely under reduced motion.
  const pulse = shouldPulse && !reduceMotion;

  return (
    <motion.span
      className={cn('inline-flex items-center gap-1 shrink-0', cls)}
      aria-label={label}
      data-testid="rank-arrow"
      data-pulsing={pulse ? 'true' : 'false'}
      initial={false}
      animate={
        pulse
          ? { scale: [1, 1.25, 1], filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'] }
          : { scale: 1, filter: 'brightness(1)' }
      }
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {rank.delta > 0 && (
        <span className="font-mono text-[10px] tabular-nums">{rank.delta}</span>
      )}
    </motion.span>
  );
}

interface RowProps {
  entry: LeaderboardEntry;
  prevRank: number | undefined;
  isOpen: boolean;
  isMe: boolean;
  reduceMotion: boolean;
  shouldPulse: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}

function LeaderboardRow({
  entry,
  prevRank,
  isOpen,
  isMe,
  reduceMotion,
  shouldPulse,
  onToggle,
  onLongPress,
}: RowProps) {
  const rd = rankDelta(prevRank, entry.rank);
  const handlers = useLongPress({ onLongPress, onClick: onToggle });

  return (
    <motion.tr
      layout={!reduceMotion}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      data-testid={`leaderboard-row-${entry.player_id}`}
      className={cn(
        'border-b border-border/50 last:border-0 cursor-pointer select-none',
        'hover:bg-surface-elevated transition-colors',
        isMe && 'bg-primary/5',
      )}
      {...handlers}
    >
      <td className="py-3.5 pl-4 sm:pl-5 w-8">
        <span className="text-text-muted font-mono text-sm tabular-nums">
          {MEDAL[entry.rank] ?? entry.rank}
        </span>
      </td>
      <td className="py-3.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">
            <ArrowGlyph rank={rd} shouldPulse={shouldPulse} reduceMotion={reduceMotion} />
          </span>
          <Link
            to={`/players/${entry.player_id}`}
            className={cn(
              'font-medium hover:text-primary transition-colors truncate min-w-0',
              isMe ? 'text-primary' : 'text-text-primary',
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {entry.player_name}
          </Link>
          {!entry.is_active && (
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-muted bg-surface-elevated border border-border px-1.5 py-0.5 rounded-sm shrink-0">
              inactive
            </span>
          )}
        </div>
      </td>
      <td className="py-3.5 text-right pr-2 font-mono text-base font-semibold text-primary tabular-nums w-14">
        {entry.total_points}
      </td>
      <td className="py-3.5 pr-4 sm:pr-5 text-right w-8">
        <ChevronDown
          className={cn(
            'h-4 w-4 text-text-muted inline-block transition-transform duration-fast',
            isOpen && 'rotate-180',
          )}
          aria-hidden
        />
      </td>
    </motion.tr>
  );
}

function SubNav({ slug }: { slug: string }) {
  const subNav = [
    { to: `/leagues/${slug}/leaderboard`, label: 'Overall', exact: true },
    { to: `/leagues/${slug}/leaderboard/round/group`, label: 'By round', exact: false },
    { to: `/leagues/${slug}/leaderboard/history`, label: 'History', exact: false },
    { to: `/leagues/${slug}/compare`, label: 'Compare', exact: false },
  ];
  return (
    <nav className="-mx-4 sm:-mx-0 mb-5 overflow-x-auto" aria-label="Leaderboard views">
      <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
        {subNav.map(({ to, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium font-sans whitespace-nowrap transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function LeaderboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { player: currentUser } = useAuth();
  const { slug = DEFAULT_LEAGUE_SLUG } = useParams<{ slug: string }>();
  useLeagueSlugSync(slug);
  const leagueSlug = slug;
  const prevDataRef = useRef<LeaderboardEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const reduceMotion = useReducedMotionConfig() ?? false;
  const [hintDismissed, setHintDismissed] = useState<boolean>(
    () => localStorage.getItem(HINT_DISMISSED_KEY) === 'true',
  );
  // U5.3: player IDs whose rank just changed — held for ~260 ms so the
  // arrow has time to play its pulse. Empty on initial mount.
  const [pulsingIds, setPulsingIds] = useState<ReadonlySet<string>>(() => new Set());

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', leagueSlug],
    queryFn: () =>
      apiFetch<LeaderboardEntry[]>(`/api/v1/leagues/${leagueSlug}/leaderboard`),
    staleTime: 15_000,
  });

  const displayData = dedupedLeaderboard(data, leagueSlug);

  useEffect(() => {
    if (displayData.length === 0) return;
    const prev = prevDataRef.current;
    prevDataRef.current = displayData;

    // First render with data — never pulse. Just seed the ref.
    if (prev.length === 0) return;

    const prevByPlayer = Object.fromEntries(prev.map((e) => [e.player_id, e.rank]));
    const changed = new Set<string>();
    for (const e of displayData) {
      const pr = prevByPlayer[e.player_id];
      if (pr !== undefined && pr !== e.rank) changed.add(e.player_id);
    }
    if (changed.size === 0) return;

    setPulsingIds(changed);
    const id = setTimeout(() => setPulsingIds(new Set()), 260);
    return () => clearTimeout(id);
  }, [displayData]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leaderboard_snapshots' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  function toggleExpand(playerId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  function openCompare(playerId: string) {
    if (!currentUser?.id || currentUser.id === playerId) {
      navigate(`/leagues/${leagueSlug}/compare?b=${playerId}`);
      return;
    }
    navigate(`/leagues/${leagueSlug}/compare?a=${currentUser.id}&b=${playerId}`);
  }

  function dismissHint() {
    localStorage.setItem(HINT_DISMISSED_KEY, 'true');
    setHintDismissed(true);
  }

  const prevByPlayer = Object.fromEntries(
    prevDataRef.current.map((e) => [e.player_id, e.rank]),
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Leaderboard" eyebrow="Standings" />
        {!hintDismissed && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-mono text-text-muted">
            <span>Tap a row for breakdown · long-press to compare</span>
            <button
              onClick={dismissHint}
              className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Dismiss hint"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
        <SubNav slug={leagueSlug} />
        <div
          className="rounded-lg border border-border bg-surface overflow-hidden divide-y divide-border/50"
          aria-label="Loading leaderboard"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1 max-w-[160px]" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Leaderboard" eyebrow="Standings" />
        <EmptyState
          title="Couldn't load the leaderboard"
          description="Refresh the page or check your connection."
          action={
            <Button variant="outline" size="sm" disabled={isRefetching} onClick={() => refetch()}>
              {isRefetching ? 'Retrying…' : 'Try again'}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Leaderboard" eyebrow="Standings" />

      {!hintDismissed && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-mono text-text-muted">
          <span>Tap a row for breakdown · long-press to compare</span>
          <button
            onClick={dismissHint}
            className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Dismiss hint"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <SubNav slug={leagueSlug} />

      {displayData.length === 0 ? (
        <EmptyState
          title="No results entered yet"
          description="The leaderboard fills in as match results are confirmed. Check back after the first kickoff!"
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border text-text-muted text-[10px] font-mono uppercase tracking-[0.2em]">
                <th className="py-2.5 pl-4 sm:pl-5 text-left w-10">#</th>
                <th className="py-2.5 text-left">Player</th>
                <th className="py-2.5 text-right pr-2 w-16">Pts</th>
                <th className="py-2.5 pr-4 sm:pr-5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((entry) => {
                const isOpen = expanded.has(entry.player_id);
                const isMe = entry.player_id === currentUser?.id;
                return (
                  <Fragment key={entry.player_id}>
                    <LeaderboardRow
                      entry={entry}
                      prevRank={prevByPlayer[entry.player_id]}
                      isOpen={isOpen}
                      isMe={isMe}
                      reduceMotion={reduceMotion}
                      shouldPulse={pulsingIds.has(entry.player_id)}
                      onToggle={() => toggleExpand(entry.player_id)}
                      onLongPress={() => openCompare(entry.player_id)}
                    />
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.tr
                          key={`${entry.player_id}-detail`}
                          className="bg-surface-elevated border-b border-border/50"
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <td colSpan={4} className="py-3 pl-12 sm:pl-14 pr-4 sm:pr-5">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-sans">
                              <span className="text-text-muted">
                                Match{' '}
                                <span className="text-text-secondary font-mono font-medium tabular-nums">
                                  {entry.match_points}
                                </span>
                              </span>
                              <span className="text-text-muted">
                                Knockout{' '}
                                <span className="text-text-secondary font-mono font-medium tabular-nums">
                                  {entry.knockout_winner_points}
                                </span>
                              </span>
                              <span className="text-text-muted">
                                Special{' '}
                                <span className="text-text-secondary font-mono font-medium tabular-nums">
                                  {entry.special_points}
                                </span>
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
